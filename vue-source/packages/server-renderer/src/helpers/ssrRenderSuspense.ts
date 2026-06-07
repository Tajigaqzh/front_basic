import type { PushFn } from '../buffer'

// 这里必须保持同步。
// SSR 编译结果调用形态是 `ssrRenderSuspense(_push, ...)`，
// 不是把返回值继续交给 `_push`，所以一旦这里返回 Promise，
// reject 会直接丢失，外层也无法感知。
export function ssrRenderSuspense(
  push: PushFn,
  { default: renderContent }: Record<string, (() => void) | undefined>,
): void {
  if (renderContent) {
    renderContent()
  } else {
    push(`<!---->`)
  }
}
