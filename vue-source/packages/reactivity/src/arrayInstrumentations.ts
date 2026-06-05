// 数组增强模块：对数组方法做一层响应式包装，
// 让遍历、查找和变更都能正确收集或触发依赖。
import {isProxy, isReactive, isReadonly, isShallow, toRaw, toReactive, toReadonly} from "./reactive";
import {isArray} from "@vue-source/shared";
import {endBatch, pauseTracking, resetTracking, startBatch} from "./effect";
import {ARRAY_ITERATE_KEY, track} from "./dep";
import {TrackOpTypes} from "./constants";



/**
 * 为数组遍历建立依赖，并返回适合后续方法调用的数组视图：
 * - 输入是深响应式数组时，返回“原始数组 + 响应式元素”的浅包装
 * - 输入不是深响应式数组或本身是浅响应式数组时，直接返回原始数组
 */
export function reactiveReadArray<T>(array: T[]): T[] {
    const raw = toRaw(array)
    if (raw === array) return raw
    track(raw, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
    return isShallow(array) ? raw : raw.map(toReactive)
}

/**
 * 为数组遍历建立依赖，并直接返回原始数组。
 */
export function shallowReadArray<T>(arr: T[]): T[] {
    track((arr = toRaw(arr)), TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
    return arr
}

// 源码自身按 ES2016 约束编写，但用户运行环境可能更高，
// 所以这里把更高版本的数组方法也纳入类型范围。
type ArrayMethods = keyof Array<any> | 'findLast' | 'findLastIndex'

const arrayProto = Array.prototype

/**
 * 包装一类“可能读取整个数组”的方法，让它们正确收集 `ARRAY_ITERATE` 依赖，
 * 并在需要时把传入回调、返回值或数组元素重新包成响应式值。
 */
function apply(
    self: unknown[],
    method: ArrayMethods,
    fn: (item: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
    wrappedRetFn?: (result: any) => unknown,
    args?: IArguments,
) {
    const arr = shallowReadArray(self)
    const needsWrap = arr !== self && !isShallow(self)
    // @ts-expect-error our code is limited to es2016 but user code is not
    const methodFn = arr[method]

    // 如果调用的方法来自用户扩展的 Array 子类，那么参数顺序和类型都可能不可知。
    // 这种情况下跳过我们的浅读取包装，直接用原始 `self` 调用。
    if (methodFn !== arrayProto[method as any]) {
        const result = methodFn.apply(self, args)
        return needsWrap ? toReactive(result) : result
    }

    let wrappedFn = fn
    if (arr !== self) {
        if (needsWrap) {
            wrappedFn = function (this: unknown, item, index) {
                return fn.call(this, toWrapped(self, item), index, self)
            }
        } else if (fn.length > 2) {
            wrappedFn = function (this: unknown, item, index) {
                return fn.call(this, item, index, self)
            }
        }
    }
    const result = methodFn.call(arr, wrappedFn, thisArg)
    return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result
}

/**
 * 包装数组迭代器，让 `Symbol.iterator`、`entries`、`values`
 * 产出的元素在迭代时仍符合当前数组的响应式/只读语义。
 */
function iterator(
    self: unknown[],
    method: keyof Array<unknown>,
    wrapValue: (value: any) => unknown,
) {
    // 严格来说真正访问数组元素发生在 `.next()` 时，不是在创建迭代器时。
    // 这里把它简化成一次 ARRAY_ITERATE 依赖收集，因为 JS 迭代器通常只消费一次。
    const arr = shallowReadArray(self)
    const iter = (arr[method] as any)() as IterableIterator<unknown> & {
        _next: IterableIterator<unknown>['next']
    }
    if (arr !== self && !isShallow(self)) {
        iter._next = iter.next
        iter.next = () => {
            const result = iter._next()
            if (!result.done) {
                result.value = wrapValue(result.value)
            }
            return result
        }
    }
    return iter
}

/**
 * 包装 `reduce` / `reduceRight`，让归并过程同样建立数组遍历依赖，
 * 并在需要时对累计值和元素做响应式包装。
 */
function reduce(
    self: unknown[],
    method: keyof Array<any>,
    fn: (acc: unknown, item: unknown, index: number, array: unknown[]) => unknown,
    args: unknown[],
) {
    const arr = shallowReadArray(self)
    const needsWrap = arr !== self && !isShallow(self)
    let wrappedFn = fn
    let wrapInitialAccumulator = false
    if (arr !== self) {
        if (needsWrap) {
            wrapInitialAccumulator = args.length === 0
            wrappedFn = function (this: unknown, acc, item, index) {
                if (wrapInitialAccumulator) {
                    wrapInitialAccumulator = false
                    acc = toWrapped(self, acc)
                }
                return fn.call(this, acc, toWrapped(self, item), index, self)
            }
        } else if (fn.length > 3) {
            wrappedFn = function (this: unknown, acc, item, index) {
                return fn.call(this, acc, item, index, self)
            }
        }
    }
    const result = (arr[method] as any)(wrappedFn, ...args)
    return wrapInitialAccumulator ? toWrapped(self, result) : result
}

/**
 * 包装 `includes/indexOf/lastIndexOf` 这类依赖“值身份”的查找方法。
 *
 * 目的在于兼容“数组里存的是原始对象，但查找时传进来的是代理对象”
 * 这类代理壳不一致的情况。
 */
function searchProxy(
    self: unknown[],
    method: keyof Array<any>,
    args: unknown[],
) {
    const arr = toRaw(self) as any
    track(arr, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
    // 先直接用原参数执行一次，参数本身可能就是代理对象。
    const res = arr[method](...args)

    // 如果第一次没找到，再把参数转成原始值重试。
    if ((res === -1 || res === false) && isProxy(args[0])) {
        args[0] = toRaw(args[0])
        return arr[method](...args)
    }

    return res
}

/**
 * 根据当前数组自身的代理模式，把读出的元素包装成对应的值：
 * 可变数组返回 reactive 值，只读数组返回 readonly 值，浅模式则尽量保持原样。
 */
function toWrapped(target: unknown, item: unknown) {
    if (isReadonly(target)) {
        return isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item)
    }
    return toReactive(item)
}

export const arrayInstrumentations: Record<string | symbol, Function> = <any>{
    __proto__: null,

    [Symbol.iterator]() {
        return iterator(this, Symbol.iterator, item => toWrapped(this, item))
    },

    concat(...args: unknown[]) {
        return reactiveReadArray(this).concat(
            ...args.map(x => (isArray(x) ? reactiveReadArray(x) : x)),
        )
    },

    entries() {
        return iterator(this, 'entries', (value: [number, unknown]) => {
            value[1] = toWrapped(this, value[1])
            return value
        })
    },

    every(
        fn: (item: unknown, index: number, array: unknown[]) => unknown,
        thisArg?: unknown,
    ) {
        return apply(this, 'every', fn, thisArg, undefined, arguments)
    },

    filter(
        fn: (item: unknown, index: number, array: unknown[]) => unknown,
        thisArg?: unknown,
    ) {
        return apply(
            this,
            'filter',
            fn,
            thisArg,
            v => v.map((item: unknown) => toWrapped(this, item)),
            arguments,
        )
    },

    find(
        fn: (item: unknown, index: number, array: unknown[]) => boolean,
        thisArg?: unknown,
    ) {
        return apply(
            this,
            'find',
            fn,
            thisArg,
            item => toWrapped(this, item),
            arguments,
        )
    },

    findIndex(
        fn: (item: unknown, index: number, array: unknown[]) => boolean,
        thisArg?: unknown,
    ) {
        return apply(this, 'findIndex', fn, thisArg, undefined, arguments)
    },

    findLast(
        fn: (item: unknown, index: number, array: unknown[]) => boolean,
        thisArg?: unknown,
    ) {
        return apply(
            this,
            'findLast',
            fn,
            thisArg,
            item => toWrapped(this, item),
            arguments,
        )
    },

    findLastIndex(
        fn: (item: unknown, index: number, array: unknown[]) => boolean,
        thisArg?: unknown,
    ) {
        return apply(this, 'findLastIndex', fn, thisArg, undefined, arguments)
    },

    // `flat/flatMap` 理论上也能利用 ARRAY_ITERATE，
    // 但实现和边界处理不够直接，这里先不做。

    forEach(
        fn: (item: unknown, index: number, array: unknown[]) => unknown,
        thisArg?: unknown,
    ) {
        return apply(this, 'forEach', fn, thisArg, undefined, arguments)
    },

    includes(...args: unknown[]) {
        return searchProxy(this, 'includes', args)
    },

    indexOf(...args: unknown[]) {
        return searchProxy(this, 'indexOf', args)
    },

    join(separator?: string) {
        return reactiveReadArray(this).join(separator)
    },

    // `keys()` 只依赖 `length`，这里不做额外优化。

    lastIndexOf(...args: unknown[]) {
        return searchProxy(this, 'lastIndexOf', args)
    },

    map(
        fn: (item: unknown, index: number, array: unknown[]) => unknown,
        thisArg?: unknown,
    ) {
        return apply(this, 'map', fn, thisArg, undefined, arguments)
    },

    pop() {
        return noTracking(this, 'pop')
    },

    push(...args: unknown[]) {
        return noTracking(this, 'push', args)
    },

    reduce(
        fn: (
            acc: unknown,
            item: unknown,
            index: number,
            array: unknown[],
        ) => unknown,
        ...args: unknown[]
    ) {
        return reduce(this, 'reduce', fn, args)
    },

    reduceRight(
        fn: (
            acc: unknown,
            item: unknown,
            index: number,
            array: unknown[],
        ) => unknown,
        ...args: unknown[]
    ) {
        return reduce(this, 'reduceRight', fn, args)
    },

    shift() {
        return noTracking(this, 'shift')
    },

    // `slice` 也可以使用 ARRAY_ITERATE，但它更像是范围级追踪问题，这里先不展开。

    some(
        fn: (item: unknown, index: number, array: unknown[]) => unknown,
        thisArg?: unknown,
    ) {
        return apply(this, 'some', fn, thisArg, undefined, arguments)
    },

    splice(...args: unknown[]) {
        return noTracking(this, 'splice', args)
    },

    toReversed() {
        // @ts-expect-error user code may run in es2016+
        return reactiveReadArray(this).toReversed()
    },

    toSorted(comparer?: (a: unknown, b: unknown) => number) {
        // @ts-expect-error user code may run in es2016+
        return reactiveReadArray(this).toSorted(comparer)
    },

    toSpliced(...args: unknown[]) {
        // @ts-expect-error user code may run in es2016+
        return (reactiveReadArray(this).toSpliced as any)(...args)
    },

    unshift(...args: unknown[]) {
        return noTracking(this, 'unshift', args)
    },

    values() {
        return iterator(this, 'values', item => toWrapped(this, item))
    },
}


/**
 * 对会改变数组长度的方法临时关闭追踪。
 *
 * 这样可以避免这些方法内部读取 `length` 时，把当前正在运行的副作用
 * 错误地重新收集进去，从而引发递归触发。
 */
function noTracking(
    self: unknown[],
    method: keyof Array<any>,
    args: unknown[] = [],
) {
    // 先暂停追踪，避免这些方法内部读取 `length` 时把自己错误收进去。
    pauseTracking()
    // 批量触发，减少同一轮里的重复调度。
    startBatch()
    const res = (toRaw(self) as any)[method].apply(self, args)
    endBatch()
    // 恢复外层原有的追踪状态。
    resetTracking()
    return res
}
