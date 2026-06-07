import {
  type ArrayExpression,
  type AttributeNode,
  type CallExpression,
  type DirectiveNode,
  ElementTypes,
  ErrorCodes,
  type ExpressionNode,
  type InterpolationNode,
  type JSChildNode,
  MERGE_PROPS,
  type NodeTransform,
  NodeTypes,
  type PlainElementNode,
  type PropsExpression,
  type TemplateLiteral,
  type TextNode,
  type TransformContext,
  buildDirectiveArgs,
  buildProps,
  createArrayExpression,
  createAssignmentExpression,
  createCallExpression,
  createCompilerError,
  createCompoundExpression,
  createConditionalExpression,
  createInterpolation,
  createSequenceExpression,
  createSimpleExpression,
  createTemplateLiteral,
  findDir,
  hasDynamicKeyVBind,
  isStaticArgOf,
  isStaticExp,
} from '@vue-source/compiler-dom'
import {
  NO,
  escapeHtml,
  isBooleanAttr,
  isBuiltInDirective,
  isSSRSafeAttrName,
  propsToAttrMap,
} from '@vue-source/shared'
import { SSRErrorCodes, createSSRCompilerError } from '../errors'
import {
  SSR_GET_DIRECTIVE_PROPS,
  SSR_GET_DYNAMIC_MODEL_PROPS,
  SSR_INCLUDE_BOOLEAN_ATTR,
  SSR_INTERPOLATE,
  SSR_RENDER_ATTR,
  SSR_RENDER_ATTRS,
  SSR_RENDER_CLASS,
  SSR_RENDER_DYNAMIC_ATTR,
  SSR_RENDER_STYLE,
} from '../runtimeHelpers'
import {
  processChildren,
} from '../ssrTransformContext'
import type { SSRTransformContext } from '../ssrTransformTypes'

// for directives with children overwrite (e.g. v-html & v-text), we need to
// store the raw children so that they can be added in the 2nd pass.
// SSR 第一轮里先把“最终 children 应该输出什么”临时记在这里，
// 到第二轮真正 push 字符串时再统一取出。
const rawChildrenMap = new WeakMap<
  PlainElementNode,
  TemplateLiteral['elements'][0]
>()

