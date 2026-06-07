/**
 * 文件作用：DOM 属性更新总分发器。
 *
 * 这份文件负责根据 key 的语义，把更新分发到 class、style、events、props、attrs 等不同模块。
 *
 * 在浏览器渲染链路里，它相当于“DOM 元素属性更新的总路由入口”。
 */

import { patchClass } from './modules/class'
import { patchStyle } from './modules/style'
import { patchAttr } from './modules/attrs'
import { patchDOMProp } from './modules/props'
import { patchEvent } from './modules/events'
import {
  camelize,
  isFunction,
  isModelListener,
  isOn,
  isString,
} from '@vue-source/shared'
import type { RendererOptions } from '@vue-source/runtime-core'
import type { VueElement } from './apiCustomElement'

/**
 * 判断当前字段是否是浏览器原生小写事件属性。
 *
 * 例如：
 * - `onclick`
 * - `onmousedown`
 */
const isNativeOn = (key: string) =>
  key.charCodeAt(0) === 111 /* o */ &&
  key.charCodeAt(1) === 110 /* n */ &&
  // lowercase letter
  key.charCodeAt(2) > 96 &&
  key.charCodeAt(2) < 123
// 这里特意只识别小写原生事件属性，目的是区分：
// - `onclick` 这类浏览器原生 prop
// - `onClick` 这类 Vue 组件监听器命名风格

type DOMRendererOptions = RendererOptions<Node, Element>

/**
 * DOM 属性更新总入口。
 *
 * 主要功能：
 * - 根据 key 的语义把更新分发到 class、style、event、prop、attr 等不同路径
 * - 处理表单元素和自定义元素的特殊情况
 */
export const patchProp: DOMRendererOptions['patchProp'] = (
  el,
  key,
  prevValue,
  nextValue,
  namespace,
  parentComponent,
) => {
  /**
   * DOM 属性更新总分发器。
   *
   * 主要功能：
   * - 按 key 语义把更新路由到 class / style / events / props / attrs
   * - 处理 SVG、表单字段、自定义元素等特殊分支
   *
   * 参数：
   * - `el`：目标元素
   * - `key`：当前要更新的字段名
   * - `prevValue`：旧值
   * - `nextValue`：新值
   * - `namespace`：命名空间，用来区分 HTML / SVG / MathML
   * - `parentComponent`：当前父组件实例，事件错误处理等场景会用到
   */
  const isSVG = namespace === 'svg'
  if (key === 'class') {
    patchClass(el, nextValue, isSVG)
  } else if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    // ignore v-model listeners
    if (!isModelListener(key)) {
      // 原生 DOM 事件统一下沉到 events 模块；`v-model` 生成的组件监听器不应落到这里。
      patchEvent(el, key, prevValue, nextValue, parentComponent)
    }
  } else if (
    key[0] === '.'
      ? ((key = key.slice(1)), true)
      : key[0] === '^'
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, nextValue, isSVG)
  ) {
    // `.` 前缀表示强制按 DOM prop 写入，`^` 前缀表示强制按 attribute 写入。
    // 否则交给 `shouldSetAsProp()` 根据平台规则决定。
    patchDOMProp(el, key, nextValue, parentComponent)
    // #6007 also set form state as attributes so they work with
    // <input type="reset"> or libs / extensions that expect attributes
    // #11163 custom elements may use value as an prop and set it as object
    if (
      !el.tagName.includes('-') &&
      (key === 'value' || key === 'checked' || key === 'selected')
    ) {
      // 表单状态除了写 prop，还额外补 attribute，兼容 reset 和某些依赖 attribute 的外部库。
      patchAttr(el, key, nextValue, isSVG, parentComponent, key !== 'value')
    }
  } else if (
    // #11081 force set props for possible async custom element
    (el as VueElement)._isVueCE &&
    // #12408 check if it's declared prop or it's async custom element
    (shouldSetAsPropForVueCE(el as VueElement, key) ||
      // @ts-expect-error _def is private
      ((el as VueElement)._def.__asyncLoader &&
        (/[A-Z]/.test(key) || !isString(nextValue))))
  ) {
    // Vue 自定义元素声明过的 props 应直接走组件 prop 语义，而不是普通 attribute 字符串语义。
    patchDOMProp(el, camelize(key), nextValue, parentComponent, key)
  } else {
    // special case for <input v-model type="checkbox"> with
    // :true-value & :false-value
    // store value as dom properties since non-string values will be
    // stringified.
    if (key === 'true-value') {
      // checkbox 的 true/false-value 可能是任意类型，必须缓存原值，不能只保留 attribute 字符串。
      ;(el as any)._trueValue = nextValue
    } else if (key === 'false-value') {
      ;(el as any)._falseValue = nextValue
    }
    patchAttr(el, key, nextValue, isSVG, parentComponent)
  }
}

