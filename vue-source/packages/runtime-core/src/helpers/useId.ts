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
  /**
   * 生成当前组件作用域内稳定的唯一 id。
   *
   * 主要功能：
   * - 基于应用级 `idPrefix`
   * - 结合当前异步边界前缀
   * - 在当前边界内做递增编号
   *
   * 为什么要这样设计：
   * - 普通自增 id 在 SSR / CSR 混合场景里容易错位
   * - 加上边界前缀后，异步组件和 Suspense 也能稳定对齐
   */
  const i = getCurrentInstance()
  if (i) {
    // `ids` 是一个三元组：
    // - `ids[0]`：当前边界前缀
    // - `ids[1]`：当前边界内递增计数
    // - `ids[2]`：用于给异步边界继续切分子前缀
    // 把“应用级前缀 + 边界前缀 + 边界内序号”拼起来，
    // 才能在 SSR、异步组件、Suspense 混合场景里仍保持稳定一致。
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
  /**
   * 在异步边界上切出新的 id 子空间。
   *
   * 主要功能：
   * - 给当前异步边界分配新的前缀片段
   * - 把边界内计数器重置为 0
   * - 避免父级和异步子级 `useId()` 结果冲突
   */
  // 新前缀 = 父前缀 + 当前边界序号 + '-'。
  // 这样异步边界内部继续 useId 时，就不会和同级或父级冲突。
  // 第三个槽位重置为 0，表示这个新边界自己也可以继续往下切子边界。
  instance.ids = [instance.ids[0] + instance.ids[2]++ + '-', 0, 0]
}