export const ssrTransformElement: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.ELEMENT
  ) {
    return
  }

  return function ssrPostTransformElement() {
    // element
    // generate the template literal representing the open tag.
    // 和客户端不同，这里不是生成 createVNode 调用，
    // 而是先把开始标签拆成可拼接的模板字面量片段。
    const openTag: TemplateLiteral['elements'] = [`<${node.tag}`]
    // some tags need to be passed to runtime for special checks
    const needTagForRuntime =
      node.tag === 'textarea' || node.tag.indexOf('-') > 0

    // v-bind="obj", v-bind:[key] and custom directives can potentially
    // overwrite other static attrs and can affect final rendering result,
    // so when they are present we need to bail out to full `renderAttrs`
    const hasDynamicVBind = hasDynamicKeyVBind(node)
    const hasCustomDir = node.props.some(
      p => p.type === NodeTypes.DIRECTIVE && !isBuiltInDirective(p.name),
    )

    // v-show has a higher priority in ssr
    const vShowPropIndex = node.props.findIndex(
      i => i.type === NodeTypes.DIRECTIVE && i.name === 'show',
    )
    if (vShowPropIndex !== -1) {
      const vShowProp = node.props[vShowPropIndex]
      node.props.splice(vShowPropIndex, 1)
      node.props.push(vShowProp)
    }

    const needMergeProps = hasDynamicVBind || hasCustomDir
    if (needMergeProps) {
      // 一旦出现 `v-bind="obj"`、动态 key 或自定义指令，静态顺序拼属性就不可靠了，
      // 必须退回到运行时 `ssrRenderAttrs(mergeProps(...))` 统一求最终属性结果。
      const { props, directives } = buildProps(
        node,
        context,
        node.props,
        false /* isComponent */,
        false /* isDynamicComponent */,
        true /* ssr */,
      )
      if (props || directives.length) {
        const mergedProps = buildSSRProps(props, directives, context)
        const propsExp = createCallExpression(
          context.helper(SSR_RENDER_ATTRS),
          [mergedProps],
        )

        if (node.tag === 'textarea') {
          const existingText = node.children[0] as
            | TextNode
            | InterpolationNode
            | undefined
          // If interpolation, this is dynamic <textarea> content, potentially
          // injected by v-model and takes higher priority than v-bind value.
          // Additionally, directives with content overrides (v-text/v-html)
          // have higher priority than the merged props.
          if (
            !hasContentOverrideDirective(node) &&
            (!existingText || existingText.type !== NodeTypes.INTERPOLATION)
          ) {
            // textarea 的 value 实际体现在标签内部文本，而不是普通 attribute。
            // 动态 mergeProps 场景下，必须先看最终 props 里是否存在 value，
            // 再决定 children 输出什么。
            // <textarea> with dynamic v-bind. We don't know if the final props
            // will contain .value, so we will have to do something special:
            // assign the merged props to a temp variable, and check whether
            // it contains value (if yes, render is as children).
            const tempId = `_temp${context.temps++}`
            propsExp.arguments = [
              createAssignmentExpression(
                createSimpleExpression(tempId, false),
                mergedProps,
              ),
            ]
            rawChildrenMap.set(
              node,
              createCallExpression(context.helper(SSR_INTERPOLATE), [
                createConditionalExpression(
                  createSimpleExpression(`"value" in ${tempId}`, false),
                  createSimpleExpression(`${tempId}.value`, false),
                  createSimpleExpression(
                    existingText ? existingText.content : ``,
                    true,
                  ),
                  false,
                ),
              ]),
            )
          }
        } else if (node.tag === 'input') {
          // <input v-bind="obj" v-model>
          // we need to determine the props to render for the dynamic v-model
          // and merge it with the v-bind expression.
          const vModel = findVModel(node)
          if (vModel) {
            // input + 动态 v-bind + v-model 是 SSR 最绕的组合之一：
            // 既要保留已有合并 props，又要根据 model 值再补一层动态 model props。
            // 1. save the props (san v-model) in a temp variable
            const tempId = `_temp${context.temps++}`
            const tempExp = createSimpleExpression(tempId, false)
            propsExp.arguments = [
              createSequenceExpression([
                createAssignmentExpression(tempExp, mergedProps),
                createCallExpression(context.helper(MERGE_PROPS), [
                  tempExp,
                  createCallExpression(
                    context.helper(SSR_GET_DYNAMIC_MODEL_PROPS),
                    [
                      tempExp, // existing props
                      vModel.exp!, // model
                    ],
                  ),
                ]),
              ]),
            ]
          }
        } else if (directives.length && !node.children.length) {
          // v-text/v-html have higher priority than the merged props
          if (!hasContentOverrideDirective(node)) {
            // 自定义指令或 mergeProps 之后，如果最终 props 里冒出了 textContent /
            // innerHTML，也要让它覆盖默认 children 输出。
            const tempId = `_temp${context.temps++}`
            propsExp.arguments = [
              createAssignmentExpression(
                createSimpleExpression(tempId, false),
                mergedProps,
              ),
            ]
            rawChildrenMap.set(
              node,
              createConditionalExpression(
                createSimpleExpression(`"textContent" in ${tempId}`, false),
                createCallExpression(context.helper(SSR_INTERPOLATE), [
                  createSimpleExpression(`${tempId}.textContent`, false),
                ]),
                createSimpleExpression(`${tempId}.innerHTML ?? ''`, false),
                false,
              ),
            )
          }
        }

        if (needTagForRuntime) {
          // textarea/custom-element 的某些 attribute 语义不能只靠静态 HTML 推断，
          // runtime helper 需要知道当前具体 tag 名。
          propsExp.arguments.push(`"${node.tag}"`)
        }

        openTag.push(propsExp)
      }
    }

    // book keeping static/dynamic class merging.
    let dynamicClassBinding: CallExpression | undefined = undefined
    let staticClassBinding: string | undefined = undefined
    // all style bindings are converted to dynamic by transformStyle.
    // but we need to make sure to merge them.
    let dynamicStyleBinding: CallExpression | undefined = undefined

    for (let i = 0; i < node.props.length; i++) {
      const prop = node.props[i]
      // ignore true-value/false-value on input
      if (node.tag === 'input' && isTrueFalseValue(prop)) {
        continue
      }
      // special cases with children override
      if (prop.type === NodeTypes.DIRECTIVE) {
        if (prop.name === 'html' && prop.exp) {
          // v-html 在 SSR 下等价于“直接决定 innerHTML 字符串”，
          // 后续不再递归 children。
          rawChildrenMap.set(
            node,
            createCompoundExpression([`(`, prop.exp, `) ?? ''`]),
          )
        } else if (prop.name === 'text' && prop.exp) {
          // v-text 先转换成 interpolation children，后面统一走文本输出逻辑。
          node.children = [createInterpolation(prop.exp, prop.loc)]
        } else if (prop.name === 'slot') {
          context.onError(
            createCompilerError(ErrorCodes.X_V_SLOT_MISPLACED, prop.loc),
          )
        } else if (isTextareaWithValue(node, prop) && prop.exp) {
          if (!needMergeProps) {
            // textarea 的 :value 在 SSR 里也要转成内部文本内容。
            node.children = [createInterpolation(prop.exp, prop.loc)]
          }
        } else if (!needMergeProps && prop.name !== 'on') {
          // Directive transforms.
          const directiveTransform = context.directiveTransforms[prop.name]
          if (directiveTransform) {
            const { props, ssrTagParts } = directiveTransform(
              prop,
              node,
              context,
            )
            if (ssrTagParts) {
              openTag.push(...ssrTagParts)
            }
            for (let j = 0; j < props.length; j++) {
              const { key, value } = props[j]
              if (isStaticExp(key)) {
                let attrName = key.content
                // static key attr
                if (attrName === 'key' || attrName === 'ref') {
                  continue
                }
                if (attrName === 'class') {
                  // class/style 在 SSR 下都不会直接裸输出对象，
                  // 而是交给专门 helper 做规范化后再拼回字符串。
                  openTag.push(
                    ` class="`,
                    (dynamicClassBinding = createCallExpression(
                      context.helper(SSR_RENDER_CLASS),
                      [value],
                    )),
                    `"`,
                  )
                } else if (attrName === 'style') {
                  if (dynamicStyleBinding) {
                    // already has style binding, merge into it.
                    mergeCall(dynamicStyleBinding, value)
                  } else {
                    openTag.push(
                      ` style="`,
                      (dynamicStyleBinding = createCallExpression(
                        context.helper(SSR_RENDER_STYLE),
                        [value],
                      )),
                      `"`,
                    )
                  }
                } else {
                  attrName =
                    node.tag.indexOf('-') > 0
                      ? attrName // preserve raw name on custom elements
                      : propsToAttrMap[attrName] || attrName.toLowerCase()
                  if (isBooleanAttr(attrName)) {
                    // 布尔属性只有在值“应当出现”时才输出属性名本身。
                    openTag.push(
                      createConditionalExpression(
                        createCallExpression(
                          context.helper(SSR_INCLUDE_BOOLEAN_ATTR),
                          [value],
                        ),
                        createSimpleExpression(' ' + attrName, true),
                        createSimpleExpression('', true),
                        false /* no newline */,
                      ),
                    )
                  } else if (isSSRSafeAttrName(attrName)) {
                    // 普通安全属性统一走 ssrRenderAttr，内部会负责转义和空值处理。
                    openTag.push(
                      createCallExpression(context.helper(SSR_RENDER_ATTR), [
                        key,
                        value,
                      ]),
                    )
                  } else {
                    context.onError(
                      createSSRCompilerError(
                        SSRErrorCodes.X_SSR_UNSAFE_ATTR_NAME,
                        key.loc,
                      ),
                    )
                  }
                }
              } else {
                // dynamic key attr
                // this branch is only encountered for custom directive
                // transforms that returns properties with dynamic keys
                // 动态属性名编译期无法确定，只能退回 runtime 动态属性渲染 helper。
                const args: CallExpression['arguments'] = [key, value]
                if (needTagForRuntime) {
                  args.push(`"${node.tag}"`)
                }
                openTag.push(
                  createCallExpression(
                    context.helper(SSR_RENDER_DYNAMIC_ATTR),
                    args,
                  ),
                )
              }
            }
          }
        }
      } else {
        // special case: value on <textarea>
        const name = prop.name
        if (node.tag === 'textarea' && name === 'value' && prop.value) {
          // 静态 value 同样要塞进 textarea children，而不是保留成 attribute。
          rawChildrenMap.set(node, escapeHtml(prop.value.content))
        } else if (!needMergeProps) {
          if (name === 'key' || name === 'ref') {
            continue
          }
          // static prop
          if (name === 'class' && prop.value) {
            staticClassBinding = JSON.stringify(prop.value.content)
          }
          openTag.push(
            ` ${prop.name}` +
              (prop.value ? `="${escapeHtml(prop.value.content)}"` : ``),
          )
        }
      }
    }

    // handle co-existence of dynamic + static class bindings
    if (dynamicClassBinding && staticClassBinding) {
      // class 可能同时来自静态 class="a" 和动态 :class="b"，
      // 这里先把两者合并到同一个 renderClass 调用里，再删掉原静态片段。
      mergeCall(dynamicClassBinding, staticClassBinding)
      removeStaticBinding(openTag, 'class')
    }

    if (context.scopeId) {
      // SFC scoped 样式的 scopeId 也要注入到 SSR 输出标签上。
      openTag.push(` ${context.scopeId}`)
    }

    node.ssrCodegenNode = createTemplateLiteral(openTag)
  }
}

