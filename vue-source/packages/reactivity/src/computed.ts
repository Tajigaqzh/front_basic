import {activeSub, batch, DebuggerEvent, DebuggerOptions, EffectFlags, refreshComputed, Subscriber} from "./effect";
import {Dep, Link,globalVersion} from "./dep";
import { ReactiveFlags, TrackOpTypes } from './constants'
import {Ref} from "./ref";
import {isFunction} from "@vue-source/shared";


declare const ComputedRefSymbol: unique symbol
declare const WritableComputedRefSymbol: unique symbol

interface BaseComputedRef<T, S = T> extends Ref<T, S> {
    [ComputedRefSymbol]: true
    /**
     * @deprecated computed no longer uses effect
     */
    effect: ComputedRefImpl
}

export interface ComputedRef<T = any> extends BaseComputedRef<T> {
    readonly value: T
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
    [WritableComputedRefSymbol]: true
}

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T, S = T> {
    get: ComputedGetter<T>
    set: ComputedSetter<S>
}


/**
 * `computed` 的内部实现类。
 * 它会从 `@vue/reactivity` 导出给 Vue runtime 使用，
 * 但不会作为主 `vue` 包的公开 API 暴露。
 */
export class ComputedRefImpl<T = any> implements Subscriber {
    /**
     * @internal
     */
    _value: any = undefined
    /**
     * @internal
     */
    readonly dep: Dep = new Dep(this)
    /**
     * @internal
     */
    readonly __v_isRef = true
    // TODO isolatedDeclarations ReactiveFlags.IS_REF
    /**
     * @internal
     */
    readonly __v_isReadonly: boolean
    // TODO isolatedDeclarations ReactiveFlags.IS_READONLY
    // computed 自己也是一个 subscriber，会追踪 getter 内部访问到的依赖。
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
    flags: EffectFlags = EffectFlags.DIRTY
    /**
     * @internal
     */
    globalVersion: number = globalVersion - 1
    /**
     * @internal
     */
    isSSR: boolean
    /**
     * @internal
     */
    next?: Subscriber = undefined

    // 兼容旧实现中通过 `.effect` 访问内部对象的写法。
    effect: this = this
    // 仅开发环境调试使用。
    onTrack?: (event: DebuggerEvent) => void
    // 仅开发环境调试使用。
    onTrigger?: (event: DebuggerEvent) => void

    /**
     * 仅开发环境使用。
     * @internal
     */
    _warnRecursive?: boolean

    constructor(
        public fn: ComputedGetter<T>,
        private readonly setter: ComputedSetter<T> | undefined,
        isSSR: boolean,
    ) {
        // 没有 setter 的 computed 天然是只读的。
        this[ReactiveFlags.IS_READONLY] = !setter
        this.isSSR = isSSR
    }

    /**
     * @internal
     */
    notify(): true | void {
        this.flags |= EffectFlags.DIRTY
        if (
            !(this.flags & EffectFlags.NOTIFIED) &&
            // 避免 computed 自己触发自己，造成无限递归。
            activeSub !== this
        ) {
            batch(this, true)
            return true
        }
    }

    get value(): T {
        // 先收集“谁依赖了这个 computed”。
        const link = this.dep.track()
        // 再按需刷新缓存值。
        refreshComputed(this)
        // 求值完成后，把 link 的版本同步到最新 dep 版本。
        if (link) {
            link.version = this.dep.version
        }
        return this._value
    }

    set value(newValue) {
        if (this.setter) {
            // 可写 computed 会把赋值动作转发给用户提供的 setter。
            this.setter(newValue)
        }
    }
}



/**
 * 创建一个带缓存的派生 ref。
 *
 * 它会在首次读取时执行 getter，并缓存结果；
 * 后续只有当依赖发生变化时，才会重新计算。
 *
 * 它既支持只读形式 `computed(getter)`，
 * 也支持可写形式 `computed({ get, set })`。
 *
 * @param getter - 只读形式下用于计算值的 getter。
 * @param debugOptions - 调试选项。
 * @see {@link https://vuejs.org/api/reactivity-core.html#computed}
 */
export function computed<T>(
    getter: ComputedGetter<T>,
    debugOptions?: DebuggerOptions,
): ComputedRef<T>
export function computed<T, S = T>(
    options: WritableComputedOptions<T, S>,
    debugOptions?: DebuggerOptions,
): WritableComputedRef<T, S>
/*@__NO_SIDE_EFFECTS__*/
export function computed<T>(
    getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
    debugOptions?: DebuggerOptions,
    isSSR = false,
) {
    // 统一把两种签名归一化成 getter / setter 形式。
    let getter: ComputedGetter<T>
    let setter: ComputedSetter<T> | undefined

    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions
    } else {
        getter = getterOrOptions.get
        setter = getterOrOptions.set
    }

    // 创建 computed 的内部实现对象。
    const cRef = new ComputedRefImpl(getter, setter, isSSR)
    return cRef as any
}
