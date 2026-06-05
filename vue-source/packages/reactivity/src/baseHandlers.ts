import {
    isReadonly, isShallow,
    reactive,
    reactiveMap,
    readonly,
    readonlyMap,
    shallowReactiveMap,
    shallowReadonlyMap,
    type Target,
    toRaw
} from "./reactive";
import {ReactiveFlags, TrackOpTypes, TriggerOpTypes} from "./constants";
import {hasChanged, hasOwn, isArray, isIntegerKey, isObject, isSymbol, makeMap} from "@vue-source/shared";
import {isRef} from "./ref";
import {arrayInstrumentations} from "./arrayInstrumentations";
import {ITERATE_KEY, track, trigger} from "./dep";

// 这些 key 属于内部字段或原型链字段，不应该参与依赖收集。
const isNonTrackableKeys = /*@__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)


const builtInSymbols = new Set(
    /*@__PURE__*/
    Object.getOwnPropertyNames(Symbol)
        // 在 ios10.x 上，`Object.getOwnPropertyNames(Symbol)` 可能会枚举出
        // `arguments` 和 `caller`，但访问 `Symbol` 上这两个属性会抛出
        // `TypeError`，因为 `Symbol` 是严格模式函数。
        .filter(key => key !== 'arguments' && key !== 'caller')
        .map(key => Symbol[key as keyof SymbolConstructor])
        .filter(isSymbol),
)

/**
 * 为代理对象补一个可跟踪的 `hasOwnProperty` 实现，
 * 让属性存在性判断同样能够建立依赖。
 */
function hasOwnProperty(this: object, key: unknown) {
    // `hasOwnProperty` 可能会收到非字符串 key，这里统一转成字符串。
    if (!isSymbol(key)) key = String(key)
    // `this` 可能是代理对象，这里先取回原对象，再在原对象上做存在性判断和依赖收集。
    const obj = toRaw(this)
    track(obj, TrackOpTypes.HAS, key)
    return obj.hasOwnProperty(key as string)
}
// 普通对象 / 数组的基础响应式处理器。
// 负责 `get` 读取逻辑，`set/delete` 由子类按可写或只读场景继续扩展。
class BaseReactiveHandler implements ProxyHandler<Target> {
    constructor(
        protected readonly _isReadonly = false,
        protected readonly _isShallow = false,
    ) {}

    // 拦截属性读取，处理内部标记、依赖收集、ref 解包和嵌套对象代理化。
    get(target: Target, key: string | symbol, receiver: object): any {
        // `SKIP` 是一个内部开关位，允许外部读取但不需要额外逻辑。
        if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP]

        const isReadonly = this._isReadonly,
            isShallow = this._isShallow
        // 以下几个分支都是读取代理自身的内部状态，不是真实业务属性。
        if (key === ReactiveFlags.IS_REACTIVE) {
            return !isReadonly
        } else if (key === ReactiveFlags.IS_READONLY) {
            return isReadonly
        } else if (key === ReactiveFlags.IS_SHALLOW) {
            return isShallow
        } else if (key === ReactiveFlags.RAW) {
            // 只有“当前确实是这个 target 对应的合法代理”时，
            // 才允许把底层原对象暴露出去。
            if (
                receiver ===
                (isReadonly
                        ? isShallow
                            ? shallowReadonlyMap
                            : readonlyMap
                        : isShallow
                            ? shallowReactiveMap
                            : reactiveMap
                ).get(target) ||
                // `receiver` 不是当前响应式代理，但和原对象拥有相同原型，
                // 这通常说明用户又包了一层代理，这里仍允许读取到原对象。
                Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
            ) {
                return target
            }
            // 不满足 RAW 的返回条件时，提前返回 `undefined`。
            return
        }

        const targetIsArray = isArray(target)

        if (!isReadonly) {
            let fn: Function | undefined
            // 数组的部分方法被特殊改写过，
            // 目的是修正查找、遍历、变更长度时的依赖行为。
            if (targetIsArray && (fn = arrayInstrumentations[key])) {
                return fn
            }
            // `hasOwnProperty` 也要做可追踪版本替换。
            if (key === 'hasOwnProperty') {
                return hasOwnProperty
            }
        }

        const res = Reflect.get(
            target,
            key,
            // 如果目标本身是被代理过的 ref，就让方法以原始 ref 作为 receiver 执行，
            // 这样 ref 的实例方法内部就不需要反复 `toRaw`。
            isRef(target) ? target : receiver,
        )

