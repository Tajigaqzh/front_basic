import {
  // 指令转换器类型。
  type DirectiveTransform,
  // 标签类型枚举，用来区分原生元素和组件。
  ElementTypes,
  // AST 节点类型枚举。
  NodeTypes,
  // compiler-core 的通用 v-model 转换逻辑。
  transformModel as baseTransform,
  // 查找某个指令。
  findDir,
  // 查找某个 prop / attribute。
  findProp,
  // 判断是否存在动态 key 的 v-bind。
  hasDynamicKeyVBind,
  // 判断指令参数是否是指定的静态名称。
  isStaticArgOf,
} from '@vue-source/compiler-core'
// DOM 专属错误定义。
import { DOMErrorCodes, createDOMCompilerError } from '../errors'
import {
  // 各种不同表单元素所需的运行时 v-model helper。
  V_MODEL_CHECKBOX,
  V_MODEL_DYNAMIC,
  V_MODEL_RADIO,
  V_MODEL_SELECT,
  V_MODEL_TEXT,
} from '../runtimeHelpers'

// DOM 平台下的 v-model 转换。
export const transformModel: DirectiveTransform = (dir, node, context) => {
  // 先执行 compiler-core 的通用逻辑，例如生成 modelValue 和 onUpdate。
  const baseResult = baseTransform(dir, node, context)
  // 如果 core 阶段已经报错导致没有 props，或者当前是组件 v-model，
  // 直接返回通用结果即可，DOM 特化逻辑只处理原生元素。
  // base transform has errors OR component v-model (only need props)
  if (!baseResult.props.length || node.tagType === ElementTypes.COMPONENT) {
    return baseResult
  }

  // 原生元素上的 v-model 不允许带参数，例如 v-model:value。
  if (dir.arg) {
    context.onError(
      createDOMCompilerError(
        DOMErrorCodes.X_V_MODEL_ARG_ON_ELEMENT,
        dir.arg.loc,
      ),
    )
  }

  function checkDuplicatedValue() {
    // 查找是否额外写了 :value。
    const value = findDir(node, 'bind')
    if (value && isStaticArgOf(value.arg, 'value')) {
      // 原生 v-model 自己会处理 value，重复传递通常是误用。
      context.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_V_MODEL_UNNECESSARY_VALUE,
          value.loc,
        ),
      )
    }
  }

  // 取出当前元素标签名。
  const { tag } = node
  // 自定义元素走和 input 类似的动态兜底逻辑。
  const isCustomElement = context.isCustomElement(tag)
  if (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    isCustomElement
  ) {
    // 默认按文本输入框处理。
    let directiveToUse = V_MODEL_TEXT
    // 某些场景不允许使用 v-model，例如 file input。
    let isInvalidType = false
    if (tag === 'input' || isCustomElement) {
      // input 的关键分叉点在于 type，不同 type 需要不同运行时 helper。
      // 先看有没有显式 type。
      const type = findProp(node, `type`)
      if (type) {
        if (type.type === NodeTypes.DIRECTIVE) {
          // :type="foo"
          // 动态 type 无法在编译期判断，交给运行时动态分发。
          directiveToUse = V_MODEL_DYNAMIC
        } else if (type.value) {
          // 静态 type 可以在编译期精确选择对应 helper。
          switch (type.value.content) {
            case 'radio':
              directiveToUse = V_MODEL_RADIO
              break
            case 'checkbox':
              directiveToUse = V_MODEL_CHECKBOX
              break
            case 'file':
              // file input 是只读 value，不能和 v-model 搭配。
              isInvalidType = true
              context.onError(
                createDOMCompilerError(
                  DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT,
                  dir.loc,
                ),
              )
              break
            default:
              // text type
              // 普通文本输入框额外检查是否重复绑定了 value。
              __DEV__ && checkDuplicatedValue()
              break
          }
        }
      } else if (hasDynamicKeyVBind(node)) {
        // element has bindings with dynamic keys, which can possibly contain
        // "type".
        // 如果存在动态 key 的 v-bind，也要保守退回动态运行时处理。
        directiveToUse = V_MODEL_DYNAMIC
      } else {
        // text type
        // 没有 type 时，input 默认也是文本输入框。
        __DEV__ && checkDuplicatedValue()
      }
    } else if (tag === 'select') {
      // select 使用专门的 v-model 运行时。
      directiveToUse = V_MODEL_SELECT
    } else {
      // textarea
      // textarea 也按文本类输入处理，并检查冗余 value。
      __DEV__ && checkDuplicatedValue()
    }
    // inject runtime directive
    // by returning the helper symbol via needRuntime
    // the import will replaced a resolveDirective call.
    if (!isInvalidType) {
      // 告诉 codegen 注入对应运行时 helper。
      // 这里不是直接把 helper 调用写进 props，而是通过 needRuntime
      // 让 codegen 在 vnode 指令列表里补对应运行时指令。
      baseResult.needRuntime = context.helper(directiveToUse)
    }
  } else {
    // 其余原生元素不支持 v-model。
    context.onError(
      createDOMCompilerError(
        DOMErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT,
        dir.loc,
      ),
    )
  }

  // native vmodel doesn't need the `modelValue` props since they are also
  // passed to the runtime as `binding.value`. removing it reduces code size.
  // 原生元素的 v-model 会通过运行时 binding.value 取值，不需要再保留 modelValue prop。
  baseResult.props = baseResult.props.filter(
    p =>
      !(
        p.key.type === NodeTypes.SIMPLE_EXPRESSION &&
        p.key.content === 'modelValue'
      ),
  )

  // 返回 DOM 平台特化后的转换结果。
  return baseResult
}
