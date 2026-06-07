import {
  // 指令转换函数类型。
  type DirectiveTransform,
  // toDisplayString helper，用于把任意值安全转成文本。
  TO_DISPLAY_STRING,
  // 创建函数调用表达式。
  createCallExpression,
  // 创建对象属性节点。
  createObjectProperty,
  // 创建简单表达式节点。
  createSimpleExpression,
  // 计算表达式常量等级，决定能否直接内联。
  getConstantType,
} from '@vue-source/compiler-core'
// DOM 专属错误定义。
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

// v-text 会被转换成 textContent 属性赋值。
export const transformVText: DirectiveTransform = (dir, node, context) => {
  // 取出指令表达式和源码位置信息。
  const { exp, loc } = dir
  // v-text 必须带表达式。
  if (!exp) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_NO_EXPRESSION, loc),
    )
  }
  // v-text 同样会覆盖元素文本内容，所以不能和子节点共存。
  if (node.children.length) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_WITH_CHILDREN, loc),
    )
    // 清空原子节点，避免生成重复内容。
    node.children.length = 0
  }
  return {
    // 和 v-html 不同，v-text 会走 textContent，并在非常量表达式场景下
    // 自动补一层 toDisplayString，确保运行时总是得到安全文本。
    // 生成等价属性：textContent: ...
    props: [
      createObjectProperty(
        // DOM 属性名固定为 textContent。
        createSimpleExpression(`textContent`, true),
        exp
          // 常量表达式可以直接复用，避免额外包装。
          ? getConstantType(exp, context) > 0
            ? exp
            // 非常量表达式需要包装成 toDisplayString(exp)，保证运行时输出文本。
            : createCallExpression(
                context.helperString(TO_DISPLAY_STRING),
                [exp],
                loc,
              )
          // 缺失表达式时用空字符串占位。
          : createSimpleExpression('', true),
      ),
    ],
  }
}