export function buildSSRProps(
  props: PropsExpression | undefined,
  directives: DirectiveNode[],
  context: TransformContext,
): JSChildNode {
  let mergePropsArgs: JSChildNode[] = []
  if (props) {
    if (props.type === NodeTypes.JS_CALL_EXPRESSION) {
      // already a mergeProps call
      mergePropsArgs = props.arguments as JSChildNode[]
    } else {
      mergePropsArgs.push(props)
    }
  }
  if (directives.length) {
    for (const dir of directives) {
      // 自定义指令在 SSR 下无法像客户端那样直接 patch DOM，
      // 这里只能先让运行时 helper 产出它对应的 props 结果，再一起 merge。
      mergePropsArgs.push(
        createCallExpression(context.helper(SSR_GET_DIRECTIVE_PROPS), [
          `_ctx`,
          ...buildDirectiveArgs(dir, context).elements,
        ] as JSChildNode[]),
      )
    }
  }

  return mergePropsArgs.length > 1
    // 多路 props 来源最终统一压成一层 mergeProps(...)。
    ? createCallExpression(context.helper(MERGE_PROPS), mergePropsArgs)
    : mergePropsArgs[0]
}

function isTrueFalseValue(prop: DirectiveNode | AttributeNode) {
  if (prop.type === NodeTypes.DIRECTIVE) {
    return (
      prop.name === 'bind' &&
      prop.arg &&
      isStaticExp(prop.arg) &&
      (prop.arg.content === 'true-value' || prop.arg.content === 'false-value')
    )
  } else {
    return prop.name === 'true-value' || prop.name === 'false-value'
  }
}

