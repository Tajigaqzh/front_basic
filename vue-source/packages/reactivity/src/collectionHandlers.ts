import {
    type Target,
    isReadonly,
    isShallow,
    toRaw,
    toReactive,
    toReadonly,
} from './reactive'
import { ITERATE_KEY, MAP_KEY_ITERATE_KEY, track, trigger } from './dep'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import {
    capitalize,
    extend,
    hasChanged,
    hasOwn,
    isMap,
    toRawType,
} from '@vue-source/shared'

type CollectionTypes = IterableCollections | WeakCollections

type IterableCollections = (Map<any, any> | Set<any>) & Target
type WeakCollections = (WeakMap<any, any> | WeakSet<any>) & Target
type MapTypes = (Map<any, any> | WeakMap<any, any>) & Target
type SetTypes = (Set<any> | WeakSet<any>) & Target

// 浅模式下不做任何包装，原样返回值。
const toShallow = <T extends unknown>(value: T): T => value

// 统一获取集合对象原型，便于复用原生方法。
const getProto = <T extends CollectionTypes>(v: T): any =>
    Reflect.getPrototypeOf(v)

/**
 * 为集合类型创建迭代方法包装器。
 *
 * 它会在迭代开始时建立遍历依赖，并把迭代产出的键值
 * 转成与当前代理模式一致的包装值。
 */
function createIterableMethod(
    method: string | symbol,
    isReadonly: boolean,
    isShallow: boolean,
) {
    return function (
        this: IterableCollections,
        ...args: unknown[]
    ): Iterable<unknown> & Iterator<unknown> {
        const target = this[ReactiveFlags.RAW]
        const rawTarget = toRaw(target)
        const targetIsMap = isMap(rawTarget)
        const isPair =
            method === 'entries' || (method === Symbol.iterator && targetIsMap)
        const isKeyOnly = method === 'keys' && targetIsMap
        const innerIterator = target[method](...args)
        const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
        !isReadonly &&
        track(
            rawTarget,
            TrackOpTypes.ITERATE,
            isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY,
        )
        // 返回一个包装后的迭代器，把原始迭代器产出的值再转换成对应模式。
        return extend(
            // 继承原始迭代器上的其他属性。
            Object.create(innerIterator),
            {
                // 实现标准迭代器协议。
                next() {
                    const { value, done } = innerIterator.next()
                    return done
                        ? { value, done }
                        : {
                            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                            done,
                        }
                },
            },
        )
    }
}

/**
 * 生成只读集合上的“写操作替身”。
 *
 * 这些方法不会真的修改底层集合，只返回与原生接口形状兼容的结果。
 */
function createReadonlyMethod(type: TriggerOpTypes): Function {
    return function (this: CollectionTypes, ...args: unknown[]) {
        return type === TriggerOpTypes.DELETE
            ? false
            : type === TriggerOpTypes.CLEAR
                ? undefined
                : this
    }
}

type Instrumentations = Record<string | symbol, Function | number>

/**
 * 按“是否只读 / 是否浅层”生成一整套集合增强方法。
 *
 * 这里统一处理 `Map/Set/WeakMap/WeakSet` 的读取、写入、遍历和依赖收集逻辑。
 */
