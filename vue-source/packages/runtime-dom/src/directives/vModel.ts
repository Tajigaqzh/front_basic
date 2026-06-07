/**
 * 文件作用：实现浏览器环境下的 `v-model` 指令。
 *
 * 这份文件负责把“响应式状态 <-> 表单控件值”双向同步起来，
 * 并针对 text / checkbox / radio / select 等不同控件提供各自的细化处理。
 *
 * 从运行时主链路看：
 * - 编译阶段会把 `v-model` 转成对应 prop + 事件监听约定
 * - patch 过程中命中指令后，会进入这里的具体实现
 * - 这里再根据表单类型决定如何回填 DOM、如何把用户输入同步回状态
 */

import {
  type DirectiveBinding,
  type DirectiveHook,
  type ObjectDirective,
  type VNode,
  nextTick,
  warn,
} from '@vue-source/runtime-core'
import { addEventListener } from '../modules/events'
import {
  invokeArrayFns,
  isArray,
  isSet,
  looseEqual,
  looseIndexOf,
  looseToNumber,
} from '@vue-source/shared'

type AssignerFn = (value: any) => void

/**
 * 作用：从 vnode props 中取出本次 `v-model` 对应的赋值函数。
 */
const getModelAssigner = (vnode: VNode): AssignerFn => {
  // `onUpdate:modelValue` 是编译后双向绑定的统一回写入口。
  // compat 模式下还要兼容旧版 `input` 事件风格。
  const fn =
    vnode.props!['onUpdate:modelValue'] ||
    (__COMPAT__ && vnode.props!['onModelCompat:input'])
  return isArray(fn) ? value => invokeArrayFns(fn, value) : fn
}

// 输入法开始组合输入时，先标记 composing，避免中途把未确认的文字同步出去。
function onCompositionStart(e: Event) {
  ;(e.target as any).composing = true
}

// 输入法结束时手动补发一次 input，让 v-model 能拿到最终确认的值。
function onCompositionEnd(e: Event) {
  const target = e.target as any
  if (target.composing) {
    target.composing = false
    target.dispatchEvent(new Event('input'))
  }
}

const assignKey: unique symbol = Symbol('_assign')
// 每个参与 v-model 的表单元素都会临时挂一个 assigner，
// 指向“把最新用户输入回写给组件状态”的统一入口函数。

type ModelDirective<T, Modifiers extends string = string> = ObjectDirective<
  T & { [assignKey]: AssignerFn; _assigning?: boolean },
  any,
  Modifiers
>

/**
 * 作用：根据 `trim` / `number` 修饰符把输入值转换成最终模型值。
 */
function castValue(value: string, trim?: boolean, number?: boolean | null) {
  /**
   * 归一化输入框的原始字符串值。
   *
   * 主要功能：
   * - `trim`：去掉首尾空白
   * - `number`：把字符串尽量转成数字
   */
  if (trim) value = value.trim()
  if (number) value = looseToNumber(value)
  return value
}

/**
 * 作用：处理文本输入框和 textarea 的 `v-model`。
 */
export const vModelText: ModelDirective<
  HTMLInputElement | HTMLTextAreaElement,
  'trim' | 'number' | 'lazy'
