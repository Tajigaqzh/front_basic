import { isArray, isPromise, isString } from '@vue-source/shared'

// SSR 不会直接一边遍历一边产出完整字符串，而是先构建一棵 buffer 树。
// 这样既能把同步内容高效拼接起来，也能把异步组件/异步 setup 的结果挂进去，
// 等到最终展开阶段再统一处理。
export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean }
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>
export type PushFn = (item: SSRBufferItem) => void
export type Props = Record<string, unknown>

export type SSRContext = {
  [key: string]: any
  teleports?: Record<string, string>
  /**
   * @internal
   */
  __teleportBuffers?: Record<string, SSRBuffer>
  /**
   * @internal
   */
  __watcherHandles?: (() => void)[]
}

// 每个组件子树都会写入自己的 buffer。
// buffer 内既可能是已经完成的字符串片段，也可能是子 buffer，
// 还可能是异步分支未来才会 resolve 的 Promise<buffer>。
export function createBuffer() {
  let appendable = false
  const buffer: SSRBuffer = []
  return {
    getBuffer(): SSRBuffer {
      return buffer
    },
    push(item: SSRBufferItem): void {
      const isStringItem = isString(item)

      // 连续字符串直接原地拼接，减少数组项数量，降低后续 unroll 成本。
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
        return
      }

      buffer.push(item)
      appendable = isStringItem

      // 只要某一项是 Promise，或者子 buffer 自己标记了异步，
      // 当前 buffer 就要整体进入异步展开路径。
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true
      }
    },
  }
}
