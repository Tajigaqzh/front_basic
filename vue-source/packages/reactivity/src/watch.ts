import {
    EMPTY_OBJ,
    NOOP,
    hasChanged,
    isArray,
    isFunction,
    isMap,
    isObject,
    isPlainObject,
    isSet,
    remove,
} from "@vue-source/shared";
import type { ComputedRef } from './computed'
import { ReactiveFlags } from './constants'
import {
    type DebuggerOptions,
    EffectFlags,
    type EffectScheduler,
    ReactiveEffect,
    pauseTracking,
    resetTracking,
} from './effect'
import { isReactive, isShallow } from './reactive'
import { type Ref, isRef } from './ref'
import { getCurrentScope } from './effectScope'

// 这些错误码是从 `packages/runtime-core/src/errorHandling.ts` 挪过来的。
// 之所以放到 `@vue/reactivity`，是为了和迁移过来的 watch 基础逻辑放在一起，
// 因此这里的值必须保持不变。
export enum WatchErrorCodes {
    WATCH_GETTER = 2,
    WATCH_CALLBACK,
    WATCH_CLEANUP,
}

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = Ref<T, any> | ComputedRef<T> | (() => T)

export type WatchCallback<V = any, OV = any> = (
    value: V,
    oldValue: OV,
    onCleanup: OnCleanup,
) => any

export type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptions<Immediate = boolean> extends DebuggerOptions {
    immediate?: Immediate
    deep?: boolean | number
    once?: boolean
    scheduler?: WatchScheduler
    onWarn?: (msg: string, ...args: any[]) => void
    /**
     * @internal
     */
    augmentJob?: (job: (...args: any[]) => void) => void
    /**
     * @internal
     */
    call?: (
        fn: Function | Function[],
        type: WatchErrorCodes,
        args?: unknown[],
    ) => void
}

export type WatchStopHandle = () => void

export interface WatchHandle extends WatchStopHandle {
    pause: () => void
    resume: () => void
    stop: () => void
}

// watcher 的初始旧值哨兵，用来区分“第一次触发”和真实的 `undefined`。
const INITIAL_WATCHER_VALUE = {}

export type WatchScheduler = (job: () => void, isFirstRun: boolean) => void

const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]> = new WeakMap()
let activeWatcher: ReactiveEffect | undefined = undefined

/**
 * 如果当前存在激活中的 watcher effect，就返回它。
 */
export function getCurrentWatcher(): ReactiveEffect<any> | undefined {
    return activeWatcher
}

/**
 * 在当前激活的 effect 上注册一个清理回调。
 * 这个回调会在关联 effect 下次重新执行前被调用。
 *
 * @param cleanupFn - 要绑定到 effect 清理阶段的回调函数。
 * @param failSilently - 如果为 `true`，在没有激活 effect 时静默处理。
 * @param owner - 这个清理函数要挂载到哪个 effect 上；默认是当前激活 effect。
 */
export function onWatcherCleanup(
    cleanupFn: () => void,
    failSilently = false,
    owner: ReactiveEffect | undefined = activeWatcher,
): void {
    if (owner) {
        let cleanups = cleanupMap.get(owner)
        if (!cleanups) cleanupMap.set(owner, (cleanups = []))
        cleanups.push(cleanupFn)
    }
}

/**
 * 创建一个侦听器，追踪 `source` 的依赖变化，并在变化时执行回调或副作用函数。
 *
 * 它同时覆盖两类能力：
 * 1. `watch(source, cb)`：比较新旧值后执行回调。
 * 2. `watchEffect(effect)`：依赖变化后直接重新执行副作用。
 */