> = {
  /**
   * 文本类控件的 `v-model`。
   *
   * 支持：
   * - `<input>`
   * - `<textarea>`
   * - `trim / number / lazy` 修饰符
   */
  created(el, { modifiers: { lazy, trim, number } }, vnode) {
    el[assignKey] = getModelAssigner(vnode)
    // `castToNumber` 除了显式 `number` 修饰符，也兼容 `<input type="number">`。
    const castToNumber =
      number || (vnode.props && vnode.props.type === 'number')
    addEventListener(el, lazy ? 'change' : 'input', e => {
      // 输入法组合期间的中间态文本不应立刻同步到模型，否则中文输入会出现抖动/错乱。
      if ((e.target as any).composing) return
      el[assignKey](castValue(el.value, trim, castToNumber))
    })
    if (trim || castToNumber) {
      addEventListener(el, 'change', () => {
        // change 时顺手把 DOM 输入框里的显示值也规范掉，确保视图与模型完全一致。
        el.value = castValue(el.value, trim, castToNumber)
      })
    }
    if (!lazy) {
      addEventListener(el, 'compositionstart', onCompositionStart)
      addEventListener(el, 'compositionend', onCompositionEnd)
      // 某些浏览器切焦点时不会触发 compositionend，需要用 change 再兜底一次。
      addEventListener(el, 'change', onCompositionEnd)
    }
  },
  // range 输入框的 min/max 会影响 value，挂载后再写值更稳妥。
  mounted(el, { value }) {
    el.value = value == null ? '' : value
  },
  beforeUpdate(
    el,
    { value, oldValue, modifiers: { lazy, trim, number } },
    vnode,
  ) {
    el[assignKey] = getModelAssigner(vnode)
    // 输入法组合中的值尚未确认，不能提前覆盖输入框内容。
    if ((el as any).composing) return
    // `elValue` 表示当前 DOM 里的实际值。
    // number 场景要先尽量转成数字，才能和新模型值做更准确比较。
    const elValue =
      (number || el.type === 'number') && !/^0\d/.test(el.value)
        ? looseToNumber(el.value)
        : el.value
    const newValue = value == null ? '' : value

    if (elValue === newValue) {
      // DOM 当前值与模型值一致时无需重写，避免打断光标位置和原生输入体验。
      return
    }

    const rootNode = el.getRootNode()
    if (
      (rootNode instanceof Document || rootNode instanceof ShadowRoot) &&
      rootNode.activeElement === el &&
      el.type !== 'range'
    ) {
      // #8546
      if (lazy && value === oldValue) {
        return
      }
      if (trim && el.value.trim() === newValue) {
        return
      }
    }

    el.value = newValue
  },
}

export const vModelCheckbox: ModelDirective<HTMLInputElement> = {
  // 复选框绑定数组 / Set 时，需要深度追踪内部项变化。
  deep: true,
  created(el, _, vnode) {
    el[assignKey] = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      // `_modelValue` 保存的是最近一次渲染写入到当前 checkbox 这一组上的模型值。
      // change 时直接读取它，就能知道现在应该往数组 / Set / 布尔值哪个方向回写。
      const modelValue = (el as any)._modelValue
      const elementValue = getValue(el)
      const checked = el.checked
      const assign = el[assignKey]
      if (isArray(modelValue)) {
        const index = looseIndexOf(modelValue, elementValue)
        const found = index !== -1
        if (checked && !found) {
          // 数组模型选中时追加值，保持不可变更新语义。
          assign(modelValue.concat(elementValue))
        } else if (!checked && found) {
          const filtered = [...modelValue]
          filtered.splice(index, 1)
          assign(filtered)
        }
      } else if (isSet(modelValue)) {
        const cloned = new Set(modelValue)
        if (checked) {
          // Set 模型要保留 Set 语义，不能降级成数组。
          cloned.add(elementValue)
        } else {
          cloned.delete(elementValue)
        }
        assign(cloned)
      } else {
        assign(getCheckboxValue(el, checked))
      }
    })
  },
  // 初始 checked 放到 mounted，确保 true-value / false-value 已准备好。
  mounted: setChecked,
  beforeUpdate(el, binding, vnode) {
    el[assignKey] = getModelAssigner(vnode)
    setChecked(el, binding, vnode)
  },
}

/**
 * 作用：根据当前模型值计算 checkbox 的勾选状态。
 */
function setChecked(
  el: HTMLInputElement,
  { value, oldValue }: DirectiveBinding,
  vnode: VNode,
) {
  /**
   * 同步 checkbox 的 `checked` 状态。
   *
   * 主要功能：
   * - 兼容数组模型
   * - 兼容 Set 模型
   * - 兼容 `true-value / false-value`
   */
  // 把模型值临时挂到元素上，change 事件回调里会直接读取它。
  ;(el as any)._modelValue = value
  let checked: boolean

  if (isArray(value)) {
    checked = looseIndexOf(value, vnode.props!.value) > -1
  } else if (isSet(value)) {
    checked = value.has(vnode.props!.value)
  } else {
    if (value === oldValue) return
    checked = looseEqual(value, getCheckboxValue(el, true))
  }

  // 只有在状态真的变化时才写 DOM，避免无意义刷新。
  if (el.checked !== checked) {
    el.checked = checked
  }
}

