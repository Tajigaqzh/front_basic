/**
 * 文件作用：为 runtime-core 暴露 `computed` API。
 *
 * 这份文件是运行时层对响应式 `computed` 的一层薄封装，
 * 让组件运行时可以按自己的上下文传入 SSR 相关信息。
 */

import { computed as _computed } from '@vue-source/reactivity'
import { isInSSRComponentSetup } from './component'

export const computed: typeof _computed = (
  getterOrOptions: any,
  debugOptions?: any,
) => {
  /**
   * 对 reactivity 层 `computed()` 的运行时薄封装。
   *
   * 主要功能：
   * - 复用响应式系统的 computed 实现
   * - 额外把“当前是否处于 SSR 组件 setup”透传下去
   *
   * 参数：
   * - `getterOrOptions`：getter 或带 get/set 的配置对象
   * - `debugOptions`：调试选项
   */
  // 第三个参数把“当前是否正处于 SSR 组件 setup”透传给 reactivity 层，
  // 这样 computed 在服务端渲染时可以采用与普通客户端不同的求值策略。
  // @ts-expect-error
  const c = _computed(getterOrOptions, debugOptions, isInSSRComponentSetup)

  return c as any
}
