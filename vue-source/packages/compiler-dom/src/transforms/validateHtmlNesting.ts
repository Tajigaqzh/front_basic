import {
  // 编译错误类型，这里借用它承载 warning 的 loc 信息。
  type CompilerError,
  // 标签类型枚举。
  ElementTypes,
  // 节点转换器类型。
  type NodeTransform,
  // AST 节点类型枚举。
  NodeTypes,
} from '@vue-source/compiler-core'
// HTML 嵌套合法性判断表。
import { isValidHTMLNesting } from '../htmlNesting'

// 开发环境下校验父子标签嵌套是否符合 HTML 规范。
export const validateHtmlNesting: NodeTransform = (node, context) => {
  if (
    // 当前节点必须是原生元素。
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    // 父节点也必须是原生元素。
    context.parent &&
    context.parent.type === NodeTypes.ELEMENT &&
    context.parent.tagType === ElementTypes.ELEMENT &&
    // 父子标签组合不合法时发出 warning。
    !isValidHTMLNesting(context.parent.tag, node.tag)
  ) {
    // 这是编译期体验优化：很多非法嵌套在浏览器里会被自动纠正，
    // 但 SSR hydration 或未来 DOM 行为可能因此出现偏差。
    // 这里构造 SyntaxError 作为 warning，重点是附带源码位置。
    const error = new SyntaxError(
      `<${node.tag}> cannot be child of <${context.parent.tag}>, ` +
        'according to HTML specifications. ' +
        'This can cause hydration errors or ' +
        'potentially disrupt future functionality.',
    ) as CompilerError
    // 补上 loc，方便用户定位模板中的问题位置。
    error.loc = node.loc
    // 这是 warning 而不是 hard error，不阻断编译。
    context.onWarn(error)
  }
}