/**
 * 作用：处理 radio 的 `v-model`。
 */
export const vModelRadio: ModelDirective<HTMLInputElement> = {
  /**
   * radio 的 `v-model`。
   *
   * 原理：
   * - 渲染时比较当前 radio 的 value 和模型值是否相等
   * - change 时把当前 radio 的值回写给模型
   */
  created(el, { value }, vnode) {
    el.checked = looseEqual(value, vnode.props!.value)
    el[assignKey] = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      el[assignKey](getValue(el))
    })
  },
  beforeUpdate(el, { value, oldValue }, vnode) {
    el[assignKey] = getModelAssigner(vnode)
    if (value !== oldValue) {
      el.checked = looseEqual(value, vnode.props!.value)
    }
  },
}

/**
 * 作用：处理 select 的 `v-model`，兼容单选、多选、数组和 Set。
 */
export const vModelSelect: ModelDirective<HTMLSelectElement, 'number'> = {
  // 多选 select 绑定数组 / Set 时，需要深度追踪集合内容变化。
  deep: true,
  created(el, { value, modifiers: { number } }, vnode) {
    // `isSetModel` 用来保留多选 select 绑定 Set 的语义，
    // 避免 change 回写时把 Set 错误降级成数组。
    const isSetModel = isSet(value)
    addEventListener(el, 'change', () => {
      const selectedVal = Array.prototype.filter
        .call(el.options, (o: HTMLOptionElement) => o.selected)
        .map((o: HTMLOptionElement) =>
          number ? looseToNumber(getValue(o)) : getValue(o),
        )
      el[assignKey](
        el.multiple
          ? isSetModel
            ? new Set(selectedVal)
            : selectedVal
          : selectedVal[0],
      )
      el._assigning = true
      nextTick(() => {
        el._assigning = false
      })
    })
    el[assignKey] = getModelAssigner(vnode)
  },
  // select 的选中态依赖子 option，必须等子节点稳定后再同步。
  mounted(el, { value }) {
    setSelected(el, value)
  },
  beforeUpdate(el, _binding, vnode) {
    el[assignKey] = getModelAssigner(vnode)
  },
  updated(el, { value }) {
    if (!el._assigning) {
      setSelected(el, value)
    }
  },
}

/**
 * 作用：根据模型值同步 `<select>` 的选中项。
 */
function setSelected(el: HTMLSelectElement, value: any) {
  /**
   * 根据模型值回填 `<select>` 的选中项。
   *
   * 主要功能：
   * - 单选：找到第一个匹配值并写入 `selectedIndex`
   * - 多选：逐个 option 计算 `selected`
   * - 兼容数组 / Set / number 修饰符后的值比较
   */
  const isMultiple = el.multiple
  const isArrayValue = isArray(value)
  if (isMultiple && !isArrayValue && !isSet(value)) {
    __DEV__ &&
      warn(
        `<select multiple v-model> expects an Array or Set value for its binding, ` +
          `but got ${Object.prototype.toString.call(value).slice(8, -1)}.`,
      )
    return
  }

  for (let i = 0, l = el.options.length; i < l; i++) {
    const option = el.options[i]
    const optionValue = getValue(option)
    if (isMultiple) {
      if (isArrayValue) {
        const optionType = typeof optionValue
        // 字符串和数字走更快的直接比较路径。
        if (optionType === 'string' || optionType === 'number') {
          option.selected = value.some(v => String(v) === String(optionValue))
        } else {
          option.selected = looseIndexOf(value, optionValue) > -1
        }
      } else {
        // Set 模型下直接用 `has`，复杂值比较语义交给上游填入 Set 的值本身控制。
        option.selected = value.has(optionValue)
      }
    } else if (looseEqual(getValue(option), value)) {
      if (el.selectedIndex !== i) el.selectedIndex = i
      return
    }
  }
  if (!isMultiple && el.selectedIndex !== -1) {
    el.selectedIndex = -1
  }
}

/**
 * 作用：读取元素上保留的原始绑定值。
 */
function getValue(el: HTMLOptionElement | HTMLInputElement) {
  // `_value` 是 Vue 在 patch prop 时为非字符串原始值保留的旁路缓存。
  // 如果没有它，原生 DOM 只能提供字符串化后的 `el.value`。
  return '_value' in el ? (el as any)._value : el.value
}

