/**
 * 文件作用：把响应式系统里的 watch 能力接到组件运行时。
 *
 * 这份文件负责实现 `watch`、`watchEffect`、`watchPostEffect`、`watchSyncEffect`，
 * 并把 watcher 的调度时机和组件实例、渲染后置副作用串起来。
 *
 * 简单说：
 * - `@vue-source/reactivity` 负责“监听什么”
 * - 这里负责“什么时候执行、挂到哪个组件实例、是否要走渲染前后队列”
 */

import {
  type WatchOptions as BaseWatchOptions,
  type DebuggerOptions,
  type ReactiveMarker,
  type WatchCallback,
  type WatchEffect,
  type WatchHandle,
  type WatchSource,
  watch as baseWatch,
} from '@vue-source/reactivity'
import { type SchedulerJob, SchedulerJobFlags, queueJob } from './scheduler'
import { EMPTY_OBJ, NOOP, extend, isFunction, isString } from '@vue-source/shared'
import {
  type ComponentInternalInstance,
  currentInstance,
  isInSSRComponentSetup,
  setCurrentInstance,
} from './component'
import { callWithAsyncErrorHandling } from './errorHandling'
import { queuePostRenderEffect } from './renderer'
import type { ObjectWatchOptionItem } from './componentOptions'
import { useSSRContext } from './helpers/useSsrContext'
import type { ComponentPublicInstance } from './componentPublicInstance'

export type {
  WatchHandle,
  WatchStopHandle,
  WatchEffect,
  WatchSource,
  WatchCallback,
  OnCleanup,
} from '@vue-source/reactivity'

type MaybeUndefined<T, I> = I extends true ? T | undefined : T

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? MaybeUndefined<V, Immediate>
    : T[K] extends object
      ? MaybeUndefined<T[K], Immediate>
      : never
}

export interface WatchEffectOptions extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

export interface WatchOptions<Immediate = boolean> extends WatchEffectOptions {
  // `immediate` 控制首次是否立刻执行回调。
  immediate?: Immediate
  // `deep` 控制是否深度遍历依赖；number 形式表示最大遍历层数。
  deep?: boolean | number
  // `once` 为 true 时，回调触发一次后自动停止监听。
  once?: boolean
}

/**
 * 立即执行并自动收集依赖的副作用监听。
 */
export function watchEffect(
  effect: WatchEffect,
  options?: WatchEffectOptions,
): WatchHandle {
  return doWatch(effect, null, options)
}

/**
 * 在组件渲染完成后触发的 watchEffect。
 */
export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
): WatchHandle {
  // post watcher 要等当前组件及其子树 patch 完，适合读取更新后的 DOM。
  return doWatch(effect, null, extend({}, options as WatchEffectOptions, { flush: 'post' }))
}

/**
 * 同步执行的 watchEffect。
 */
export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
): WatchHandle {
  // sync watcher 完全不进调度队列，依赖一变就立刻同步执行。
  return doWatch(effect, null, extend({}, options as WatchEffectOptions, { flush: 'sync' }))
}

export type MultiWatchSources = (WatchSource<unknown> | object)[]

// overload: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: reactive array or tuple of multiple sources + cb
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false,
>(
  sources: readonly [...T] | T,
  cb: [T] extends [ReactiveMarker]
    ? WatchCallback<T, MaybeUndefined<T, Immediate>>
    : WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: array of multiple sources + cb
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false,
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// implementation
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>,
): WatchHandle {
  return doWatch(source as any, cb, options)
}

/**
 * watch / watchEffect 的统一内部实现。
 *
 * 主要功能：
 * - 解析 flush 策略
 * - 把 watcher 调度接到 runtime-core 调度器
 * - 在组件实例上下文里执行回调
 * - 处理 SSR 场景下 watcher 的特殊行为
 */
