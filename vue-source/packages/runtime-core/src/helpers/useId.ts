/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 useId.ts 负责给组件生成稳定、可预测、可在 SSR/CSR 对齐的唯一 id。
 *
 * 它不直接参与 patch，但会被组件 setup 链路调用，
 * 最终服务于表单关联、aria 关联、SSR hydration 对齐等场景。
 */

import {
  type ComponentInternalInstance,
  getCurrentInstance,
} from '../component'
import { warn } from '../warning'

/**
 * 作用：生成当前组件实例作用域内稳定递增的唯一 id。
 *
 * 使用场景：
 * - SSR / CSR 对齐需要稳定 id 的场景
 * - 组件内部为 label、input、aria 等生成可关联标识
 */
export function useId(): string {
  const i = getCurrentInstance()
  if (i) {
    // `ids` 是一个三元组：
    // - `ids[0]`：当前边界前缀
    // - `ids[1]`：当前边界内递增计数
    // - `ids[2]`：用于给异步边界继续切分子前缀
    return (i.appContext.config.idPrefix || 'v') + '-' + i.ids[0] + i.ids[1]++
  } else if (__DEV__) {
    warn(
      `useId() is called when there is no active component ` +
        `instance to be associated with.`,
    )
  }
  return ''
}

/**
 * 作用：在异步边界处切出新的 id 前缀，避免父子异步链路里的 id 冲突。
 *
 * 三类异步边界：
 * - 异步组件
 * - `async setup()`
 * - `serverPrefetch`
 */
export function markAsyncBoundary(instance: ComponentInternalInstance): void {
  // 新前缀 = 父前缀 + 当前边界序号 + '-'。
  // 这样异步边界内部继续 useId 时，就不会和同级或父级冲突。
  instance.ids = [instance.ids[0] + instance.ids[2]++ + '-', 0, 0]
}
