/**
 * 文件作用：处理运行时 attribute 写入。
 *
 * 这份文件负责那些“不适合走 DOM property”的字段更新，
 * 例如：
 * - 普通 HTML attribute
 * - SVG attribute
 * - `xlink:*` 命名空间属性
 * - 兼容模式下的枚举 attribute / false 值处理
 */

import {
  NOOP,
  includeBooleanAttr,
  isSpecialBooleanAttr,
  isSymbol,
  makeMap,
} from '@vue-source/shared'
import {
  type ComponentInternalInstance,
  DeprecationTypes,
  compatUtils,
} from '@vue-source/runtime-core'

// xlink 命名空间用于 SVG 的链接类属性，例如 `xlink:href`。
export const xlinkNS = 'http://www.w3.org/1999/xlink'

/**
 * 作用：把应当走 HTML/SVG attribute 的值同步到真实元素。
 */
export function patchAttr(
  el: Element,
  key: string,
  value: any,
  isSVG: boolean,
  instance?: ComponentInternalInstance | null,
  isBoolean: boolean = isSpecialBooleanAttr(key),
): void {
  /**
   * 把一个字段按 attribute 语义同步到真实元素。
   *
   * 主要功能：
   * - 处理普通 attribute 的新增、更新、删除
   * - 处理 SVG `xlink:*` 命名空间属性
   * - 处理存在型布尔 attribute
   * - compat 模式下保留 Vue 2 的部分 attribute 强制转换行为
   *
   * 参数：
   * - `el`：目标元素
   * - `key`：attribute 名
   * - `value`：新值
   * - `isSVG`：是否为 SVG 元素
   * - `instance`：当前组件实例，兼容告警链路会用到
   * - `isBoolean`：当前字段是否属于特殊布尔 attribute
   */
  if (isSVG && key.startsWith('xlink:')) {
    // SVG 的 xlink 属性需要写入命名空间，而不是普通 attribute。
    if (value == null) {
      // 删除时要按命名空间删除，否则浏览器可能留下无效残影。
      el.removeAttributeNS(xlinkNS, key.slice(6, key.length))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    if (__COMPAT__ && compatCoerceAttr(el, key, value, instance)) {
      return
    }

    // 这里处理的是没有对应 DOM prop 的布尔 attribute，例如存在型 attribute。
    if (value == null || (isBoolean && !includeBooleanAttr(value))) {
      // attribute 语义下“不存在”比“值为空”更接近布尔/空值场景的真实浏览器行为。
      el.removeAttribute(key)
    } else {
      // 浏览器层的 attribute 最终都会被序列化为字符串。
      el.setAttribute(
        key,
        isBoolean ? '' : isSymbol(value) ? String(value) : value,
      )
    }
  }
}

// 兼容模式下，枚举 attribute 需要保留 Vue 2 的强制字符串化行为。
const isEnumeratedAttr = __COMPAT__
  ? /*@__PURE__*/ makeMap('contenteditable,draggable,spellcheck')
  : NOOP

/**
 * 作用：处理 Vue 2 到 Vue 3 的 attribute 兼容行为。
 */
export function compatCoerceAttr(
  el: Element,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance | null = null,
): boolean {
  /**
   * 处理 Vue 2 到 Vue 3 的 attribute 兼容强制转换。
   *
   * 返回值语义：
   * - `true`：本函数已经完成写入，外层不必再继续处理
   * - `false`：外层按 Vue 3 正常 attribute 逻辑继续
   */
  if (isEnumeratedAttr(key)) {
    // Vue 2 对枚举 attribute 会强制收敛成 `'true'/'false'` 字符串，这里仅在 compat 下保留。
    const v2CoercedValue =
      value === undefined
        ? null
        : value === null || value === false || value === 'false'
          ? 'false'
          : 'true'
    if (
      v2CoercedValue &&
      compatUtils.softAssertCompatEnabled(
        DeprecationTypes.ATTR_ENUMERATED_COERCION,
        instance,
        key,
        value,
        v2CoercedValue,
      )
    ) {
      el.setAttribute(key, v2CoercedValue)
      return true
    }
  } else if (
    value === false &&
    !(el.tagName === 'INPUT' && key === 'value') &&
    !isSpecialBooleanAttr(key) &&
    compatUtils.isCompatEnabled(DeprecationTypes.ATTR_FALSE_VALUE, instance)
  ) {
    // Vue 2 里部分普通 attribute 传 false 会直接移除；Vue 3 标准语义已不再这样处理。
    compatUtils.warnDeprecation(
      DeprecationTypes.ATTR_FALSE_VALUE,
      instance,
      key,
    )
    el.removeAttribute(key)
    return true
  }
  return false
}
