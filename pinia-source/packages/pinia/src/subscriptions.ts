import type { _Method } from './types'

export const noop = () => {}

export function addSubscription<T extends _Method>(
  subscriptions: Set<T>,
  callback: T,
  onCleanup: () => void = noop
) {
  subscriptions.add(callback)

  return () => {
    const deleted = subscriptions.delete(callback)
    if (deleted) {
      onCleanup()
    }
  }
}

export function triggerSubscriptions<T extends _Method>(
  subscriptions: Set<T>,
  ...args: Parameters<T>
) {
  subscriptions.forEach((callback) => {
    callback(...args)
  })
}
