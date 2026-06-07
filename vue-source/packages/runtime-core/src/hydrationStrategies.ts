/**
 * 文件作用：提供异步组件的延迟 hydration 策略。
 *
 * 它主要服务于 SSR + 异步组件场景，
 * 让客户端可以不在首屏立刻激活某段服务端 DOM，而是等空闲、可见、媒体条件或用户交互时再激活。
 */

import { getGlobalThis, isString } from '@vue-source/shared'
import { DOMNodeTypes, isComment } from './hydration'

// Safari 可能没有原生 `requestIdleCallback`，这里提供最小兜底实现。
const requestIdleCallback: Window['requestIdleCallback'] =
  getGlobalThis().requestIdleCallback || (cb => setTimeout(cb, 1))
const cancelIdleCallback: Window['cancelIdleCallback'] =
  getGlobalThis().cancelIdleCallback || (id => clearTimeout(id))

/**
 * A lazy hydration strategy for async components.
 * @param hydrate - call this to perform the actual hydration.
 * @param forEachElement - iterate through the root elements of the component's
 *                         non-hydrated DOM, accounting for possible fragments.
 * @returns a teardown function to be called if the async component is unmounted
 *          before it is hydrated. This can be used to e.g. remove DOM event
 *          listeners.
 */
export type HydrationStrategy = (
  hydrate: () => void,
  forEachElement: (cb: (el: Element) => any) => void,
) => (() => void) | void

export type HydrationStrategyFactory<Options> = (
  options?: Options,
) => HydrationStrategy

/**
 * 作用：在浏览器空闲时再执行 hydration。
 */
export const hydrateOnIdle: HydrationStrategyFactory<number> =
  (timeout = 10000) =>
  hydrate => {
    const id = requestIdleCallback(hydrate, { timeout })
    return () => cancelIdleCallback(id)
  }

/**
 * 作用：快速判断元素是否已经进入当前视口。
 */
function elementIsVisibleInViewport(el: Element) {
  const { top, left, bottom, right } = el.getBoundingClientRect()
  // eslint-disable-next-line no-restricted-globals
  const { innerHeight, innerWidth } = window
  return (
    ((top > 0 && top < innerHeight) || (bottom > 0 && bottom < innerHeight)) &&
    ((left > 0 && left < innerWidth) || (right > 0 && right < innerWidth))
  )
}

/**
 * 作用：当组件根元素进入视口时再执行 hydration。
 */
export const hydrateOnVisible: HydrationStrategyFactory<
  IntersectionObserverInit
> = opts => (hydrate, forEach) => {
  const ob = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      ob.disconnect()
      hydrate()
      break
    }
  }, opts)
  forEach(el => {
    if (!(el instanceof Element)) return
    if (elementIsVisibleInViewport(el)) {
      hydrate()
      ob.disconnect()
      return false
    }
    ob.observe(el)
  })
  return () => ob.disconnect()
}

/**
 * 作用：当媒体查询命中时再执行 hydration。
 */
export const hydrateOnMediaQuery: HydrationStrategyFactory<string> =
  query => hydrate => {
    if (query) {
      const mql = matchMedia(query)
      if (mql.matches) {
        hydrate()
      } else {
        mql.addEventListener('change', hydrate, { once: true })
        return () => mql.removeEventListener('change', hydrate)
      }
    }
  }

/**
 * 作用：等用户第一次交互后再执行 hydration，并在激活后重放那次事件。
 */
export const hydrateOnInteraction: HydrationStrategyFactory<
  keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap>
> =
  (interactions = []) =>
  (hydrate, forEach) => {
    if (isString(interactions)) interactions = [interactions]
    let hasHydrated = false
    const doHydrate = (e: Event) => {
      if (!hasHydrated) {
        hasHydrated = true
        teardown()
        hydrate()
        // replay event
        e.target!.dispatchEvent(new (e.constructor as any)(e.type, e))
      }
    }
    const teardown = () => {
      forEach(el => {
        for (const i of interactions) {
          el.removeEventListener(i, doHydrate)
        }
      })
    }
    forEach(el => {
      for (const i of interactions) {
        el.addEventListener(i, doHydrate, { once: true })
      }
    })
    return teardown
  }

/**
 * 作用：遍历一段尚未 hydration 的根 DOM 片段里的所有根元素。
 *
 * 之所以需要它：
 * - 异步组件的 SSR 输出不一定只有单根元素
 * - 也可能是 Fragment，因此需要特殊跳过注释锚点并展开中间节点
 */
export function forEachElement(
  node: Node,
  cb: (el: Element) => void | false,
): void {
  // fragment
  if (isComment(node) && node.data === '[') {
    let depth = 1
    let next = node.nextSibling
    while (next) {
      if (next.nodeType === DOMNodeTypes.ELEMENT) {
        const result = cb(next as Element)
        if (result === false) {
          break
        }
      } else if (isComment(next)) {
        if (next.data === ']') {
          if (--depth === 0) break
        } else if (next.data === '[') {
          depth++
        }
      }
      next = next.nextSibling
    }
  } else {
    cb(node as Element)
  }
}
