import {
  // 指令转换函数类型。
  type DirectiveTransform,
  // 创建对象属性节点。
  createObjectProperty,
  // 创建简单表达式节点。
  createSimpleExpression,
} from '@vue-source/compiler-core'
// DOM 专属错误定义。
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

// v-html 会被转换成 innerHTML 属性赋值。
export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  // 取出指令表达式和源码位置信息，错误提示要用到。
  const { exp, loc } = dir
  // v-html 没有表达式是非法写法，例如 <div v-html />
  if (!exp) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_NO_EXPRESSION, loc),
    )
  }
  // v-html 和子节点互斥，因为 innerHTML 会直接覆盖元素内容。
  if (node.children.length) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_WITH_CHILDREN, loc),
    )
    // 发现冲突时直接清空子节点，避免后续继续参与生成。
    node.children.length = 0
  }
  return {
    // v-html 的结果很直接：本质上就是生成一个 `innerHTML: expr` prop。
    // 真正的“不安全 HTML”语义不在编译期解决，而是交给运行时 DOM 赋值行为承担。
    // 生成等价属性：innerHTML: exp
    props: [
      createObjectProperty(
        // 属性名固定为 innerHTML。
        createSimpleExpression(`innerHTML`, true, loc),
        // 如果表达式缺失，用空字符串兜底，避免 AST 结构不完整。
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