export function watch(
    source: WatchSource | WatchSource[] | WatchEffect | object,
    cb?: WatchCallback | null,
    options: WatchOptions = EMPTY_OBJ,
): WatchHandle {
    /**
     * `watch` 的核心实现：
     * 1. 先把不同类型的 `source` 统一转换成 getter
     * 2. 再创建 `ReactiveEffect` 用来追踪 getter 依赖
     * 3. 依赖变化时执行 `job`，比较新旧值并决定是否调用回调
     */
    const { immediate, deep, once, scheduler, augmentJob, call } = options

    // 针对 reactive 对象构造 getter，并按 `deep` 配置决定遍历深度。
    const reactiveGetter = (source: object) => {
        // 如果显式指定 deep，真正的深遍历会在后面包装后的 getter 中执行。
        if (deep) return source
        // `deep: false | 0` 或 shallow reactive 只遍历第一层属性。
        if (isShallow(source) || deep === false || deep === 0)
            return traverse(source, 1)
        // `deep: undefined` 且 source 为 reactive 对象时，默认深遍历全部属性。
        return traverse(source)
    }

    let effect: ReactiveEffect
    let getter: () => any
    let cleanup: (() => void) | undefined
    let boundCleanup: typeof onWatcherCleanup
    let forceTrigger = false
    let isMultiSource = false

    if (isRef(source)) {
        // 单个 ref：getter 直接读取 `.value`。
        getter = () => source.value
        // shallow ref 深改内部值时，比较新旧值不一定能发现变化，所以要强制触发。
        forceTrigger = isShallow(source)
    } else if (isReactive(source)) {
        // reactive 对象：通过 `reactiveGetter` 决定是否做深遍历。
        getter = () => reactiveGetter(source)
        // reactive 对象内部属性变化时，即使对象引用不变，也应视为需要触发。
        forceTrigger = true
    } else if (isArray(source)) {
        // 多源 watch：数组里的每一项都可能是 ref / reactive / getter。
        isMultiSource = true
        // 只要数组里有 reactive 或 shallow 值，就需要强制触发比较流程。
        forceTrigger = source.some(s => isReactive(s) || isShallow(s))
        getter = () =>
            source.map(s => {
                if (isRef(s)) {
                    // ref 项取 `.value`
                    return s.value
                } else if (isReactive(s)) {
                    // reactive 项按 deep 配置做遍历读取
                    return reactiveGetter(s)
                } else if (isFunction(s)) {
                    // getter 项直接执行；如果有统一调用器则走调用器
                    return call ? call(s, WatchErrorCodes.WATCH_GETTER) : s()
                }
            })
    } else if (isFunction(source)) {
        if (cb) {
            // `watch(source, cb)`：source 函数本身就是 getter。
            getter = call
                ? () => call(source, WatchErrorCodes.WATCH_GETTER)
                : (source as () => any)
        } else {
            // 没有 cb 时就是 `watchEffect` 语义。
            getter = () => {
                if (cleanup) {
                    // 重新运行 watchEffect 之前，先执行上一轮注册的清理函数。
                    pauseTracking()
                    try {
                        cleanup()
                    } finally {
                        // 清理函数执行完后恢复外层原本的追踪状态。
                        resetTracking()
                    }
                }
                const currentEffect = activeWatcher
                // 在运行 source 前把当前 watcher 设为 activeWatcher，
                // 这样 `onWatcherCleanup` 才知道该把 cleanup 挂到谁身上。
                activeWatcher = effect
                try {
                    return call
                        ? call(source, WatchErrorCodes.WATCH_CALLBACK, [boundCleanup])
                        : source(boundCleanup)
                } finally {
                    // 运行结束后恢复外层 watcher 上下文。
                    activeWatcher = currentEffect
                }
            }
        }
    } else {
        // 其他不支持的 source 统一退化成空 getter。
        getter = NOOP
    }

    if (cb && deep) {
        // 对 `watch(source, cb)` 且开启 deep 的场景，
        // 用一层包装 getter 强制深度遍历返回值。
        const baseGetter = getter
        const depth = deep === true ? Infinity : deep
        getter = () => traverse(baseGetter(), depth)
    }

    const scope = getCurrentScope()
    const watchHandle: WatchHandle = () => {
        // 手动停止时先停止内部 effect。
        effect.stop()
        if (scope && scope.active) {
            // 如果当前 watch 挂在某个 effect scope 下，还要把自己从 scope 中移除。
            remove(scope.effects, effect)
        }
    }

    if (once && cb) {
        // `once` 模式下，回调触发一次后就立刻停止 watch。
        const _cb = cb
        cb = (...args) => {
            _cb(...args)
            watchHandle()
        }
    }

    let oldValue: any = isMultiSource
        ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
        : INITIAL_WATCHER_VALUE

    const job = (immediateFirstRun?: boolean) => {
        // effect 已停止，或者本轮既不脏也不是首次立即执行时，直接跳过。
        if (
            !(effect.flags & EffectFlags.ACTIVE) ||
            (!effect.dirty && !immediateFirstRun)
        ) {
            return
        }
        if (cb) {
            // 标准 `watch(source, cb)` 分支。
            // 先重新执行 getter，拿到最新值。
            const newValue = effect.run()
            if (
                deep ||
                forceTrigger ||
                (isMultiSource
                    ? (newValue as any[]).some((v, i) => hasChanged(v, oldValue[i]))
                    : hasChanged(newValue, oldValue))
            ) {
                // 重新执行回调前，先跑掉上一次注册的 cleanup。
                if (cleanup) {
                    cleanup()
                }
                const currentWatcher = activeWatcher
                activeWatcher = effect
                try {
                    const args = [
                        newValue,
                        // 第一次变更时，把 oldValue 视为 `undefined`。
                        oldValue === INITIAL_WATCHER_VALUE
                            ? undefined
                            : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE
                                ? []
                                : oldValue,
                        boundCleanup,
                    ]
                    // 回调真正执行前，先把最新值写回 oldValue，
                    // 这样即使回调里再次触发同步更新，也能看到正确旧值。
                    oldValue = newValue
                    call
                        ? call(cb!, WatchErrorCodes.WATCH_CALLBACK, args)
                        : // @ts-expect-error
                        cb!(...args)
                } finally {
                    activeWatcher = currentWatcher
                }
            }
        } else {
            // `watchEffect` 分支直接重新执行 effect。
            effect.run()
        }
    }

    if (augmentJob) {
        // 某些上层调用方会额外增强 job，例如打批处理标记。
        augmentJob(job)
    }

    // watch 的核心仍然是一个 ReactiveEffect，只是外层多了一层值比较和 cleanup 管理。
    effect = new ReactiveEffect(getter)

    effect.scheduler = scheduler
        ? () => scheduler(job, false)
        : (job as EffectScheduler)

    // 提供给用户的 `onCleanup` 会最终挂到当前 watch 对应的 effect 上。
    boundCleanup = fn => onWatcherCleanup(fn, false, effect)

    cleanup = effect.onStop = () => {
        // effect 停止时，把挂在它身上的所有 cleanup 统一执行并清空。
        const cleanups = cleanupMap.get(effect)
        if (cleanups) {
            if (call) {
                call(cleanups, WatchErrorCodes.WATCH_CLEANUP)
            } else {
                for (const cleanup of cleanups) cleanup()
            }
            cleanupMap.delete(effect)
        }
    }

    // 执行初始化首轮运行。
    if (cb) {
        if (immediate) {
            job(true)
        } else {
            oldValue = effect.run()
        }
    } else if (scheduler) {
        scheduler(job.bind(null, true), true)
    } else {
        effect.run()
    }

    watchHandle.pause = effect.pause.bind(effect)
    watchHandle.resume = effect.resume.bind(effect)
    watchHandle.stop = watchHandle

    return watchHandle
}

