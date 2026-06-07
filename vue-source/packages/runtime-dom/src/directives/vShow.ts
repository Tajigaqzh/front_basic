/**
 * 文件作用：实现浏览器环境下的内置指令。
 *
 * 当前文件 vShow.ts 负责某个 DOM 指令的运行时行为，
 * 例如事件修饰、显示隐藏、表单双向绑定等。
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
    el[vShowOriginalDisplay] =
      el.style.display === 'none' ? '' : el.style.display
    if (transition && value) {
      transition.beforeEnter(el)
    } else {
      setDisplay(el, value)
    }
  },
  mounted(el, { value }, { transition }) {
    if (transition && value) {
      transition.enter(el)
    }
  },
  updated(el, { value, oldValue }, { transition }) {
    if (!value === !oldValue) return
    if (transition) {
      if (value) {
        transition.beforeEnter(el)
        setDisplay(el, true)
        transition.enter(el)
      } else {
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
  el.style.display = value ? el[vShowOriginalDisplay] : 'none'
  el[vShowHidden] = !value
}

/**
 * 作用：给 SSR 场景补上 `v-show` 的服务端属性生成逻辑。
 */
export function initVShowForSSR(): void {
  vShow.getSSRProps = ({ value }) => {
    if (!value) {
      return { style: { display: 'none' } }
    }
  }
}
