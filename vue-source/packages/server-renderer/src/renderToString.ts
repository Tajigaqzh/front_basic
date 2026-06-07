import {
  type App,
  type VNode,
  createApp,
  createVNode,
  ssrContextKey,
  ssrUtils,
} from '@vue-source/runtime-dom'
import { isPromise, isString } from '@vue-source/shared'
import { type SSRBuffer, type SSRContext } from './buffer'
import { renderComponentVNode } from './render'

const { isVNode } = ssrUtils

// SSR 渲染阶段先构建 buffer 树，最后再把树拍平成字符串。
// 这里的递归函数负责处理三种节点：
// 1. 普通字符串
// 2. 子 buffer
// 3. 异步组件 / 异步 setup 产生的 Promise<buffer>
function nestedUnrollBuffer(
  buffer: SSRBuffer,
  parentRet: string,
  startIndex: number,
): Promise<string> | string {
  if (!buffer.hasAsync) {
    return parentRet + unrollBufferSync(buffer)
  }

  let ret = parentRet
  for (let i = startIndex; i < buffer.length; i += 1) {
    const item = buffer[i]
    if (isString(item)) {
      ret += item
      continue
    }

    // Promise resolve 后会把结果回填到原 buffer 中，
    // 这样继续递归时不需要重新走已经完成的异步分支。
    if (isPromise(item)) {
      return item.then(nestedItem => {
        buffer[i] = nestedItem
        return nestedUnrollBuffer(buffer, ret, i)
      })
    }

    const result = nestedUnrollBuffer(item, ret, 0)
    if (isPromise(result)) {
      return result.then(nestedItem => {
        buffer[i] = nestedItem
        return nestedUnrollBuffer(buffer, '', i)
      })
    }

    ret = result
  }

  return ret
}

export function unrollBuffer(buffer: SSRBuffer): Promise<string> | string {
  return nestedUnrollBuffer(buffer, '', 0)
}

// 同步路径专门拆出来，是为了避免无异步内容时产生多余的 await tick。
function unrollBufferSync(buffer: SSRBuffer): string {
  let ret = ''
  for (let i = 0; i < buffer.length; i++) {
    const item = buffer[i]
    if (isString(item)) {
      ret += item
    } else {
      ret += unrollBufferSync(item as SSRBuffer)
    }
  }
  return ret
}

export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  // 直接传入 VNode 时，包一层 app，确保 provide/appContext/teleport 上下文完整。
  if (isVNode(input)) {
    return renderToString(createApp({ render: () => input }), context)
  }

  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context

  // SSR context 通过 provide 注入到整棵树里，Teleport、watch cleanup 等都依赖它。
  input.provide(ssrContextKey, context)
  const buffer = await renderComponentVNode(vnode)
  const result = await unrollBuffer(buffer as SSRBuffer)

  // teleport 内容不会直接拼进主 HTML，而是单独汇总到 context.teleports。
  await resolveTeleports(context)

  // SSR 中为了支持 watch/computed 可能会注册清理句柄，渲染结束后统一释放。
  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch()
    }
  }

  return result
}

export async function resolveTeleports(context: SSRContext): Promise<void> {
  if (context.__teleportBuffers) {
    context.teleports = context.teleports || {}
    for (const key in context.__teleportBuffers) {
      // Teleport 的 Promise 在前面阶段已经并行创建过了，
      // 这里顺序 await 只是为了按目标容器稳定落盘。
      context.teleports[key] = await unrollBuffer(
        await Promise.all([context.__teleportBuffers[key]]),
      )
    }
  }
}
