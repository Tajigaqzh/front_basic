// 只需要元素类型、节点转换器类型和节点种类枚举。
import { ElementTypes, type NodeTransform, NodeTypes } from '@vue-source/compiler-core'
// DOM 错误定义。
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

// 客户端模板里忽略 script / style，避免把副作用标签编进组件渲染树。
export const ignoreSideEffectTags: NodeTransform = (node, context) => {
  if (
    // 只处理原生元素节点。
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    // script 和 style 都属于会产生副作用的标签。
    (node.tag === 'script' || node.tag === 'style')
  ) {
    // 开发环境给出明确错误提示，帮助用户发现模板误用。
    __DEV__ &&
      context.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
          node.loc,
        ),
      )
    // 这类标签不只是“没意义”，而是可能在客户端渲染过程中引发副作用，
    // 所以这里直接从模板 AST 里剔除，而不是保留成普通元素。
    // 直接把当前节点从 AST 中移除。
    context.removeNode()
  }
}
