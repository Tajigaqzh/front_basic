import type { _Method } from './types'

// 默认清理函数。
// 当调用者没有传入 onCleanup 时，取消订阅只需要从 Set 删除回调。
export const noop = () => {}

/**
 * 把回调加入订阅集合，并返回取消订阅函数。
 *
 * 这个小工具被两条链路复用：
 * - `$subscribe()`：监听 state mutation。
 * - `$onAction()`：监听 action before/after/error。
 */
export function addSubscription<T extends _Method>(
  // 订阅集合，Set 可以天然去重，也方便删除。
  subscriptions: Set<T>,
  // 需要注册的回调。
  callback: T,
  // 取消订阅后额外执行的清理逻辑。
  onCleanup: () => void = noop
) {
  // 注册订阅。
  subscriptions.add(callback)

  // 返回 unsubscribe。
  return () => {
    // delete 返回 boolean，用来判断本次是否真的删除了一个订阅。
    const deleted = subscriptions.delete(callback)
    // 只有第一次成功删除时才触发 cleanup，避免重复调用副作用。
    if (deleted) {
      onCleanup()
    }
  }
}

/**
 * 触发订阅集合中的全部回调。
 *
 * `Parameters<T>` 让触发参数和订阅函数参数保持一致：
 * mutation 订阅接收 `(mutation, state)`，action after/error 接收各自参数。
 */
export function triggerSubscriptions<T extends _Method>(
  // 当前需要通知的订阅集合。
  subscriptions: Set<T>,
  // 透传给每个订阅回调的参数。
  ...args: Parameters<T>
) {
  // Set 按插入顺序遍历，符合插件/订阅注册顺序。
  subscriptions.forEach((callback) => {
    // 每个订阅者都收到同一份事件参数。
    callback(...args)
  })
}