function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  options: WatchOptions = EMPTY_OBJ,
): WatchHandle {
  const { immediate, deep, flush, once } = options
  void deep
  void once

  // `baseWatchOptions` 最终会传给 reactivity 层的 `watch()`。
  // 这里复制一份是为了在不改动用户原始 options 的前提下，补 runtime-core 自己的调度逻辑。
  const baseWatchOptions: BaseWatchOptions = extend({}, options)

  // immediate watcher or watchEffect
  // `runsImmediately` 表示“当前 watcher 在创建阶段就要立刻跑一次”。
  // watchEffect 默认立即执行；watch 只有 `immediate: true` 才会首次立即执行。
  const runsImmediately = (cb && immediate) || (!cb && flush !== 'post')
  let ssrCleanup: (() => void)[] | undefined
  if (__SSR__ && isInSSRComponentSetup) {
    if (flush === 'sync') {
      const ctx = useSSRContext()!
      // SSR 同步 watcher 需要被记录下来，后续服务端渲染流程结束时统一清理。
      ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = [])
    } else if (!runsImmediately) {
      // 非立即执行的异步 watcher 在 SSR 阶段没有实际意义：
      // 服务端不会等待后续异步 DOM 更新，因此这里直接返回空句柄。
      const watchStopHandle = () => {}
      watchStopHandle.stop = NOOP
      watchStopHandle.resume = NOOP
      watchStopHandle.pause = NOOP
      return watchStopHandle
    }
  }

  const instance = currentInstance
  // 所有 watcher 回调都统一绑到当前组件实例，便于错误处理拿到组件上下文。
  baseWatchOptions.call = (fn, type, args) =>
    callWithAsyncErrorHandling(fn, instance, type, args)

  // scheduler
  let isPre = false
  if (flush === 'post') {
    // post watcher 要等组件 DOM patch 完再跑，因此接到渲染后副作用队列。
    baseWatchOptions.scheduler = job => {
      queuePostRenderEffect(job, instance && instance.suspense)
    }
  } else if (flush !== 'sync') {
    // default: 'pre'
    isPre = true
    baseWatchOptions.scheduler = (job, isFirstRun) => {
      // 首次运行直接同步执行，保证创建阶段就能立即完成依赖收集 / 首次回调。
      // 后续变更再走调度队列，与组件更新批处理对齐。
      if (isFirstRun) {
        job()
      } else {
        queueJob(job)
      }
    }
  }

  baseWatchOptions.augmentJob = (job: SchedulerJob) => {
    // important: mark the job as a watcher callback so that scheduler knows
    // it is allowed to self-trigger (#1727)
    if (cb) {
      job.flags! |= SchedulerJobFlags.ALLOW_RECURSE
    }
    if (isPre) {
      job.flags! |= SchedulerJobFlags.PRE
      if (instance) {
        // pre watcher 和所属组件 update job 共享 uid，
        // 这样调度器可以把它稳定插到该组件更新任务之前。
        job.id = instance.uid
        ;(job as SchedulerJob).i = instance
      }
    }
  }

  const watchHandle = baseWatch(source, cb, baseWatchOptions)

  if (__SSR__ && isInSSRComponentSetup) {
    if (ssrCleanup) {
      // 服务端同步 watcher 句柄要统一收集起来，方便渲染结束时批量 stop。
      ssrCleanup.push(watchHandle)
    } else if (runsImmediately) {
      // SSR 下“立即执行但不保留后续调度”的 watcher，跑完这一次即可。
      watchHandle()
    }
  }

  return watchHandle
}

/**
 * Options API 的 `this.$watch` 实现。
 */
export function instanceWatch(
  this: ComponentInternalInstance,
  source: string | Function,
  value: WatchCallback | ObjectWatchOptionItem,
  options?: WatchOptions,
): WatchHandle {
  /**
   * 实现 Options API 的 `this.$watch(...)`。
   *
   * 主要功能：
   * - 把字符串路径或函数来源统一转成 getter
   * - 把回调绑定到组件 public instance 上，保持 `this` 语义一致
   * - 在当前组件实例上下文里复用组合式 watch 实现
   */
  const publicThis = this.proxy
  const getter = isString(source)
    ? source.includes('.')
      ? createPathGetter(publicThis!, source)
      // 单段路径直接走属性读取，比统一拆路径更轻。
      : () => publicThis![source as keyof typeof publicThis]
    // 函数来源要绑定到 public instance，保持 `$watch(fn)` 中的 `this` 语义与 Vue 2/Options API 一致。
    : source.bind(publicThis, publicThis)
  let cb
  if (isFunction(value)) {
    cb = value
  } else {
    cb = value.handler as Function
    options = value
  }
  const reset = setCurrentInstance(this)
  const res = doWatch(getter, cb.bind(publicThis), options)
  reset()
  return res
}

/**
 * 把 `a.b.c` 形式的点路径转换成 getter。
 */
export function createPathGetter(
  ctx: ComponentPublicInstance,
  path: string,
): () => WatchSource | WatchSource[] | WatchEffect | object {
  /**
   * 创建点路径 getter。
   *
   * 主要功能：
   * - 把 `a.b.c` 这种字符串路径转换成函数读取逻辑
   * - 供 Options API 的 `$watch('a.b.c', ...)` 使用
   *
   * 参数：
   * - `ctx`：组件 public instance，路径查找从这里起步
   * - `path`：点分隔路径
   */
  const segments = path.split('.')
  return (): WatchSource | WatchSource[] | WatchEffect | object => {
    // `cur` 表示当前路径游标指向的值，会沿着 `a -> b -> c` 逐段下钻。
    let cur = ctx
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i] as keyof typeof cur]
    }
    return cur
  }
}
