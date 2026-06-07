/**
 * 文件作用：处理运行时 `class` 更新。
 *
 * `class` 看起来只是一个普通字段，但在运行时里有几处特殊性：
 * - HTML 元素通常走 `className`
 * - SVG 元素要走 attribute
 * - 过渡中的节点还要把 Transition 临时类名一起拼回去
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
  /**
   * 同步元素的 class。
   *
   * 主要功能：
   * - 合并 Transition 暂存的过渡类名
   * - 对空值执行删除
   * - 根据 HTML / SVG 差异选择 `className` 或 attribute 写入
   */
  // 过渡中的元素会临时挂一组 class，这里要和用户 class 一起合并。
  const transitionClasses = (el as ElementWithTransition)[vtcKey]
  if (transitionClasses) {
    // 过渡类名和用户 class 都需要同时存在，否则过渡中途普通 patch 会把动画 class 冲掉。
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
