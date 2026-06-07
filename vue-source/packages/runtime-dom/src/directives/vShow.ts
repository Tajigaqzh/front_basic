/**
 * 文件作用：实现浏览器环境下的内置指令。
 *
 * 当前文件 vShow.ts 专门负责 `v-show` 的运行时行为。
 *
 * 它和 `v-if` 的区别是：
 * - `v-if` 通过创建/卸载节点控制显示
 * - `v-show` 始终保留节点，只切换 `display`
 */

import type { ObjectDirective } from '@vue-source/runtime-core'

// 记录元素原始 display，`v-show` 切回显示态时需要恢复它。
export const vShowOriginalDisplay: unique symbol = Symbol('_vod')
// 记录当前元素是否处于 `v-show` 隐藏态，style patch 时要和它协同。
export const vShowHidden: unique symbol = Symbol('_vsh')

export interface VShowElement extends HTMLElement {
  // `_vod` 保存元素在第一次挂载前的 display 值。
  [vShowOriginalDisplay]: string
  // `_vsh` 表示当前是否被 `v-show` 隐藏。
  [vShowHidden]: boolean
}

/**
 * 作用：实现 `v-show` 的浏览器运行时逻辑。
 *
 * 核心思路：
 * - 不销毁节点，只切换 `style.display`。
 * - 如果当前节点还包着 Transition，就把显示隐藏交给过渡钩子控制。
 */
export const vShow: ObjectDirective<VShowElement> & { name: 'show' } = {
  // 给 hydration / 指令识别链路使用的名称。
  name: 'show',
  beforeMount(el, { value }, { transition }) {
    // 第一次挂载时先记住元素原始 display，后续从隐藏恢复时要回到这个值而不是一律用空串。
    el[vShowOriginalDisplay] =
      el.style.display === 'none' ? '' : el.style.display
    if (transition && value) {
      // 初次显示且包着 Transition 时，显示时机交给过渡钩子控制。
      transition.beforeEnter(el)
    } else {
      setDisplay(el, value)
    }
  },
  mounted(el, { value }, { transition }) {
    if (transition && value) {
      // beforeMount 只做进入前准备，真正的 enter 在 mounted 后执行更符合过渡时机。
      transition.enter(el)
    }
  },
  updated(el, { value, oldValue }, { transition }) {
    // 新旧值同为 truthy 或 falsy 时，无需重复切 display。
    if (!value === !oldValue) return
    if (transition) {
      if (value) {
        transition.beforeEnter(el)
        setDisplay(el, true)
        transition.enter(el)
      } else {
        // 隐藏态在 leave 结束后再真正设成 `display:none`，这样离场动画才能看到。
        transition.leave(el, () => {
          setDisplay(el, false)
        })
      }
    } else {
      setDisplay(el, value)
    }
  },
  beforeUnmount(el, { value }) {
    setDisplay(el, value)
  },
}

/**
 * 作用：根据布尔值切换元素 display，并同步隐藏标记。
 */
function setDisplay(el: VShowElement, value: unknown): void {
  // `v-show` 不销毁节点，只维护 display；同时额外同步 `_vsh` 供 style patch 协同判断。
  el.style.display = value ? el[vShowOriginalDisplay] : 'none'
  el[vShowHidden] = !value
}

/**
 * 作用：给 SSR 场景补上 `v-show` 的服务端属性生成逻辑。
 */
export function initVShowForSSR(): void {
  // SSR 只需要决定首屏是否附带 `display:none`，不存在运行时切换动画。
  vShow.getSSRProps = ({ value }) => {
    if (!value) {
      return { style: { display: 'none' } }
    }
  }
}