        if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
            // 内建 symbol 或不应追踪的字段，直接返回，避免污染依赖图。
            return res
        }

        if (!isReadonly) {
            // 读取普通属性时建立 GET 依赖。
            track(target, TrackOpTypes.GET, key)
        }

        if (isShallow) {
            // 浅层模式只追踪根层读取，不递归包装返回值。
            return res
        }

        if (isRef(res)) {
            // ref 解包：数组的整数索引位置不自动解包，保持数组访问语义稳定。
            const value = targetIsArray && isIntegerKey(key) ? res : res.value
            return isReadonly && isObject(value) ? readonly(value) : value
        }

        if (isObject(res)) {
            // 读取到嵌套对象时也要懒转换成代理。
            // 先判断 `isObject` 可以避免无效值告警；
            // 延迟调用 `readonly/reactive` 可以避免循环依赖。
            return isReadonly ? readonly(res) : reactive(res)
        }

        return res
    }
}

// 可变响应式处理器：在基础 `get` 逻辑上补充写、删、枚举等行为。
class MutableReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow = false) {
        super(false, isShallow)
    }

    set(
        target: Record<string | symbol, unknown>,
        key: string | symbol,
        value: unknown,
        receiver: object,
    ): boolean {
        // 先记住旧值，后面用于变更比较和触发时透传 oldValue。
        let oldValue = target[key]
        const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key)
        if (!this._isShallow) {
            const isOldValueReadonly = isReadonly(oldValue)
            if (!isShallow(value) && !isReadonly(value)) {
                // 深层可变模式下，比较前先剥掉代理，避免代理壳影响“值是否变化”的判断。
                oldValue = toRaw(oldValue)
                value = toRaw(value)
            }
            if (!isArrayWithIntegerKey && isRef(oldValue) && !isRef(value)) {
                if (isOldValueReadonly) {
                    // 旧 ref 是只读时，赋值视为无效但保持表面成功，和只读语义一致。
                    return true
                } else {
                    // 旧值是 ref、新值不是 ref 时，直接改旧 ref 的 `.value`。
                    oldValue.value = value
                    return true
                }
            }
        } else {
            // 浅模式下对象按原样写入，不再递归转成响应式或原始值。
        }

        const hadKey = isArrayWithIntegerKey
            ? Number(key) < target.length
            : hasOwn(target, key)
        // 真正执行底层写入。
        const result = Reflect.set(
            target,
            key,
            value,
            isRef(target) ? target : receiver,
        )
        // 只有真正写到了当前原始对象上才触发依赖；
        // 如果命中的是原型链上的 setter，不应该在这里重复触发。
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                trigger(target, TriggerOpTypes.ADD, key, value)
            } else if (hasChanged(value, oldValue)) {
                trigger(target, TriggerOpTypes.SET, key, value, oldValue)
            }
        }
        return result
    }

    deleteProperty(
        target: Record<string | symbol, unknown>,
        key: string | symbol,
    ): boolean {
        // 删除前先记住旧值，供触发 DELETE 时传给订阅者。
        const hadKey = hasOwn(target, key)
        const oldValue = target[key]
        const result = Reflect.deleteProperty(target, key)
        if (result && hadKey) {
            trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
        }
        return result
    }

    has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
        const result = Reflect.has(target, key)
        if (!isSymbol(key) || !builtInSymbols.has(key)) {
            // `key in obj` 这类存在性判断也应该能参与依赖追踪。
            track(target, TrackOpTypes.HAS, key)
        }
        return result
    }

    ownKeys(target: Record<string | symbol, unknown>): (string | symbol)[] {
        // `for...in`、`Object.keys`、数组长度相关逻辑都会走这里，
        // 因此需要建立“遍历依赖”。
        track(
            target,
            TrackOpTypes.ITERATE,
            isArray(target) ? 'length' : ITERATE_KEY,
        )
        return Reflect.ownKeys(target)
    }
}

// 只读处理器：读取逻辑沿用基类，写入和删除都被拦截成无效果操作。
class ReadonlyReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow = false) {
        super(true, isShallow)
    }

    set(target: object, key: string | symbol) {
        // 只读代理上写入直接吞掉，开发环境告警逻辑通常在更上层处理。
        return true
    }

    deleteProperty(target: object, key: string | symbol) {
        // 删除同理，保持操作不生效但不抛异常。
        return true
    }
}


export const mutableHandlers: ProxyHandler<object> =
    /*@__PURE__*/ new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
    /*@__PURE__*/ new ReadonlyReactiveHandler()

export const shallowReactiveHandlers: MutableReactiveHandler =
    /*@__PURE__*/ new MutableReactiveHandler(true)

// props 的处理器比较特殊：它不应该解包顶层 ref
// （这样才能显式把 ref 往下传递），但又需要保留
// 普通只读对象应有的响应式能力。
export const shallowReadonlyHandlers: ReadonlyReactiveHandler =
    /*@__PURE__*/ new ReadonlyReactiveHandler(true)
