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
  // 第三个参数把“当前是否正处于 SSR 组件 setup”透传给 reactivity 层，
  // 这样 computed 在服务端渲染时可以采用与普通客户端不同的求值策略。
  // @ts-expect-error
  const c = _computed(getterOrOptions, debugOptions, isInSSRComponentSetup)

  return c as any
}
