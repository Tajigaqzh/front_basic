import {
  // 兼容模式下的废弃能力枚举。
  CompilerDeprecationTypes,
  // 指令转换器类型。
  type DirectiveTransform,
  // 泛化表达式节点类型。
  type ExpressionNode,
  // AST 节点类型枚举。
  NodeTypes,
  // 简单表达式节点类型。
  type SimpleExpressionNode,
  // 源码位置信息类型。
  type SourceLocation,
  // transform 上下文类型。
  type TransformContext,
  // compiler-core 的通用 v-on 转换。
  transformOn as baseTransform,
  // 检查兼容开关是否开启。
  checkCompatEnabled,
  // 创建函数调用表达式。
  createCallExpression,
  // 创建复合表达式。
  createCompoundExpression,
  // 创建对象属性。
  createObjectProperty,
  // 创建简单表达式。
  createSimpleExpression,
  // 判断表达式是否为静态表达式。
  isStaticExp,
} from '@vue-source/compiler-core'
// 运行时事件修饰符 helper。
import { V_ON_WITH_KEYS, V_ON_WITH_MODIFIERS } from '../runtimeHelpers'
// 字符串工具：首字母大写和 makeMap。
import { capitalize, makeMap } from '@vue-source/shared'

// passive / once / capture 会体现在事件名后缀上。
const isEventOptionModifier = /*@__PURE__*/ makeMap(`passive,once,capture`)
const isNonKeyModifier = /*@__PURE__*/ makeMap(
  // event propagation management
  `stop,prevent,self,` +
    // system modifiers + exact
    `ctrl,shift,alt,meta,exact,` +
    // mouse
    `middle`,
)
// left & right could be mouse or key modifiers based on event type
const maybeKeyModifier = /*@__PURE__*/ makeMap('left,right')
// 这些事件才是真正的键盘事件。
const isKeyboardEvent = /*@__PURE__*/ makeMap(`onkeyup,onkeydown,onkeypress`)

const resolveModifiers = (
  // 当前事件名，例如 onClick。
  key: ExpressionNode,
  // 指令上写的所有修饰符，例如 stop / enter / passive。
  modifiers: SimpleExpressionNode[],
  // transform 上下文，用于兼容模式判断。
  context: TransformContext,
  // 源码位置，给兼容警告使用。
  loc: SourceLocation,
) => {
  // DOM 平台把修饰符拆成三类，是因为它们最终落地方式完全不同：
  // 1. withModifiers 运行时守卫
  // 2. withKeys 键盘守卫
  // 3. addEventListener 选项后缀
  // 键盘相关修饰符，例如 enter / esc / left。
  const keyModifiers = []
  // 非键盘修饰符，例如 stop / prevent / self。
  const nonKeyModifiers = []
  // addEventListener 选项类修饰符，例如 once / passive。
  const eventOptionModifiers = []

  for (let i = 0; i < modifiers.length; i++) {
    // 当前正在处理的修饰符文本。
    const modifier = modifiers[i].content

    if (
      __COMPAT__ &&
      modifier === 'native' &&
      checkCompatEnabled(
        CompilerDeprecationTypes.COMPILER_V_ON_NATIVE,
        context,
        loc,
      )
    ) {
      // compat 模式下，.native 被当作事件选项类修饰符保留。
      eventOptionModifiers.push(modifier)
    } else if (isEventOptionModifier(modifier)) {
      // eventOptionModifiers: modifiers for addEventListener() options,
      // e.g. .passive & .capture
      eventOptionModifiers.push(modifier)
    } else {
      // runtimeModifiers: modifiers that needs runtime guards
      if (maybeKeyModifier(modifier)) {
        // left / right 比较特殊：可能是按键，也可能是鼠标按钮。
        if (isStaticExp(key)) {
          if (
            isKeyboardEvent((key as SimpleExpressionNode).content.toLowerCase())
          ) {
            // 绑定在键盘事件上时，算 key modifier。
            keyModifiers.push(modifier)
          } else {
            // 绑定在 click 等事件上时，算非键盘修饰符。
            nonKeyModifiers.push(modifier)
          }
        } else {
          // 动态事件名编译期无法判断，保守地两个集合都加。
          keyModifiers.push(modifier)
          nonKeyModifiers.push(modifier)
        }
      } else {
        if (isNonKeyModifier(modifier)) {
          // 明确属于非键盘修饰符。
          nonKeyModifiers.push(modifier)
        } else {
          // 剩余修饰符默认归为按键类，例如 enter。
          keyModifiers.push(modifier)
        }
      }
    }
  }

  // 返回拆分结果，供后续分别生成包装逻辑。
  return {
    keyModifiers,
    nonKeyModifiers,
    eventOptionModifiers,
  }
}