/**
 * 深度读取一个值，把内部可访问到的属性都“碰一遍”，
 * 以便在深度侦听场景中把这些嵌套属性全部建立依赖。
 *
 * @param value - 要遍历的值。
 * @param depth - 最大遍历深度，默认无限深。
 * @param seen - 用于处理循环引用的访问记录表。
 */
export function traverse(
    value: unknown,
    depth: number = Infinity,
    seen?: Map<unknown, number>,
): unknown {
    // 到达最大深度、不是对象，或显式标记为跳过时，直接返回。
    if (depth <= 0 || !isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
        return value
    }

    // 用 `seen` 防止循环引用导致无限递归。
    seen = seen || new Map()
    if ((seen.get(value) || 0) >= depth) {
        return value
    }
    seen.set(value, depth)
    depth--
    if (isRef(value)) {
        // ref 继续深入遍历它的 `.value`。
        traverse(value.value, depth, seen)
    } else if (isArray(value)) {
        // 数组逐项遍历。
        for (let i = 0; i < value.length; i++) {
            traverse(value[i], depth, seen)
        }
    } else if (isSet(value) || isMap(value)) {
        // Set / Map 遍历内部存储的值。
        value.forEach((v: any) => {
            traverse(v, depth, seen)
        })
    } else if (isPlainObject(value)) {
        // 普通对象先遍历字符串键。
        for (const key in value) {
            traverse(value[key], depth, seen)
        }
        // 再补遍历可枚举的 symbol 键。
        for (const key of Object.getOwnPropertySymbols(value)) {
            if (Object.prototype.propertyIsEnumerable.call(value, key)) {
                traverse(value[key as any], depth, seen)
            }
        }
    }
    return value
}
