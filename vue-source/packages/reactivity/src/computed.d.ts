import { type DebuggerEvent, type DebuggerOptions, EffectFlags, type Subscriber } from './effect';
import type { Ref } from './ref';
import { Dep, type Link } from './dep';
declare const ComputedRefSymbol: unique symbol;
declare const WritableComputedRefSymbol: unique symbol;
interface BaseComputedRef<T, S = T> extends Ref<T, S> {
    [ComputedRefSymbol]: true;
    /**
     * @deprecated computed no longer uses effect
     */
    effect: ComputedRefImpl;
}
export interface ComputedRef<T = any> extends BaseComputedRef<T> {
    readonly value: T;
}
export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
    [WritableComputedRefSymbol]: true;
}
export type ComputedGetter<T> = (oldValue?: T) => T;
export type ComputedSetter<T> = (newValue: T) => void;
export interface WritableComputedOptions<T, S = T> {
    get: ComputedGetter<T>;
    set: ComputedSetter<S>;
}
/**
 * @private exported by @vue-source/reactivity for Vue core use, but not exported from
 * the main vue package
 */
export declare class ComputedRefImpl<T = any> implements Subscriber {
    fn: ComputedGetter<T>;
    private readonly setter;
    /**
     * @internal
     */
    _value: any;
    /**
     * @internal
     */
    readonly dep: Dep;
    /**
     * @internal
     */
    readonly __v_isRef = true;
    /**
     * @internal
     */
    readonly __v_isReadonly: boolean;
    /**
     * @internal
     */
    deps?: Link;
    /**
     * @internal
     */
    depsTail?: Link;
    /**
     * @internal
     */
    flags: EffectFlags;
    /**
     * @internal
     */
    globalVersion: number;
    /**
     * @internal
     */
    isSSR: boolean;
    /**
     * @internal
     */
    next?: Subscriber;
    effect: this;
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
    /**
     * Dev only
     * @internal
     */
    _warnRecursive?: boolean;
    constructor(fn: ComputedGetter<T>, setter: ComputedSetter<T> | undefined, isSSR: boolean);
    /**
     * @internal
     */
    notify(): true | void;
    get value(): T;
    set value(newValue: T);
}
/**
 * Takes a getter function and returns a readonly reactive ref object for the
 * returned value from the getter. It can also take an object with get and set
 * functions to create a writable ref object.
 *
 * @example
 * ```js
 * // Creating a readonly computed ref:
 * const count = ref(1)
 * const plusOne = computed(() => count.value + 1)
 *
 * console.log(plusOne.value) // 2
 * plusOne.value++ // error
 * ```
 *
 * ```js
 * // Creating a writable computed ref:
 * const count = ref(1)
 * const plusOne = computed({
 *   get: () => count.value + 1,
 *   set: (val) => {
 *     count.value = val - 1
 *   }
 * })
 *
 * plusOne.value = 1
 * console.log(count.value) // 0
 * ```
 *
 * @param getter - Function that produces the next value.
 * @param debugOptions - For debugging. See {@link https://vuejs.org/guide/extras-source/reactivity-in-depth.html#computed-debugging}.
 * @see {@link https://vuejs.org/api-source/reactivity-core.html#computed}
 */
export declare function computed<T>(getter: ComputedGetter<T>, debugOptions?: DebuggerOptions): ComputedRef<T>;
export declare function computed<T, S = T>(options: WritableComputedOptions<T, S>, debugOptions?: DebuggerOptions): WritableComputedRef<T, S>;
export {};
//# sourceMappingURL=computed.d.ts.map