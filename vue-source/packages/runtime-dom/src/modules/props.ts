/**
 * 文件作用：处理某一类 DOM 属性写入。
 *
 * 当前文件 props.ts 专门负责一类浏览器属性更新策略，
 * 让 patchProp 可以把总分发继续下沉到更细的实现里。
 */

import { DeprecationTypes, compatUtils, warn } from '@vue-source/runtime-core'
import { includeBooleanAttr } from '@vue-source/shared'
import { unsafeToTrustedHTML } from '../nodeOps'

/**
 * 作用：把应当走 DOM Property 的值写入真实元素。
 *
 * 参数说明：
 * - `el`：当前要更新的真实 DOM 元素。
 * - `key`：待写入的属性名，例如 `value`、`innerHTML`。
 * - `value`：新的属性值。
 * - `parentComponent`：当前组件实例，主要给兼容逻辑和告警链路使用。
 * - `attrName`：当 prop 名和 attr 名不完全一致时，删除属性时使用的实际名称。
 *
 * 依赖关系：
 * - 由 `runtime-dom/patchProp.ts` 分发调用。
 * - 某些危险 HTML 写入会依赖 `unsafeToTrustedHTML` 做浏览器兼容处理。
 *
 * 链路位置：
 * - `renderer.ts -> hostPatchProp -> patchProp -> patchDOMProp`
 */
export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  parentComponent: any,
  attrName?: string,
): void {
  // 这两个字段直接决定元素内容，需要优先处理，不能走下面的通用赋值逻辑。
  if (key === 'innerHTML' || key === 'textContent') {
    // 空值场景会在上层 patchElement 中提前处理子节点清理。
    if (value != null) {
      el[key] = key === 'innerHTML' ? unsafeToTrustedHTML(value) : value
    }
    return
  }

  // `tag` 用来区分不同标签的特殊行为，例如 `option.value`、`input.value`。
  const tag = el.tagName

  if (
    key === 'value' &&
    tag !== 'PROGRESS' &&
    // custom elements may use _value internally
    !tag.includes('-')
  ) {
    // `option.value` 读取时会回退到文本内容，所以这里必须和 attribute 做比较。
    const oldValue =
      tag === 'OPTION' ? el.getAttribute('value') || '' : el.value
    const newValue =
      value == null
        ? // checkbox 的 value 在空值时要保持浏览器默认的 `on`。
          el.type === 'checkbox'
          ? 'on'
          : ''
        : String(value)
    if (oldValue !== newValue || !('_value' in el)) {
      el.value = newValue
    }
    if (value == null) {
      el.removeAttribute(key)
    }
    // `_value` 保留原始值，避免非字符串值在 DOM 上被字符串化后丢失语义。
    el._value = value
    return
  }

  // `needRemove` 表示本次虽然完成了 prop 赋值，但仍需要同步把对应 attribute 删除。
  let needRemove = false
  if (value === '' || value == null) {
    const type = typeof el[key]
    if (type === 'boolean') {
      // 布尔 prop 需要把空串视为存在型属性。
      value = includeBooleanAttr(value)
    } else if (value == null && type === 'string') {
      // 字符串 prop 在传入 null 时要写空串，再删除 attribute。
      value = ''
      needRemove = true
    } else if (type === 'number') {
      // 数字 prop 在传入空值时先写 0，随后移除 attribute。
      value = 0
      needRemove = true
    }
  } else {
    if (
      __COMPAT__ &&
      value === false &&
      compatUtils.isCompatEnabled(
        DeprecationTypes.ATTR_FALSE_VALUE,
        parentComponent,
      )
    ) {
      const type = typeof el[key]
      if (type === 'string' || type === 'number') {
        __DEV__ &&
          compatUtils.warnDeprecation(
            DeprecationTypes.ATTR_FALSE_VALUE,
            parentComponent,
            key,
          )
        value = type === 'number' ? 0 : ''
        needRemove = true
      }
    }
  }

  // 某些原生属性在赋值时会做校验，或者只有 getter 没有 setter，需要兜底 try/catch。
  try {
    el[key] = value
  } catch (e: any) {
    if (__DEV__ && !needRemove) {
      warn(
        `Failed setting prop "${key}" on <${tag.toLowerCase()}>: ` +
          `value ${value} is invalid.`,
        e,
      )
    }
  }
  // 如果这一轮被标记为“只保留 prop，不保留 attr”，最后统一删除 attribute。
  needRemove && el.removeAttribute(attrName || key)
}
