/**
 * 文件作用：处理某一类 DOM 属性写入。
 *
 * 当前文件 class.ts 专门负责一类浏览器属性更新策略，
 * 让 patchProp 可以把总分发继续下沉到更细的实现里。
 */

import { type ElementWithTransition, vtcKey } from '../components/Transition'

/**
 * 作用：把 class 字符串同步到真实元素。
 *
 * 参数说明：
 * - `el`：目标元素。
 * - `value`：规范化后的 class 字符串。
 * - `isSVG`：是否为 SVG 元素，SVG 需要走 attribute 写入。
 *
 * 依赖关系：
 * - 由 `patchProp` 在 key 为 `class` 时调用。
 * - 若元素正参与 Transition，还需要把临时过渡类名拼回最终 class。
 */
export function patchClass(
  el: Element,
  value: string | null,
  isSVG: boolean,
): void {
  // 过渡中的元素会临时挂一组 class，这里要和用户 class 一起合并。
  const transitionClasses = (el as ElementWithTransition)[vtcKey]
  if (transitionClasses) {
    value = (
      value ? [value, ...transitionClasses] : [...transitionClasses]
    ).join(' ')
  }
  if (value == null) {
    el.removeAttribute('class')
  } else if (isSVG) {
    // SVG 没有普通 HTML 那样稳定的 `className` 语义，统一走 attribute。
    el.setAttribute('class', value)
  } else {
    el.className = value
  }
}
