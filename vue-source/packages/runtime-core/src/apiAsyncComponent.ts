/**
 * 文件作用：实现异步组件定义能力。
 *
 * 这份文件负责 `defineAsyncComponent`，把异步加载、重试、超时、loading 组件
 * 和错误组件等策略收敛成统一的组件定义。
 *
 * 运行时视角下，它做的事情是：
 * - 先返回一个“异步组件包装器”
 * - 真正渲染到这里时再决定是显示 loading、error，还是等 loader resolve 后渲染真实组件
 */

import {
  type Component,
  type ComponentInternalInstance,
  type ComponentOptions,
  type ConcreteComponent,
  currentInstance,
  getComponentName,
  isInSSRComponentSetup,
} from './component'
import { isFunction, isObject } from '@vue-source/shared'
import type { ComponentPublicInstance } from './componentPublicInstance'
import { type VNode, createVNode } from './vnode'
import { defineComponent } from './apiDefineComponent'
import { warn } from './warning'
import { ref } from '@vue-source/reactivity'
import { ErrorCodes, handleError } from './errorHandling'
import { isKeepAlive } from './components/KeepAlive'
import { markAsyncBoundary } from './helpers/useId'
import { type HydrationStrategy, forEachElement } from './hydrationStrategies'

export type AsyncComponentResolveResult<T = Component> = T | { default: T } // es modules

export type AsyncComponentLoader<T = any> = () => Promise<
  AsyncComponentResolveResult<T>
>

export interface AsyncComponentOptions<T = any> {
  loader: AsyncComponentLoader<T>
  loadingComponent?: Component
  errorComponent?: Component
  delay?: number
  timeout?: number
  suspensible?: boolean
  hydrate?: HydrationStrategy
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number,
  ) => any
}

/**
 * 作用：判断一个组件实例或 vnode 是否是异步组件包装器。
 */
export const isAsyncWrapper = (i: ComponentInternalInstance | VNode): boolean =>
  !!(i.type as ComponentOptions).__asyncLoader

/*@__NO_SIDE_EFFECTS__*/
/**
 * 作用：把异步组件加载策略包装成标准组件定义。
 *
 * 参数说明：
 * - 可以直接传 loader 函数
 * - 也可以传包含 loading/error/timeout/retry 等控制项的完整配置对象
 */
export function defineAsyncComponent<
  T extends Component = { new (): ComponentPublicInstance },
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T>): T {
  /**
   * 定义一个异步组件包装器。
   *
   * 主要功能：
   * - 接收 loader 或完整异步组件配置
   * - 统一处理 loading / error / timeout / retry
   * - 返回一个标准组件定义，供渲染器像普通组件一样挂载
   *
   * 参数：
   * - `source`：异步组件 loader，或包含控制项的配置对象
   */
  if (isFunction(source)) {
    source = { loader: source }
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    hydrate: hydrateStrategy,
    timeout, // undefined = never times out
    suspensible = true,
    onError: userOnError,
  } = source

  // `pendingRequest` 保存当前正在进行的那次加载请求，避免并发重复拉取。
  let pendingRequest: Promise<ConcreteComponent> | null = null
  // `resolvedComp` 缓存已解析出的真实组件，后续实例可直接复用。
  let resolvedComp: ConcreteComponent | undefined

  // `retries` 记录当前已经重试过多少次，给用户 `onError` 回调判断是否继续重试。
  let retries = 0
  const retry = () => {
    // 重试前必须清空 `pendingRequest`，否则后续 `load()` 还会复用上一次失败请求。
    retries++
    pendingRequest = null
    return load()
  }

  const load = (): Promise<ConcreteComponent> => {
    /**
     * 发起或复用当前这次异步组件加载请求。
     *
     * 主要功能：
     * - 去重并发加载
     * - 处理用户自定义重试逻辑
     * - 兼容 ESModule default 导出
     * - 缓存最终解析出的真实组件
     */
    let thisRequest: Promise<ConcreteComponent>
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            err = err instanceof Error ? err : new Error(String(err))
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              throw err
            }
          })
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`,
              )
            }
            // interop module default
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            resolvedComp = comp
            return comp
          }))
    )
  }

  return defineComponent({
    name: 'AsyncComponentWrapper',

    __asyncLoader: load,

    __asyncHydrate(el, instance, hydrate) {
      /**
       * 惰性 hydration 入口。
       *
       * 主要功能：
       * - 等异步组件 resolve 完成后再激活已有 DOM
       * - 若用户配置了 `hydrateStrategy`，交给策略决定具体触发时机
       * - 如果组件在 hydration 前已经被更新，则直接跳过本次懒激活
       */
      let patched = false
      ;(instance.bu || (instance.bu = [])).push(() => (patched = true))
      const performHydrate = () => {
        // skip hydration if the component has been patched
        if (patched) {
          if (__DEV__) {
            warn(
              `Skipping lazy hydration for component '${getComponentName(resolvedComp!) || resolvedComp!.__file}': ` +
                `it was updated before lazy hydration performed.`,
            )
          }
          return
        }
        hydrate()
      }
      const doHydrate = hydrateStrategy
        ? () => {
            const teardown = hydrateStrategy(performHydrate, cb =>
              forEachElement(el, cb),
            )
            if (teardown) {
              ;(instance.bum || (instance.bum = [])).push(teardown)
            }
          }
        : performHydrate
      if (resolvedComp) {
        doHydrate()
      } else {
        load().then(() => !instance.isUnmounted && doHydrate())
      }
    },

    get __asyncResolved() {
      return resolvedComp
    },

    setup() {
      /**
       * 异步组件包装器自己的 setup。
       *
       * 它会根据当前环境分成几条路径：
       * - 已解析：直接渲染真实组件
       * - Suspense / SSR：返回 Promise，让上层等待
       * - 普通客户端：维护 loading/error/local 状态并按状态切换渲染结果
       */
      const instance = currentInstance!
      markAsyncBoundary(instance)

      // already resolved
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance)
      }

      const onError = (err: Error) => {
        pendingRequest = null
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */,
        )
      }

      // suspense-controlled or SSR.
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__SSR__ && isInSSRComponentSetup)
      ) {
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () =>
              errorComponent
                ? createVNode(errorComponent as ConcreteComponent, {
                    error: err,
                  })
                : null
          })
      }

      const loaded = ref(false)
      const error = ref()
      const delayed = ref(!!delay)

      if (delay) {
        setTimeout(() => {
          delayed.value = false
        }, delay)
      }

      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`,
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }

      load()
        .then(() => {
          loaded.value = true
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
            instance.parent.update()
          }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      return () => {
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {
          return createVNode(errorComponent, {
            error: error.value,
          })
        } else if (loadingComponent && !delayed.value) {
          return createInnerComp(
            loadingComponent as ConcreteComponent,
            instance,
          )
        }
      }
    },
  }) as T
}

function createInnerComp(
  comp: ConcreteComponent,
  parent: ComponentInternalInstance,
) {
  /**
   * 基于异步包装器当前的 vnode 信息，创建真正要渲染的内部组件 vnode。
   *
   * 为什么需要这层：
   * - 异步包装器本身只负责加载状态控制
   * - 真正渲染时仍要把原来的 props / children / ref / 自定义元素回调透传给内部组件
   */
  const { ref, props, children, ce } = parent.vnode
  const vnode = createVNode(comp, props, children)
  // ensure inner component inherits the async wrapper's ref owner
  vnode.ref = ref
  // pass the custom element callback on to the inner comp
  // and remove it from the async wrapper
  vnode.ce = ce
  delete parent.vnode.ce

  return vnode
}
