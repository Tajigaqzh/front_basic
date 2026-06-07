/**
 * 文件作用：初始化运行时特性开关。
 *
 * 这份文件主要服务于 esm-bundler 构建：
 * - 如果 bundler 已经在编译期注入特性常量，这里几乎什么都不做
 * - 如果没有注入，这里会补默认值并在开发环境给出提醒
 */

import { getGlobalThis } from '@vue-source/shared'

/**
 * 作用：初始化 esm-bundler 构建下的运行时特性开关。
 *
 * 设计目的：
 * - 避免 `runtime-core` 在 import 时就产生副作用。
 * - 由渲染器创建阶段再懒执行一次。
 * - 如果 bundler 没注入编译期常量，就在运行时补默认值并给出告警。
 */
export function initFeatureFlags(): void {
  // `needWarn` 收集本次缺失的编译期开关，最后统一打一条告警。
  const needWarn = []

  if (typeof __FEATURE_OPTIONS_API__ !== 'boolean') {
    __DEV__ && needWarn.push(`__VUE_OPTIONS_API__`)
    getGlobalThis().__VUE_OPTIONS_API__ = true
  }

  if (typeof __FEATURE_PROD_DEVTOOLS__ !== 'boolean') {
    __DEV__ && needWarn.push(`__VUE_PROD_DEVTOOLS__`)
    getGlobalThis().__VUE_PROD_DEVTOOLS__ = false
  }

  if (typeof __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__ !== 'boolean') {
    __DEV__ && needWarn.push(`__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`)
    getGlobalThis().__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false
  }

  if (__DEV__ && needWarn.length) {
    const multi = needWarn.length > 1
    console.warn(
      `Feature flag${multi ? `s` : ``} ${needWarn.join(', ')} ${
        multi ? `are` : `is`
      } not explicitly defined. You are running the esm-bundler build of Vue, ` +
        `which expects these compile-time feature flags to be globally injected ` +
        `via the bundler config in order to get better tree-shaking in the ` +
        `production bundle.\n\n` +
        `For more details, see https://link.vuejs.org/feature-flags.`,
    )
  }
}
