// 这个 transform 负责三件关键事情：
// 1. 把模板表达式解析成更细粒度的 AST，便于精确 source-map。
// 2. 给标识符补上正确访问来源，例如 `_ctx.xxx`、`$setup.xxx`、`ref.value`。
// 3. 把复杂表达式拆成 compound expression，供 codegen 更精确输出。
//
// 它只在非浏览器构建里完整启用，因为依赖额外 JS parser；
// 浏览器内联编译通常走 `with (_ctx) { ... }`，不做同等级别处理。
import type { NodeTransform, TransformContext } from '../transform'
import {
  type CompoundExpressionNode,
  ConstantTypes,
  type ExpressionNode,
  NodeTypes,
  type SimpleExpressionNode,
  createCompoundExpression,
  createSimpleExpression,
} from '../ast'
import {
  isInDestructureAssignment,
  isInNewExpression,
  isStaticProperty,
  isStaticPropertyKey,
  walkIdentifiers,
} from '../babelUtils'
import { advancePositionWithClone, findDir, isSimpleIdentifier } from '../utils'
import {
  genPropsAccessExp,
  hasOwn,
  isGloballyAllowed,
  isString,
  makeMap,
} from '@vue-source/shared'
import { ErrorCodes, createCompilerError } from '../errors'
import type {
  AssignmentExpression,
  Identifier,
  Node,
  UpdateExpression,
} from '@babel/types'
import { validateBrowserExpression } from '../validateExpression'
import { parseExpression } from '@babel/parser'
import { IS_REF, UNREF } from '../runtimeHelpers'
import { BindingTypes } from '../options'

const isLiteralWhitelisted = /*@__PURE__*/ makeMap('true,false,null,this')

export const transformExpression: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    // 插值本质就是一个表达式，直接交给 processExpression 改写。
    node.content = processExpression(
      node.content as SimpleExpressionNode,
      context,
    )
  } else if (node.type === NodeTypes.ELEMENT) {
    // handle directives on element
    const memo = findDir(node, 'memo')
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      // do not process for v-on & v-for since they are special handled
      if (dir.type === NodeTypes.DIRECTIVE && dir.name !== 'for') {
        const exp = dir.exp
        const arg = dir.arg
        // do not process exp if this is v-on:arg - we need special handling
        // for wrapping inline statements.
        if (
          exp &&
          exp.type === NodeTypes.SIMPLE_EXPRESSION &&
          !(dir.name === 'on' && arg) &&
          // key has been processed in transformFor(vMemo + vFor)
          !(
            memo &&
            arg &&
            arg.type === NodeTypes.SIMPLE_EXPRESSION &&
            arg.content === 'key'
          )
        ) {
          // 普通指令表达式统一在这里做标识符来源分析和访问路径改写。
          dir.exp = processExpression(
            exp,
            context,
            // slot args must be processed as function params
            dir.name === 'slot',
          )
        }
        if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION && !arg.isStatic) {
          // 动态参数例如 `:[foo]` 里的 `foo` 也要按表达式处理。
          dir.arg = processExpression(arg, context)
        }
      }
    }
  }
}

interface PrefixMeta {
  prefix?: string
  isConstant: boolean
  start: number
  end: number
  scopeIds?: Set<string>
}

