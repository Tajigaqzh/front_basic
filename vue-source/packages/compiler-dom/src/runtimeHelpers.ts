// 向 compiler-core 注册“编译期符号 -> 运行时 helper 名称”的映射。
import { registerRuntimeHelpers } from '@vue-source/compiler-core'

// 以下 symbol 都是编译阶段内部使用的唯一标识。
// 生成代码时不会直接输出 symbol，而是通过映射解析成真实运行时 helper 名称。
export const V_MODEL_RADIO: unique symbol = Symbol(__DEV__ ? `vModelRadio` : ``)
export const V_MODEL_CHECKBOX: unique symbol = Symbol(
  __DEV__ ? `vModelCheckbox` : ``,
)
export const V_MODEL_TEXT: unique symbol = Symbol(__DEV__ ? `vModelText` : ``)
export const V_MODEL_SELECT: unique symbol = Symbol(
  __DEV__ ? `vModelSelect` : ``,
)
export const V_MODEL_DYNAMIC: unique symbol = Symbol(
  __DEV__ ? `vModelDynamic` : ``,
)

export const V_ON_WITH_MODIFIERS: unique symbol = Symbol(
  __DEV__ ? `vOnModifiersGuard` : ``,
)
export const V_ON_WITH_KEYS: unique symbol = Symbol(
  __DEV__ ? `vOnKeysGuard` : ``,
)

export const V_SHOW: unique symbol = Symbol(__DEV__ ? `vShow` : ``)

export const TRANSITION: unique symbol = Symbol(__DEV__ ? `Transition` : ``)
export const TRANSITION_GROUP: unique symbol = Symbol(
  __DEV__ ? `TransitionGroup` : ``,
)

// 注册后，codegen 遇到这些 helper symbol 就知道应该导入哪个运行时名字。
registerRuntimeHelpers({
  // input[type=radio] 的 v-model 运行时。
  [V_MODEL_RADIO]: `vModelRadio`,
  // checkbox 的 v-model 运行时。
  [V_MODEL_CHECKBOX]: `vModelCheckbox`,
  // 文本输入框 / textarea 的 v-model 运行时。
  [V_MODEL_TEXT]: `vModelText`,
  // select 的 v-model 运行时。
  [V_MODEL_SELECT]: `vModelSelect`,
  // 动态 type 或自定义元素时的兜底 v-model 运行时。
  [V_MODEL_DYNAMIC]: `vModelDynamic`,
  // 事件修饰符包装函数。
  [V_ON_WITH_MODIFIERS]: `withModifiers`,
  // 按键修饰符包装函数。
  [V_ON_WITH_KEYS]: `withKeys`,
  // v-show 运行时指令。
  [V_SHOW]: `vShow`,
  // 内置 Transition 组件。
  [TRANSITION]: `Transition`,
  // 内置 TransitionGroup 组件。
  [TRANSITION_GROUP]: `TransitionGroup`,
})
