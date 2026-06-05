import { extend, hasChanged } from "@vue-source/shared"
import type { ComputedRefImpl } from './computed'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { type Link, globalVersion } from './dep'
import { activeEffectScope } from './effectScope'

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
    effect: Subscriber
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
    target: object
    type: TrackOpTypes | TriggerOpTypes
    key: any
    newValue?: any
    oldValue?: any
    oldTarget?: Map<any, any> | Set<any>
}

export interface DebuggerOptions {
    onTrack?: (event: DebuggerEvent) => void
    onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
    scheduler?: EffectScheduler
    allowRecurse?: boolean
    onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
    (): T
    effect: ReactiveEffect
}

export let activeSub: Subscriber | undefined

export enum EffectFlags {
    /**
     * 仅供 ReactiveEffect 使用
     */
    ACTIVE = 1 << 0,
    RUNNING = 1 << 1,
    TRACKING = 1 << 2,
    NOTIFIED = 1 << 3,
    DIRTY = 1 << 4,
    ALLOW_RECURSE = 1 << 5,
    PAUSED = 1 << 6,
    EVALUATED = 1 << 7,
}

/**
 * Subscriber 表示“订阅者”：
 * 它会追踪（或订阅）一组 dep。
 */
export interface Subscriber extends DebuggerOptions {
    /**
     * 当前订阅者依赖链表的头节点
     * @internal
     */
    deps?: Link
    /**
     * 同一条依赖链表的尾节点
     * @internal
     */
    depsTail?: Link
    /**
     * @internal
     */
    flags: EffectFlags
    /**
     * @internal
     */
    next?: Subscriber
    /**
     * 返回 `true` 表示这是一个 computed，
     * 还需要继续触发它自身 dep 的 notify
     * @internal
     */
    notify(): true | void
}

const pausedQueueEffects = new WeakSet<ReactiveEffect>()

export class ReactiveEffect<T = any>
    implements Subscriber, ReactiveEffectOptions
{
    /**
     * @internal
     */
    deps?: Link = undefined
    /**
     * @internal
     */
    depsTail?: Link = undefined
    /**
     * @internal
     */
    flags: EffectFlags = EffectFlags.ACTIVE | EffectFlags.TRACKING
    /**
     * @internal
     */
    next?: Subscriber = undefined
    /**
     * @internal
     */
    cleanup?: () => void = undefined

    scheduler?: EffectScheduler = undefined
    onStop?: () => void
    onTrack?: (event: DebuggerEvent) => void
    onTrigger?: (event: DebuggerEvent) => void

    constructor(public fn: () => T) {
        if (activeEffectScope) {
            if (activeEffectScope.active) {
                activeEffectScope.effects.push(this)
            } else {
                // 当前活跃 scope 已经被 stop。
                // 这种情况会出现在组件的 setup 因顶层 `await` 恢复执行时
                // （通过编译器生成的 `withAsyncContext` / `__restore()`），
                // 但组件其实已经在 <Suspense> 挂起期间被卸载。
                // 如果没有这个保护，这个 effect 会变成“孤儿”：
                // 它不再属于任何 scope（无法通过 scope 链 stop），
                // 却依然可以继续订阅响应式依赖并无限触发。
                this.flags &= ~EffectFlags.ACTIVE
            }
        }
    }

    pause(): void {
        this.flags |= EffectFlags.PAUSED
    }

    resume(): void {
        if (this.flags & EffectFlags.PAUSED) {
            this.flags &= ~EffectFlags.PAUSED
            if (pausedQueueEffects.has(this)) {
                pausedQueueEffects.delete(this)
                this.trigger()
            }
        }
    }

    /**
     * @internal
     */
    notify(): void {
        if (
            this.flags & EffectFlags.RUNNING &&
            !(this.flags & EffectFlags.ALLOW_RECURSE)
        ) {
            return
        }
        if (!(this.flags & EffectFlags.NOTIFIED)) {
            batch(this)
        }
    }

    run(): T {
        // TODO: cleanupEffect 相关逻辑后续可继续整理

        if (!(this.flags & EffectFlags.ACTIVE)) {
            // 清理过程中已经被 stop，直接执行原函数
            return this.fn()
        }

        this.flags |= EffectFlags.RUNNING
        cleanupEffect(this)
        prepareDeps(this)
        const prevEffect = activeSub
        const prevShouldTrack = shouldTrack
        activeSub = this
        shouldTrack = true

        try {
            return this.fn()
        } finally {
            cleanupDeps(this)
            activeSub = prevEffect
            shouldTrack = prevShouldTrack
            this.flags &= ~EffectFlags.RUNNING
        }
    }

    stop(): void {
        if (this.flags & EffectFlags.ACTIVE) {
            for (let link = this.deps; link; link = link.nextDep) {
                removeSub(link)
            }
            this.deps = this.depsTail = undefined
            cleanupEffect(this)
            this.onStop && this.onStop()
            this.flags &= ~EffectFlags.ACTIVE
        }
    }

    trigger(): void {
        if (this.flags & EffectFlags.PAUSED) {
            pausedQueueEffects.add(this)
        } else if (this.scheduler) {
            this.scheduler()
        } else {
            this.runIfDirty()
        }
    }

    /**
     * @internal
     */
    runIfDirty(): void {
        if (isDirty(this)) {
            this.run()
        }
    }

    get dirty(): boolean {
        return isDirty(this)
    }
}