function createInstrumentations(
    readonly: boolean,
    shallow: boolean,
): Instrumentations {
    const instrumentations: Instrumentations = {
        get(this: MapTypes, key: unknown) {
            // 嵌套包装场景下，读取出来的值仍需要转换成对应的只读 / 响应式版本。
            const target = this[ReactiveFlags.RAW]
            const rawTarget = toRaw(target)
            const rawKey = toRaw(key)
            if (!readonly) {
                if (hasChanged(key, rawKey)) {
                    track(rawTarget, TrackOpTypes.GET, key)
                }
                track(rawTarget, TrackOpTypes.GET, rawKey)
            }
            const { has } = getProto(rawTarget)
            const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive
            if (has.call(rawTarget, key)) {
                return wrap(target.get(key))
            } else if (has.call(rawTarget, rawKey)) {
                return wrap(target.get(rawKey))
            } else if (target !== rawTarget) {
                // 确保嵌套的响应式 Map 在特殊包装场景下仍能完成自己的依赖追踪。
                target.get(key)
            }
        },
        get size() {
            const target = (this as unknown as IterableCollections)[ReactiveFlags.RAW]
            !readonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
            return target.size
        },
        has(this: CollectionTypes, key: unknown): boolean {
            const target = this[ReactiveFlags.RAW]
            const rawTarget = toRaw(target)
            const rawKey = toRaw(key)
            if (!readonly) {
                if (hasChanged(key, rawKey)) {
                    track(rawTarget, TrackOpTypes.HAS, key)
                }
                track(rawTarget, TrackOpTypes.HAS, rawKey)
            }
            return key === rawKey
                ? target.has(key)
                : target.has(key) || target.has(rawKey)
        },
        forEach(this: IterableCollections, callback: Function, thisArg?: unknown) {
            const observed = this
            const target = observed[ReactiveFlags.RAW]
            const rawTarget = toRaw(target)
            const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive
            !readonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)
            return target.forEach((value: unknown, key: unknown) => {
                // 回调需要满足两点：
                // 1. `this` 和第三个参数都应是当前代理对象。
                // 2. 传给回调的键和值必须是当前模式下对应的包装值。
                return callback.call(thisArg, wrap(value), wrap(key), observed)
            })
        },
    }

    extend(
        instrumentations,
        readonly
            ? {
                add: createReadonlyMethod(TriggerOpTypes.ADD),
                set: createReadonlyMethod(TriggerOpTypes.SET),
                delete: createReadonlyMethod(TriggerOpTypes.DELETE),
                clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
            }
            : {
                add(this: SetTypes, value: unknown) {
                    const target = toRaw(this)
                    const proto = getProto(target)
                    const rawValue = toRaw(value)
                    const valueToAdd =
                        !shallow && !isShallow(value) && !isReadonly(value)
                            ? rawValue
                            : value
                    const hadKey =
                        proto.has.call(target, valueToAdd) ||
                        (hasChanged(value, valueToAdd) &&
                            proto.has.call(target, value)) ||
                        (hasChanged(rawValue, valueToAdd) &&
                            proto.has.call(target, rawValue))
                    if (!hadKey) {
                        target.add(valueToAdd)
                        trigger(target, TriggerOpTypes.ADD, valueToAdd, valueToAdd)
                    }
                    return this
                },
                set(this: MapTypes, key: unknown, value: unknown) {
                    if (!shallow && !isShallow(value) && !isReadonly(value)) {
                        value = toRaw(value)
                    }
                    const target = toRaw(this)
                    const { has, get } = getProto(target)

                    let hadKey = has.call(target, key)
                    if (!hadKey) {
                        key = toRaw(key)
                        hadKey = has.call(target, key)
                    }

                    const oldValue = get.call(target, key)
                    target.set(key, value)
                    if (!hadKey) {
                        trigger(target, TriggerOpTypes.ADD, key, value)
                    } else if (hasChanged(value, oldValue)) {
                        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
                    }
                    return this
                },
                delete(this: CollectionTypes, key: unknown) {
                    const target = toRaw(this)
                    const { has, get } = getProto(target)
                    let hadKey = has.call(target, key)
                    if (!hadKey) {
                        key = toRaw(key)
                        hadKey = has.call(target, key)
                    }

                    const oldValue = get ? get.call(target, key) : undefined
                    // 先执行真实删除，再统一调度响应式更新。
                    const result = target.delete(key)
                    if (hadKey) {
                        trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
                    }
                    return result
                },
                clear(this: IterableCollections) {
                    const target = toRaw(this)
                    const hadItems = target.size !== 0
                    const oldTarget = undefined
                    // 先执行真实清空，再统一触发依赖。
                    const result = target.clear()
                    if (hadItems) {
                        trigger(
                            target,
                            TriggerOpTypes.CLEAR,
                            undefined,
                            undefined,
                            oldTarget,
                        )
                    }
                    return result
                },
            },
    )

    const iteratorMethods = [
        'keys',
        'values',
        'entries',
        Symbol.iterator,
    ] as const

    iteratorMethods.forEach(method => {
        instrumentations[method] = createIterableMethod(method, readonly, shallow)
    })

    return instrumentations
}

/**
 * 为集合代理构造统一的 `get` 拦截器。
 *
 * 内部优先返回我们增强过的方法；如果当前 key 没有增强实现，
 * 就回退到原始集合对象上的属性/方法。
 */
function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
    const instrumentations = createInstrumentations(isReadonly, shallow)

    return (
        target: CollectionTypes,
        key: string | symbol,
        receiver: CollectionTypes,
    ) => {
        if (key === ReactiveFlags.IS_REACTIVE) {
            return !isReadonly
        } else if (key === ReactiveFlags.IS_READONLY) {
            return isReadonly
        } else if (key === ReactiveFlags.RAW) {
            return target
        }

        return Reflect.get(
            hasOwn(instrumentations, key) && key in target
                ? instrumentations
                : target,
            key,
            receiver,
        )
    }
}

export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
    get: /*@__PURE__*/ createInstrumentationGetter(false, false),
}

export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
    get: /*@__PURE__*/ createInstrumentationGetter(false, true),
}

export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
    get: /*@__PURE__*/ createInstrumentationGetter(true, false),
}

export const shallowReadonlyCollectionHandlers: ProxyHandler<CollectionTypes> =
    {
        get: /*@__PURE__*/ createInstrumentationGetter(true, true),
    }

/**
 * 检查集合中是否同时存在“代理 key”和“原始 key”两种身份。
 *
 * 这类情况会让 `Map/Set` 的键一致性变得模糊，因此这里单独留一个检查入口。
 */
function checkIdentityKeys(
    target: CollectionTypes,
    has: (key: unknown) => boolean,
    key: unknown,
) {
    const rawKey = toRaw(key)
    if (rawKey !== key && has.call(target, rawKey)) {
        const type = toRawType(target)
    }
}
