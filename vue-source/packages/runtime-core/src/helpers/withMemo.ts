/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 withMemo.ts 负责承接编译产物 `v-memo` 的运行时缓存逻辑。
 *
 * 它位于“render 函数执行 -> 生成 vnode”这段链路里，
 * 通过比较依赖快照决定某一段子树是否可以直接复用上一次 vnode。
 */

import { hasChanged } from '@vue-source/shared'
import { type VNode, currentBlock, isBlockTreeEnabled } from '../vnode'

/**
 * 作用：实现编译产物 `v-memo` 的运行时缓存入口。
 *
 * 参数说明：
 * - `memo`：本轮依赖快照数组。
 * - `render`：真正生成 vnode 的函数。
 * - `cache`：组件级缓存数组。
 * - `index`：当前 memo 片段在缓存数组中的位置。
 */
export function withMemo(
  memo: any[],
  render: () => VNode<any, any>,
  cache: any[],
  index: number,
): VNode<any, any> {
  /**
   * `v-memo` 的运行时入口。
   *
   * 主要功能：
   * - 对比本轮 memo 依赖和上轮依赖是否一致
   * - 一致时直接复用缓存 vnode
   * - 不一致时重新执行 render，并把新结果写回组件缓存位
   *
   * 参数：
   * - `memo`：本轮依赖快照
   * - `render`：真正生成 vnode 的渲染函数
   * - `cache`：组件实例上的缓存数组
   * - `index`：当前 memo 片段在缓存数组中的槽位
   */
  // `cached` 是上一次相同位置缓存下来的 vnode。
  const cached = cache[index] as VNode | undefined
  if (cached && isMemoSame(cached, memo)) {
    // 命中时直接跳过 render，整段子树沿用上一次 vnode 结果。
    return cached
  }
  const ret = render()

  // 把当前依赖快照和缓存位置信息挂回 vnode，下一轮才能做按位比较。
  ret.memo = memo.slice()
  ret.cacheIndex = index

  return (cache[index] = ret)
}

/**
 * 作用：比较当前 memo 依赖和缓存 vnode 上的上一次依赖是否完全一致。
 */
export function isMemoSame(cached: VNode, memo: any[]): boolean {
  /**
   * 比较缓存 vnode 上一次记录的依赖和本轮依赖是否完全一致。
   *
   * 命中后除了返回 true，还要把缓存 vnode 重新并入当前 block，
   * 否则父级 block 的动态子节点追踪会断掉。
   */
  // `prev` 是缓存 vnode 上一次记录下来的依赖快照。
  const prev: any[] = cached.memo!
  if (prev.length != memo.length) {
    // 依赖项数量都变了，说明编译期约定的快照结构已经不一致，不能复用。
    return false
  }

  for (let i = 0; i < prev.length; i++) {
    if (hasChanged(prev[i], memo[i])) {
      // 只要有一项变化，就必须整段重新 render，而不是做局部修补。
      return false
    }
  }

  // 命中缓存时，仍然要把这个 vnode 塞回当前 block，保证父级动态子节点追踪完整。
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(cached)
  }
  return true
}