const transformClick = (key: ExpressionNode, event: string) => {
  // 静态 onClick 可以直接改写成新的静态事件名。
  const isStaticClick =
    isStaticExp(key) && key.content.toLowerCase() === 'onclick'
  return isStaticClick
    ? createSimpleExpression(event, true)
    // 动态事件名需要生成条件表达式，只把 onClick 映射成目标事件名。
    : key.type !== NodeTypes.SIMPLE_EXPRESSION
      ? createCompoundExpression([
          `(`,
          key,
          `) === "onClick" ? "${event}" : (`,
          key,
          `)`,
        ])
      : key
}

// DOM 平台 v-on 转换。
export const transformOn: DirectiveTransform = (dir, node, context) => {
  // 复用 core 的基础转换，再在结果上追加 DOM 特有修饰符处理。
  return baseTransform(dir, node, context, baseResult => {
    // 取出模板中写的修饰符。
    const { modifiers } = dir
    // 没有修饰符时，基础结果已经足够。
    if (!modifiers.length) return baseResult

    // baseTransform 会产出单个事件属性，取出其 key / value。
    let { key, value: handlerExp } = baseResult.props[0]
    // 先把修饰符分成三类，便于分别处理。
    const { keyModifiers, nonKeyModifiers, eventOptionModifiers } =
      resolveModifiers(key, modifiers, context, dir.loc)

    // click.right / click.middle 在浏览器里并不会真正触发 click，
    // 这里编译期改写成正确事件名。
    // normalize click.right and click.middle since they don't actually fire
    if (nonKeyModifiers.includes('right')) {
      key = transformClick(key, `onContextmenu`)
    }
    if (nonKeyModifiers.includes('middle')) {
      key = transformClick(key, `onMouseup`)
    }

    if (nonKeyModifiers.length) {
      // stop / prevent / self / ctrl 等这类修饰符无法仅靠改事件名表达，
      // 必须在运行时包装原 handler。
      // 非键盘修饰符通过 withModifiers(handler, [...]) 在运行时包装。
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(nonKeyModifiers),
      ])
    }

    if (
      keyModifiers.length &&
      // if event name is dynamic, always wrap with keys guard
      (!isStaticExp(key) || isKeyboardEvent(key.content.toLowerCase()))
    ) {
      // enter / esc / left 这类键盘过滤逻辑通过 withKeys 包装。
      // 键盘修饰符只对键盘事件生效；动态事件名则保守包装。
      handlerExp = createCallExpression(context.helper(V_ON_WITH_KEYS), [
        handlerExp,
        JSON.stringify(keyModifiers),
      ])
    }

    if (eventOptionModifiers.length) {
      // once / capture / passive 不包 handler，而是直接编码进事件 prop key，
      // 后续运行时 patchEvent 会据此拆回 addEventListener 选项。
      // once / capture / passive 通过拼接事件名后缀编码进 prop key。
      const modifierPostfix = eventOptionModifiers.map(capitalize).join('')
      key = isStaticExp(key)
        ? createSimpleExpression(`${key.content}${modifierPostfix}`, true)
        : createCompoundExpression([`(`, key, `) + "${modifierPostfix}"`])
    }

    return {
      // 返回最终唯一的事件属性。
      props: [createObjectProperty(key, handlerExp)],
    }
  })
}
