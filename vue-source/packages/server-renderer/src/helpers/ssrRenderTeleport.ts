import {
  type ComponentInternalInstance,
  ssrContextKey,
} from '@vue-source/runtime-dom'
import {
  type PushFn,
  type SSRBufferItem,
  type SSRContext,
  createBuffer,
} from '../buffer'

// Teleport 在 SSR 时不会把目标内容直接插入当前位置，
// 而是把内容暂存到 `context.__teleportBuffers[target]`，
// 最后由 `resolveTeleports` 统一展开到 `context.teleports`。
export function ssrRenderTeleport(
  parentPush: PushFn,
  contentRenderFn: (push: PushFn) => void,
  target: string,
  disabled: boolean,
  parentComponent: ComponentInternalInstance,
): void {
  parentPush('<!--teleport start-->')

  const context = parentComponent.appContext.provides[
    ssrContextKey as any
  ] as SSRContext
  const teleportBuffers =
    context.__teleportBuffers || (context.__teleportBuffers = {})
  const targetBuffer = teleportBuffers[target] || (teleportBuffers[target] = [])

  // 插入点需要记录当前位置，才能正确处理“父 teleport 里再套子 teleport”的顺序。
  const bufferIndex = targetBuffer.length

  let teleportContent: SSRBufferItem

  if (disabled) {
    // disabled 时语义退化成原地渲染，但仍要输出锚点，保持 hydration 对齐。
    contentRenderFn(parentPush)
    teleportContent = `<!--teleport start anchor--><!--teleport anchor-->`
  } else {
    const { getBuffer, push } = createBuffer()
    push(`<!--teleport start anchor-->`)
    contentRenderFn(push)
    push(`<!--teleport anchor-->`)
    teleportContent = getBuffer()
  }

  targetBuffer.splice(bufferIndex, 0, teleportContent)
  parentPush('<!--teleport end-->')
}