/**
 * 作用：读取 checkbox 在 true-value / false-value 场景下应当回填的模型值。
 */
function getCheckboxValue(
  el: HTMLInputElement & { _trueValue?: any; _falseValue?: any },
  checked: boolean,
) {
  /**
   * 读取 checkbox 对应的模型回填值。
   *
   * 默认情况下：
   * - 选中回填 `true`
   * - 未选中回填 `false`
   *
   * 如果用户声明了 `true-value / false-value`，
   * 则要回填那两个自定义值。
   */
  const key = checked ? '_trueValue' : '_falseValue'
  return key in el ? el[key] : checked
}

export const vModelDynamic: ObjectDirective<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
> = {
  /**
   * 动态 `v-model` 分发器。
   *
   * 使用场景：
   * - 标签类型或 input.type 运行时才知道
   * - 需要在各个生命周期里把调用转发给真正的 text / checkbox / radio / select 实现
   */
  created(el, binding, vnode) {
    callModelHook(el, binding, vnode, null, 'created')
  },
  mounted(el, binding, vnode) {
    callModelHook(el, binding, vnode, null, 'mounted')
  },
  beforeUpdate(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, 'beforeUpdate')
  },
  updated(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, 'updated')
  },
}

/**
 * 作用：根据标签名和 input 类型选择实际要使用的 `v-model` 指令实现。
 */
function resolveDynamicModel(tagName: string, type: string | undefined) {
  // 动态分发规则本质上是在运行时复现编译阶段本来会静态决定的那张“控件类型 -> 指令实现”映射表。
  switch (tagName) {
    case 'SELECT':
      return vModelSelect
    case 'TEXTAREA':
      return vModelText
    default:
      switch (type) {
        case 'checkbox':
          return vModelCheckbox
        case 'radio':
          return vModelRadio
        default:
          return vModelText
      }
  }
}

/**
 * 作用：把动态 `v-model` 的生命周期调用转发给具体实现。
 */
function callModelHook(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | null,
  hook: keyof ObjectDirective,
) {
  /**
   * 调用动态 `v-model` 实际实现上的某个生命周期钩子。
   *
   * 参数：
   * - `el`：当前表单元素
   * - `binding`：指令绑定信息
   * - `vnode`：新 vnode
   * - `prevVNode`：旧 vnode
   * - `hook`：要转发的生命周期名，如 `created / updated`
   */
  const modelToUse = resolveDynamicModel(
    el.tagName,
    vnode.props && vnode.props.type,
  )
  const fn = modelToUse[hook] as DirectiveHook
  fn && fn(el, binding, vnode, prevVNode)
}

// SSR vnode transforms, only used when user includes client-oriented render
// function in SSR
export function initVModelForSSR(): void {
  // SSR 阶段不会真的监听输入事件，这里只需要把“首屏应呈现成什么表单状态”映射成 props。
  vModelText.getSSRProps = ({ value }) => ({ value })

  vModelRadio.getSSRProps = ({ value }, vnode) => {
    if (vnode.props && looseEqual(vnode.props.value, value)) {
      return { checked: true }
    }
  }

  vModelCheckbox.getSSRProps = ({ value }, vnode) => {
    if (isArray(value)) {
      if (vnode.props && looseIndexOf(value, vnode.props.value) > -1) {
        return { checked: true }
      }
    } else if (isSet(value)) {
      if (vnode.props && value.has(vnode.props.value)) {
        return { checked: true }
      }
    } else if (value) {
      return { checked: true }
    }
  }

  vModelDynamic.getSSRProps = (binding, vnode) => {
    if (typeof vnode.type !== 'string') {
      return
    }
    const modelToUse = resolveDynamicModel(
      // resolveDynamicModel expects an uppercase tag name, but vnode.type is lowercase
      vnode.type.toUpperCase(),
      vnode.props && vnode.props.type,
    )
    if (modelToUse.getSSRProps) {
      return modelToUse.getSSRProps(binding, vnode)
    }
  }
}

export type VModelDirective =
  | typeof vModelText
  | typeof vModelCheckbox
  | typeof vModelSelect
  | typeof vModelRadio
  | typeof vModelDynamic