function isTextareaWithValue(
  node: PlainElementNode,
  prop: DirectiveNode,
): boolean {
  return !!(
    node.tag === 'textarea' &&
    prop.name === 'bind' &&
    isStaticArgOf(prop.arg, 'value')
  )
}

function mergeCall(call: CallExpression, arg: string | JSChildNode) {
  // renderClass/renderStyle 的参数支持数组形式，这里把后续来源累加进去。
  const existing = call.arguments[0] as ExpressionNode | ArrayExpression
  if (existing.type === NodeTypes.JS_ARRAY_EXPRESSION) {
    existing.elements.push(arg)
  } else {
    call.arguments[0] = createArrayExpression([existing, arg])
  }
}

function removeStaticBinding(
  tag: TemplateLiteral['elements'],
  binding: string,
) {
  // 动静态合并后，原来的静态 ` class="..." ` / ` style="..." ` 片段要删掉，
  // 否则最终字符串里会出现重复属性。
  const regExp = new RegExp(`^ ${binding}=".+"$`)

  const i = tag.findIndex(e => typeof e === 'string' && regExp.test(e))

  if (i > -1) {
    tag.splice(i, 1)
  }
}

function findVModel(node: PlainElementNode): DirectiveNode | undefined {
  return node.props.find(
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'model' && p.exp,
  ) as DirectiveNode | undefined
}

function hasContentOverrideDirective(node: PlainElementNode): boolean {
  return !!findDir(node, 'text') || !!findDir(node, 'html')
}

export function ssrProcessElement(
  node: PlainElementNode,
  context: SSRTransformContext,
): void {
  const isVoidTag = context.options.isVoidTag || NO
  const elementsToAdd = node.ssrCodegenNode!.elements
  // 第二阶段这里才真正把模板字面量片段逐个 push 到 SSR 输出流里。
  for (let j = 0; j < elementsToAdd.length; j++) {
    context.pushStringPart(elementsToAdd[j])
  }

  // Handle slot scopeId
  if (context.withSlotScopeId) {
    context.pushStringPart(createSimpleExpression(`_scopeId`, false))
  }

  // close open tag
  context.pushStringPart(`>`)

  const rawChildren = rawChildrenMap.get(node)
  if (rawChildren) {
    // v-html/v-text/textarea value 覆盖场景会优先使用提前缓存的 children 输出。
    context.pushStringPart(rawChildren)
  } else if (node.children.length) {
    processChildren(node, context)
  }

  if (!isVoidTag(node.tag)) {
    // push closing tag
    context.pushStringPart(`</${node.tag}>`)
  }
}
