import type {
  BlockStatement,
  Expression,
  Identifier,
  Node,
  ObjectPattern,
  Program,
  VariableDeclaration,
} from '@babel/types'
import { walk } from 'estree-walker'
import {
  TS_NODE_TYPES,
  extractIdentifiers,
  isFunctionType,
  isReferencedIdentifier,
  isStaticProperty,
  unwrapTSNode,
  walkFunctionParams,
} from '@vue-source/compiler-core'
import { BindingTypes } from '@vue-source/compiler-core'
import { genPropsAccessExp } from '@vue-source/shared'
import type { ScriptCompileContext } from './context'
import { isCallOf } from './utils'

export interface PropsDestructureBinding {
  local: string
  default?: Expression
}

export function processPropsDestructure(
  ctx: ScriptCompileContext,
  declId: ObjectPattern,
): void {
  // 这里只记录 defineProps 解构的结构信息：
  // 本地变量名、默认值、rest 变量、原始 props key。
  ctx.propsDestructureDecl = declId

  for (const prop of declId.properties) {
    if (prop.type === 'RestElement' && prop.argument.type === 'Identifier') {
      // `...rest` 收集的是剩余 props，语义上更接近响应式常量。
      ctx.propsDestructureRestId = prop.argument.name
      ctx.markBinding(prop.argument.name, BindingTypes.SETUP_REACTIVE_CONST)
      continue
    }

    if (prop.type !== 'ObjectProperty') {
      continue
    }

    const key = getObjectPatternKey(prop.key)
    if (!key) {
      continue
    }

    if (prop.value.type === 'Identifier') {
      registerBinding(ctx, key, prop.value.name)
      continue
    }

    if (
      prop.value.type === 'AssignmentPattern' &&
      prop.value.left.type === 'Identifier'
    ) {
      registerBinding(ctx, key, prop.value.left.name, prop.value.right)
    }
  }
}

type Scope = Record<string, boolean>

export function transformDestructuredProps(ctx: ScriptCompileContext): void {
  if (!ctx.program || !ctx.propsDestructureDecl) {
    return
  }

  // rootScope 里的 true 表示“这个本地名来自 props 解构，默认允许重写”。
  // 如果后续在子作用域重新声明同名变量，就会用 false 把它遮蔽掉。
  const rootScope: Scope = Object.create(null)
  const scopeStack: Scope[] = [rootScope]
  let currentScope: Scope = rootScope
  // 声明位、参数位等不能直接改写成 props 读取表达式，所以单独排除。
  const excludedIds = new WeakSet<Identifier>()
  const parentStack: Node[] = []
  const propsLocalToPublicMap: Record<string, string> = Object.create(null)
  const replacements: Array<{ start: number; end: number; value: string }> = []

  for (const key in ctx.propsDestructuredBindings) {
    const { local } = ctx.propsDestructuredBindings[key]
    rootScope[local] = true
    propsLocalToPublicMap[local] = key
  }

  function pushScope() {
    scopeStack.push((currentScope = Object.create(currentScope)))
  }

  function popScope() {
    scopeStack.pop()
    currentScope = scopeStack[scopeStack.length - 1] || Object.create(null)
  }

  function registerLocalBinding(id: Identifier) {
    excludedIds.add(id)
    currentScope[id.name] = false
  }

  function walkScope(node: Program | BlockStatement, isRoot = false) {
    for (const stmt of node.body) {
      if (stmt.type === 'VariableDeclaration') {
        walkVariableDeclaration(stmt, isRoot)
      } else if (
        (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') &&
        stmt.id
      ) {
        registerLocalBinding(stmt.id)
      }
    }
  }

  function walkVariableDeclaration(stmt: VariableDeclaration, isRoot = false) {
    for (const decl of stmt.declarations) {
      const isDefineProps =
        isRoot &&
        decl.init &&
        isCallOf(unwrapTSNode(decl.init), 'defineProps')
      for (const id of extractIdentifiers(decl.id)) {
        if (isDefineProps) {
          // defineProps 解构声明本身里的标识符属于“声明位”，不能直接替换。
          excludedIds.add(id)
        } else {
          registerLocalBinding(id)
        }
      }
    }
  }

  function rewriteId(id: Identifier, parent: Node) {
    const replacement = genPropsAccessExp(propsLocalToPublicMap[id.name])
    if (isStaticProperty(parent) && parent.shorthand) {
      // `{ foo }` 这种 shorthand 不能直接替换成 `{ __props.foo }`，
      // 需要补成显式键值对形式。
      replacements.push({
        start: id.end ?? 0,
        end: id.end ?? 0,
        value: `: ${replacement}`,
      })
      return
    }
    replacements.push({
      start: id.start ?? 0,
      end: id.end ?? 0,
      value: replacement,
    })
  }

  walkScope(ctx.program, true)
  walk(ctx.program as unknown as Node, {
    enter(node: Node, parent: Node | null) {
      if (parent) parentStack.push(parent)

      if (
        parent &&
        parent.type.startsWith('TS') &&
        !TS_NODE_TYPES.includes(parent.type)
      ) {
        return this.skip()
      }

      if (isFunctionType(node)) {
        pushScope()
        walkFunctionParams(node, registerLocalBinding)
        if (node.body.type === 'BlockStatement') {
          walkScope(node.body)
        }
        return
      }

      if (node.type === 'BlockStatement' && !isFunctionType(parent as Node)) {
        pushScope()
        walkScope(node)
        return
      }

      if (
        node.type === 'Identifier' &&
        parent &&
        isReferencedIdentifier(node, parent, parentStack) &&
        !excludedIds.has(node) &&
        currentScope[node.name]
      ) {
        // 只有真正的“引用位”并且仍指向 props 解构绑定时才重写。
        rewriteId(node, parent)
      }
    },
    leave(node: Node, parent: Node | null) {
      if (parent) parentStack.pop()
      if (
        (node.type === 'BlockStatement' && !isFunctionType(parent as Node)) ||
        isFunctionType(node)
      ) {
        popScope()
      }
    },
  })

  if (!replacements.length) {
    return
  }

  // 倒序替换，避免前面的插入/替换破坏后续节点的 start/end。
  replacements.sort((a, b) => b.start - a.start)
  let next = ctx.content
  for (const replacement of replacements) {
    next =
      next.slice(0, replacement.start) +
      replacement.value +
      next.slice(replacement.end)
  }
  ctx.content = next
}

function registerBinding(
  ctx: ScriptCompileContext,
  key: string,
  local: string,
  defaultValue?: Expression,
) {
  // 建立“公开 props key -> 本地变量信息”的映射，后续默认值合并和源码重写
  // 都要依赖这里。
  ctx.propsDestructuredBindings[key] = {
    local,
    default: defaultValue,
  }
  if (local !== key) {
    // 别名场景下额外记录反向映射，方便后续从本地名追溯原始 props key。
    ctx.markBinding(local, BindingTypes.PROPS_ALIASED)
    ;(ctx.bindingMetadata.__propsAliases ||
      (ctx.bindingMetadata.__propsAliases = {}))[local] = key
  } else {
    ctx.markBinding(local, BindingTypes.PROPS)
  }
}

function getObjectPatternKey(node: Identifier | Expression | any): string | null {
  // 这里只处理静态可确定的 key，动态 key 不会进入 props 解构映射表。
  if (node.type === 'Identifier') return node.name
  if (node.type === 'StringLiteral') return node.value
  if (node.type === 'NumericLiteral') return String(node.value)
  return null
}
