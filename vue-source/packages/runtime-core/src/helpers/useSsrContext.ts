/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 useSsrContext.ts 负责暴露 SSR 渲染上下文读取入口。
 *
 * 它本质上是对 `inject(ssrContextKey)` 的薄封装，
 * 方便服务端渲染期间在 setup 中取到当前请求级上下文。
 */

import { inject } from '../apiInject'
import { warn } from '../warning'

export const ssrContextKey: unique symbol = Symbol.for('v-scx')

/**
 * 作用：返回当前组件所在 SSR 渲染链路注入的上下文对象。
 *
 * 调用前提：
 * - 仅应在服务端构建产物里使用
 * - 仅应在存在当前组件实例的 setup / render 相关链路里调用
 */
export const useSSRContext = <T = Record<string, any>>(): T | undefined => {
  if (!__GLOBAL__) {
    const ctx = inject<T>(ssrContextKey)
    if (!ctx) {
      __DEV__ &&
        warn(
          `Server rendering context not provided. Make sure to only call ` +
            `useSSRContext() conditionally in the server build.`,
        )
    }
    return ctx
  } else if (__DEV__) {
    warn(`useSSRContext() is not supported in the global build.`)
  }
}
