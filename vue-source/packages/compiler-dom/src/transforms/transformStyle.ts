import {
  // 常量类型枚举，告诉后续优化这个表达式可以安全字符串化。
  ConstantTypes,
  // 节点转换器类型。
  type NodeTransform,
  // AST 节点类型枚举。
  NodeTypes,
  // 简单表达式节点类型。
  type SimpleExpressionNode,
  // 源码位置信息类型。
  type SourceLocation,
  // 创建简单表达式节点。
  createSimpleExpression,
} from '@vue-source/compiler-core'
// 把内联 CSS 字符串解析成对象。
import { parseStringStyle } from '@vue-source/shared'

// Parse inline CSS strings for static style attributes into an object.
// This is a NodeTransform since it works on the static `style` attribute and
// converts it into a dynamic equivalent:
// style="color: red" -> :style='{ "color": "red" }'
// It is then processed by `transformElement` and included in the generated
// props.
// 这个转换发生在节点级别，因为它处理的是普通静态属性，而不是指令。
export const transformStyle: NodeTransform = node => {
  // 只有元素节点才有 props。
  if (node.type === NodeTypes.ELEMENT) {
    // 遍历元素上的所有属性，寻找静态 style。
    node.props.forEach((p, i) => {
      if (p.type === NodeTypes.ATTRIBUTE && p.name === 'style' && p.value) {
        // 这样做的目的，是让后续 transformElement / codegen 不必区分
        // “原本是 style attribute”还是“原本是 :style 指令”，统一按动态 prop 处理。
        // 找到后，直接把当前属性替换成等价的 v-bind:style 指令节点。
        // replace p with an expression node
        node.props[i] = {
          // 新节点类型从普通 ATTRIBUTE 改成 DIRECTIVE。
          type: NodeTypes.DIRECTIVE,
          // 对应 v-bind。
          name: `bind`,
          // 参数是静态字符串 style，相当于 :style。
          arg: createSimpleExpression(`style`, true, p.loc),
          // 值是解析后的 CSS 对象表达式。
          exp: parseInlineCSS(p.value.content, p.loc),
          // 没有修饰符。
          modifiers: [],
          // 复用原始源码位置信息，便于 sourcemap 和报错。
          loc: p.loc,
        }
      }
    })
  }
}

const parseInlineCSS = (
  // 原始 style 字符串，例如 "color:red;font-size:12px"。
  cssText: string,
  // 对应源码位置。
  loc: SourceLocation,
): SimpleExpressionNode => {
  // 先解析成对象结构，例如 { color: 'red', 'font-size': '12px' }。
  const normalized = parseStringStyle(cssText)
  return createSimpleExpression(
    // 序列化成 JS 对象字面量字符串，供后续 codegen 直接使用。
    JSON.stringify(normalized),
    // 这里不是静态字符串文本，而是一个可执行表达式。
    false,
    loc,
    // 标记为可字符串化常量，方便静态提升优化。
    ConstantTypes.CAN_STRINGIFY,
  )
}