// Important: since this function uses Node.js only dependencies, it should
// always be used with a leading !__BROWSER__ check so that it can be
// tree-shaken from the browser build.
export function processExpression(
  node: SimpleExpressionNode,
  context: TransformContext,
  // some expressions like v-slot props & v-for aliases should be parsed as
  // function params
  asParams = false,
  // v-on handler values may contain multiple statements
  asRawStatements = false,
  localVars: Record<string, number> = Object.create(context.identifiers),
): ExpressionNode {
  // 模板表达式改写的核心入口：
  // 决定标识符应该访问 `_ctx`、`$setup`、`$props` 还是 ref.value。
  if (__BROWSER__) {
    if (__DEV__) {
      // simple in-browser validation (same logic in 2.x)
      validateBrowserExpression(node, context, asParams, asRawStatements)
    }
    return node
  }

  if (!context.prefixIdentifiers || !node.content.trim()) {
    return node
  }

  const { inline, bindingMetadata } = context
  const rewriteIdentifier = (
    raw: string,
    parent?: Node | null,
    id?: Identifier,
  ) => {
    // 根据 bindingMetadata 判断变量来源，再生成对应访问代码。
    const type = hasOwn(bindingMetadata, raw) && bindingMetadata[raw]
    if (inline) {
      // x = y
      const isAssignmentLVal =
        parent && parent.type === 'AssignmentExpression' && parent.left === id
      // x++
      const isUpdateArg =
        parent && parent.type === 'UpdateExpression' && parent.argument === id
      // ({ x } = y)
      const isDestructureAssignment =
        parent && isInDestructureAssignment(parent, parentStack)
      const isNewExpression = parent && isInNewExpression(parentStack)
      const wrapWithUnref = (raw: string) => {
        const wrapped = `${context.helperString(UNREF)}(${raw})`
        return isNewExpression ? `(${wrapped})` : wrapped
      }

      if (
        isConst(type) ||
        type === BindingTypes.SETUP_REACTIVE_CONST ||
        localVars[raw]
      ) {
        // 常量和局部变量不需要任何前缀改写。
        return raw
      } else if (type === BindingTypes.SETUP_REF) {
        // setup ref 在模板里直接按值访问，所以要取 `.value`。
        return `${raw}.value`
      } else if (type === BindingTypes.SETUP_MAYBE_REF) {
        // 这种绑定在编译期无法确定是否为 ref：
        // 读取时走 unref，赋值/自增时按 ref.value 处理。
        // const binding that may or may not be ref
        // if it's not a ref, then assignments don't make sense -
        // so we ignore the non-ref assignment case and generate code
        // that assumes the value to be a ref for more efficiency
        return isAssignmentLVal || isUpdateArg || isDestructureAssignment
          ? `${raw}.value`
          : wrapWithUnref(raw)
      } else if (type === BindingTypes.SETUP_LET) {
        // setup let 既可能是 ref 也可能不是 ref，赋值/自增场景要特殊展开。
        if (isAssignmentLVal) {
          // let binding.
          // this is a bit more tricky as we need to cover the case where
          // let is a local non-ref value, and we need to replicate the
          // right hand side value.
          // x = y --> isRef(x) ? x.value = y : x = y
          const { right: rVal, operator } = parent as AssignmentExpression
          const rExp = rawExp.slice(rVal.start! - 1, rVal.end! - 1)
          const rExpString = stringifyExpression(
            processExpression(
              createSimpleExpression(rExp, false),
              context,
              false,
              false,
              knownIds,
            ),
          )
          return `${context.helperString(IS_REF)}(${raw})${
            context.isTS ? ` //@ts-ignore\n` : ``
          } ? ${raw}.value ${operator} ${rExpString} : ${raw}`
        } else if (isUpdateArg) {
          // make id replace parent in the code range so the raw update operator
          // is removed
          id!.start = parent!.start
          id!.end = parent!.end
          const { prefix: isPrefix, operator } = parent as UpdateExpression
          const prefix = isPrefix ? operator : ``
          const postfix = isPrefix ? `` : operator
          // let binding.
          // x++ --> isRef(a) ? a.value++ : a++
          return `${context.helperString(IS_REF)}(${raw})${
            context.isTS ? ` //@ts-ignore\n` : ``
          } ? ${prefix}${raw}.value${postfix} : ${prefix}${raw}${postfix}`
        } else if (isDestructureAssignment) {
          // TODO
          // let binding in a destructure assignment - it's very tricky to
          // handle both possible cases here without altering the original
          // structure of the code, so we just assume it's not a ref here
          // for now
          return raw
        } else {
          return wrapWithUnref(raw)
        }
      } else if (type === BindingTypes.PROPS) {
        // props 不直接从 `_ctx` 取，而是走编译器约定的 props 通道。
        // use __props which is generated by compileScript so in ts mode
        // it gets correct type
        return genPropsAccessExp(raw)
      } else if (type === BindingTypes.PROPS_ALIASED) {
        // defineProps 解构别名场景，实际仍回到原始 props 字段读取。
        // prop with a different local alias (from defineProps() destructure)
        return genPropsAccessExp(bindingMetadata.__propsAliases![raw])
      }
    } else {
      if (
        (type && type.startsWith('setup')) ||
        type === BindingTypes.LITERAL_CONST
      ) {
        // setup bindings in non-inline mode
        return `$setup.${raw}`
      } else if (type === BindingTypes.PROPS_ALIASED) {
        return `$props['${bindingMetadata.__propsAliases![raw]}']`
      } else if (type) {
        return `$${type}.${raw}`
      }
    }

    // fallback to ctx
    // 兜底视为 render 上下文字段，改写成 `_ctx.xxx`。
    return `_ctx.${raw}`
  }

  // fast path if expression is a simple identifier.
  const rawExp = node.content

  let ast = node.ast

  if (ast === false) {
    // ast being false means it has caused an error already during parse phase
    return node
  }

  if (ast === null || (!ast && isSimpleIdentifier(rawExp))) {
    const isScopeVarReference = context.identifiers[rawExp]
    const isAllowedGlobal = isGloballyAllowed(rawExp)
    const isLiteral = isLiteralWhitelisted(rawExp)
    if (
      !asParams &&
      !isScopeVarReference &&
      !isLiteral &&
      (!isAllowedGlobal || bindingMetadata[rawExp])
    ) {
      // 只有非局部、非常量、非允许全局变量才需要补访问前缀。
      // const bindings exposed from setup can be skipped for patching but
      // cannot be hoisted to module scope
      if (isConst(bindingMetadata[rawExp])) {
        node.constType = ConstantTypes.CAN_SKIP_PATCH
      }
      node.content = rewriteIdentifier(rawExp)
    } else if (!isScopeVarReference) {
      if (isLiteral) {
        node.constType = ConstantTypes.CAN_STRINGIFY
      } else {
        node.constType = ConstantTypes.CAN_CACHE
      }
    }
    return node
  }

  if (!ast) {
    // 复杂表达式第一次进入时还没有 Babel AST，这里按上下文方式补解析。
    // exp needs to be parsed differently:
    // 1. Multiple inline statements (v-on, with presence of `;`): parse as raw
    //    exp, but make sure to pad with spaces for consistent ranges
    // 2. Expressions: wrap with parens (for e.g. object expressions)
    // 3. Function arguments (v-for, v-slot): place in a function argument position
    const source = asRawStatements
      ? ` ${rawExp} `
      : `(${rawExp})${asParams ? `=>{}` : ``}`
    try {
      ast = parseExpression(source, {
        sourceType: 'module',
        plugins: context.expressionPlugins,
      })
    } catch (e: any) {
      context.onError(
        createCompilerError(
          ErrorCodes.X_INVALID_EXPRESSION,
          node.loc,
          undefined,
          e.message,
        ),
      )
      return node
    }
  }

  type QualifiedId = Identifier & PrefixMeta
  const ids: QualifiedId[] = []
  const parentStack: Node[] = []
  // knownIds 记录当前表达式内部已经引入的局部变量。
  const knownIds: Record<string, number> = Object.create(context.identifiers)

  walkIdentifiers(
    ast,
    (node, parent, _, isReferenced, isLocal) => {
      if (isStaticPropertyKey(node, parent!)) {
        return
      }
      // v2 wrapped filter call
      if (__COMPAT__ && node.name.startsWith('_filter_')) {
        return
      }

      const needPrefix = isReferenced && canPrefix(node)
      if (needPrefix && !isLocal) {
        // 真正被引用、且不属于局部作用域的标识符，才会被重写。
        if (isStaticProperty(parent!) && parent.shorthand) {
          // property shorthand like { foo }, we need to add the key since
          // we rewrite the value
          ;(node as QualifiedId).prefix = `${node.name}: `
        }
        node.name = rewriteIdentifier(node.name, parent, node)
        ids.push(node as QualifiedId)
      } else {
        // 没有被改写的标识符也会被记录下来，用于更细粒度的 source map。
        // The identifier is considered constant unless it's pointing to a
        // local scope variable (a v-for alias, or a v-slot prop)
        if (
          !(needPrefix && isLocal) &&
          (!parent ||
            (parent.type !== 'CallExpression' &&
              parent.type !== 'NewExpression' &&
              parent.type !== 'MemberExpression'))
        ) {
          ;(node as QualifiedId).isConstant = true
        }
        // also generate sub-expressions for other identifiers for better
        // source map support. (except for property keys which are static)
        ids.push(node as QualifiedId)
      }
    },
    true, // invoke on ALL identifiers
    parentStack,
    knownIds,
  )

  // We break up the compound expression into an array of strings and sub
  // expressions (for identifiers that have been prefixed). In codegen, if
  // an ExpressionNode has the `.children` property, it will be used instead of
  // `.content`.
  // 例如 `foo + bar.baz` 会被拆成“字符串片段 + 子表达式节点”的混合数组。
  const children: CompoundExpressionNode['children'] = []
  ids.sort((a, b) => a.start - b.start)
  ids.forEach((id, i) => {
    // 把整个表达式拆成“原始字符串片段 + 子表达式节点”数组，便于 codegen 精确输出。
    // range is offset by -1 due to the wrapping parens when parsed
    const start = id.start - 1
    const end = id.end - 1
    const last = ids[i - 1]
    const leadingText = rawExp.slice(last ? last.end - 1 : 0, start)
    if (leadingText.length || id.prefix) {
      children.push(leadingText + (id.prefix || ``))
    }
    const source = rawExp.slice(start, end)
    children.push(
      createSimpleExpression(
        id.name,
        false,
        {
          start: advancePositionWithClone(node.loc.start, source, start),
          end: advancePositionWithClone(node.loc.start, source, end),
          source,
        },
        id.isConstant
          ? ConstantTypes.CAN_STRINGIFY
          : ConstantTypes.NOT_CONSTANT,
      ),
    )
    if (i === ids.length - 1 && end < rawExp.length) {
      children.push(rawExp.slice(end))
    }
  })

  let ret
  if (children.length) {
    ret = createCompoundExpression(children, node.loc)
    ret.ast = ast
  } else {
    ret = node
    ret.constType = ConstantTypes.CAN_STRINGIFY
  }
  ret.identifiers = Object.keys(knownIds)
  return ret
}

function canPrefix(id: Identifier) {
  // 允许直接使用的全局变量，例如 Math / Date，不需要改写。
  // skip whitelisted globals
  if (isGloballyAllowed(id.name)) {
    return false
  }
  // special case for webpack compilation
  if (id.name === 'require') {
    return false
  }
  return true
}

export function stringifyExpression(exp: ExpressionNode | string): string {
  // 把表达式节点重新拼回字符串，常用于二次改写场景。
  if (isString(exp)) {
    return exp
  } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    return exp.content
  } else {
    return (exp.children as (ExpressionNode | string)[])
      .map(stringifyExpression)
      .join('')
  }
}

function isConst(type: unknown) {
  // 编译器视角下“足够稳定的常量绑定”判断。
  return (
    type === BindingTypes.SETUP_CONST || type === BindingTypes.LITERAL_CONST
  )
}