/**
 * 调试时用于查看依赖链表
 */
// function printDeps(sub: Subscriber) {
//   let d = sub.deps
//   let ds = []
//   while (d) {
//     ds.push(d)
//     d = d.nextDep
//   }
//   return ds.map(d => ({
//     id: d.id,
//     prev: d.prevDep?.id,
//     next: d.nextDep?.id,
//   }))
// }

let batchDepth = 0
let batchedSub: Subscriber | undefined
let batchedComputed: Subscriber | undefined

export function batch(sub: Subscriber, isComputed = false): void {
    sub.flags |= EffectFlags.NOTIFIED
    if (isComputed) {
        sub.next = batchedComputed
        batchedComputed = sub
        return
    }
    sub.next = batchedSub
    batchedSub = sub
}

/**
 * 开始一个批处理区间
 * @internal
 */
export function startBatch(): void {
    batchDepth++
}

/**
 * 当所有批处理结束后，统一执行已入队的 effect
 * @internal
 */
export function endBatch(): void {
    if (--batchDepth > 0) {
        return
    }

    if (batchedComputed) {
        let e: Subscriber | undefined = batchedComputed
        batchedComputed = undefined
        while (e) {
            const next: Subscriber | undefined = e.next
            e.next = undefined
            e.flags &= ~EffectFlags.NOTIFIED
            e = next
        }
    }

    let error: unknown
    while (batchedSub) {
        let e: Subscriber | undefined = batchedSub
        batchedSub = undefined
        while (e) {
            const next: Subscriber | undefined = e.next
            e.next = undefined
            e.flags &= ~EffectFlags.NOTIFIED
            if (e.flags & EffectFlags.ACTIVE) {
                try {
                    // ACTIVE 标记只会出现在 effect 上
                    ;(e as ReactiveEffect).trigger()
                } catch (err) {
                    if (!error) error = err
                }
            }
            e = next
        }
    }

    if (error) throw error
}

function prepareDeps(sub: Subscriber) {
    // 为本轮依赖收集做准备，从链表头开始处理
    for (let link = sub.deps; link; link = link.nextDep) {
        // 先把旧依赖的版本标记为 -1，
        // 这样本轮执行结束后就能识别哪些依赖没再被访问过
        link.version = -1
        // 如果这个 link 在别的上下文里正被使用，先把旧状态存起来
        link.prevActiveLink = link.dep.activeLink
        link.dep.activeLink = link
    }
}

function cleanupDeps(sub: Subscriber) {
    // 清理本轮未使用到的旧依赖
    let head
    let tail = sub.depsTail
    let link = tail
    while (link) {
        const prev = link.prevDep
        if (link.version === -1) {
            if (link === tail) tail = prev
            // 这个依赖本轮未使用：从 dep 的订阅者链表中移除
            removeSub(link)
            // 同时也从当前 effect 的依赖链表中移除
            removeDep(link)
        } else {
            // 倒序遍历时，最后一个未被移除的节点就是新的头节点
            head = link
        }

        // 恢复进入本轮前 dep 上挂着的 activeLink
        link.dep.activeLink = link.prevActiveLink
        link.prevActiveLink = undefined
        link = prev
    }
    // 更新清理后的头尾指针
    sub.deps = head
    sub.depsTail = tail
}

function isDirty(sub: Subscriber): boolean {
    for (let link = sub.deps; link; link = link.nextDep) {
        if (
            link.dep.version !== link.version ||
            (link.dep.computed &&
                (refreshComputed(link.dep.computed) ||
                    link.dep.version !== link.version))
        ) {
            return true
        }
    }
    // @ts-expect-error only for backwards compatibility where libs manually set
    // 这个标记仅用于兼容手动设置该字段的旧用法，例如 Pinia 的测试模块
    if (sub._dirty) {
        return true
    }
    return false
}

/**
 * 刷新 computed 的缓存值
 * @internal
 */