/**
 * 判断当前字段是否应当按 DOM property 写入。
 *
 * 这个判断很关键，因为浏览器里并不是所有字段都适合 `el[key] = value`。
 */
function shouldSetAsProp(
  el: Element,
  key: string,
  value: unknown,
  isSVG: boolean,
) {
  /**
   * 判断某个字段本次是否应当走 `el[key] = value`。
   *
   * 为什么不能一律走 prop：
   * - 有些字段在 DOM property 上会产生错误类型转换
   * - 有些字段是只读的
   * - 有些字段在 SVG 或特定标签上只能作为 attribute 生效
   */
  // SVG 大多数字段都必须走 attribute；只有极少数如 innerHTML/textContent/原生事件例外。
  if (isSVG) {
    // most keys must be set as attribute on svg elements to work
    // ...except innerHTML & textContent
    if (key === 'innerHTML' || key === 'textContent') {
      return true
    }
    // or native onclick with function values
    if (key in el && isNativeOn(key) && isFunction(value)) {
      return true
    }
    return false
  }

  // these are enumerated attrs, however their corresponding DOM properties
  // are actually booleans - this leads to setting it with a string "false"
  // value leading it to be coerced to `true`, so we need to always treat
  // them as attributes.
  // Note that `contentEditable` doesn't have this problem: its DOM
  // property is also enumerated string values.
  if (
    key === 'spellcheck' ||
    key === 'draggable' ||
    key === 'translate' ||
    key === 'autocorrect'
  ) {
    return false
  }

  // #13946 iframe.sandbox should always be set as attribute since setting
  // the property to null results in 'null' string, and setting to empty string
  // enables the most restrictive sandbox mode instead of no sandboxing.
  if (key === 'sandbox' && el.tagName === 'IFRAME') {
    return false
  }

  // #1787, #2840 form property on form elements is readonly and must be set as
  // attribute.
  if (key === 'form') {
    return false
  }

  // #1526 <input list> must be set as attribute
  if (key === 'list' && el.tagName === 'INPUT') {
    return false
  }

  // #2766 <textarea type> must be set as attribute
  if (key === 'type' && el.tagName === 'TEXTAREA') {
    return false
  }

  // #8780 the width or height of embedded tags must be set as attribute
  if (key === 'width' || key === 'height') {
    const tag = el.tagName
    if (
      tag === 'IMG' ||
      tag === 'VIDEO' ||
      tag === 'CANVAS' ||
      tag === 'SOURCE'
    ) {
      return false
    }
  }

  // native onclick with string value, must be set as attribute
  if (isNativeOn(key) && isString(value)) {
    // 原生 `onclick="..."` 字符串属于 attribute 语义，直接设 prop 会产生不一致行为。
    return false
  }

  return key in el
}

/**
 * 判断自定义元素上的字段是否应当按 prop 处理。
 */
function shouldSetAsPropForVueCE(el: VueElement, key: string) {
  /**
   * 判断 Vue 自定义元素上的字段是否应按 prop 写入。
   *
   * 原因：
   * - 自定义元素既可能接受 attribute，也可能声明真正的组件 props
   * - 这里需要对照其 props 定义，决定是否走 prop 分支
   */
  const props = // @ts-expect-error _def is private
    el._def.props as Record<string, unknown> | string[] | undefined
  if (!props) {
    return false
  }

  const camelKey = camelize(key)
  // 这里做 camelize，是为了兼容模板里 kebab-case 与组件 props camelCase 的命名差异。
  return Array.isArray(props)
    ? props.some(prop => camelize(prop) === camelKey)
    : Object.keys(props).some(prop => camelize(prop) === camelKey)
}