export function refreshComputed(computed: ComputedRefImpl): undefined {
    if (
        computed.flags & EffectFlags.TRACKING &&
        !(computed.flags & EffectFlags.DIRTY)
    ) {
        return
    }
    computed.flags &= ~EffectFlags.DIRTY

    // 自上次刷新后如果全局版本没变，说明没有任何响应式变更，
    // 可以直接走快速路径跳过重新计算
    if (computed.globalVersion === globalVersion) {
        return
    }
    computed.globalVersion = globalVersion

    // SSR 下不会有渲染 effect，因此 computed 没有订阅者，
    // 也就不会建立依赖关系，不能只靠 dirty 检查判断是否重算。
    // 所以它会倾向于重新求值，再结合上面的 globalVersion 快速路径做缓存。
    // #12337：如果 computed 没有任何 deps（即不依赖响应式数据）且已经求值过，
    // 则无需重新计算。
    if (
        !computed.isSSR &&
        computed.flags & EffectFlags.EVALUATED &&
        ((!computed.deps && !(computed as any)._dirty) || !isDirty(computed))
    ) {
        return
    }
    computed.flags |= EffectFlags.RUNNING

    const dep = computed.dep
    const prevSub = activeSub
    const prevShouldTrack = shouldTrack
    activeSub = computed
    shouldTrack = true

    try {
        prepareDeps(computed)
        const value = computed.fn(computed._value)
        if (dep.version === 0 || hasChanged(value, computed._value)) {
            computed.flags |= EffectFlags.EVALUATED
            computed._value = value
            dep.version++
        }
    } catch (err) {
        dep.version++
        throw err
    } finally {
        activeSub = prevSub
        shouldTrack = prevShouldTrack
        cleanupDeps(computed)
        computed.flags &= ~EffectFlags.RUNNING
    }
}

function removeSub(link: Link, soft = false) {
    const { dep, prevSub, nextSub } = link
    if (prevSub) {
        prevSub.nextSub = nextSub
        link.prevSub = undefined
    }
    if (nextSub) {
        nextSub.prevSub = prevSub
        link.nextSub = undefined
    }

    if (dep.subs === link) {
        // 当前 link 原本是尾节点，尾指针回退到前一个
        dep.subs = prevSub

        if (!prevSub && dep.computed) {
            // 如果这是 computed 的最后一个订阅者，
            // 就把 computed 从它依赖的所有 dep 中取消订阅，
            // 这样 computed 及其缓存值都可以被 GC 回收
            dep.computed.flags &= ~EffectFlags.TRACKING
            for (let l = dep.computed.deps; l; l = l.nextDep) {
                // 这里只做“软移除”：
                // computed 自己仍然保留这些 dep 引用，因此 dep 的订阅计数不能减少
                removeSub(l, true)
            }
        }
    }

    if (!soft && !--dep.sc && dep.map) {
        // #11979
        // 这个属性对应的 dep 已经没有任何 effect 订阅者了，直接删除
        // 这主要用于对象仍留在内存里，但某一时刻只追踪其中部分属性的场景
        dep.map.delete(dep.key)
    }
}

function removeDep(link: Link) {
    const { prevDep, nextDep } = link
    if (prevDep) {
        prevDep.nextDep = nextDep
        link.prevDep = undefined
    }
    if (nextDep) {
        nextDep.prevDep = prevDep
        link.nextDep = undefined
    }
}

export function effect<T = any>(
    fn: () => T,
    options?: ReactiveEffectOptions,
): ReactiveEffectRunner<T> {
    if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
        fn = (fn as ReactiveEffectRunner).effect.fn
    }

    const e = new ReactiveEffect(fn)
    if (options) {
        extend(e, options)
    }
    try {
        e.run()
    } catch (err) {
        e.stop()
        throw err
    }
    const runner = e.run.bind(e) as ReactiveEffectRunner
    runner.effect = e
    return runner
}

/**
 * 停止 runner 关联的 effect。
 *
 * @param runner - 要停止追踪的 effect runner
 */
export function stop(runner: ReactiveEffectRunner): void {
    runner.effect.stop()
}

/**
 * 是否允许进行依赖收集
 * @internal
 */
export let shouldTrack = true
const trackStack: boolean[] = []

/**
 * 暂时暂停依赖收集
 */
export function pauseTracking(): void {
    trackStack.push(shouldTrack)
    shouldTrack = false
}

/**
 * 重新启用依赖收集（如果之前被暂停过）
 */
export function enableTracking(): void {
    trackStack.push(shouldTrack)
    shouldTrack = true
}

/**
 * 恢复到上一次的依赖收集状态
 */
export function resetTracking(): void {
    const last = trackStack.pop()
    shouldTrack = last === undefined ? true : last
}

/**
 * 给当前活跃 effect 注册清理函数。
 * 清理函数会在下一次 effect 执行前，或者 effect 被 stop 时调用。
 *
 * @param fn - 要注册的清理函数
 * @param failSilently - 预留参数；为 `true` 时表示静默失败
 */
export function onEffectCleanup(fn: () => void, failSilently = false): void {
    if (activeSub instanceof ReactiveEffect) {
        activeSub.cleanup = fn
    }
}

function cleanupEffect(e: ReactiveEffect) {
    const { cleanup } = e
    e.cleanup = undefined
    if (cleanup) {
        // 执行 cleanup 时临时清空 active effect，避免错误收集依赖
        const prevSub = activeSub
        activeSub = undefined
        try {
            cleanup()
        } finally {
            activeSub = prevSub
        }
    }
}
