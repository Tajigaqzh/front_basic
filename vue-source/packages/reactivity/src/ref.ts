import {
    type IfAny,
    hasChanged,
    isArray,
    isFunction,
    isIntegerKey,
    isObject,
    isSymbol,
} from "@vue-source/shared"
import { Dep, getDepFromReactive } from './dep'
import {
    type Builtin,
    type ShallowReactiveBrand,
    type Target,
    isProxy,
    isReactive,
    isReadonly,
    isShallow,
    toRaw,
    toReactive,
} from './reactive'
import type { ComputedRef, WritableComputedRef } from './computed'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'

declare const RefSymbol: unique symbol
export declare const RawSymbol: unique symbol

export interface Ref<T = any, S = T> {
    get value(): T
    set value(_: S)
    /**
     * 仅用于类型区分。
     * 我们需要它出现在公开的 d.ts 中，但又不希望它出现在 IDE 自动补全里，
     * 所以这里使用一个私有 Symbol。
     */
    [RefSymbol]: true
}

/**
 * 检查一个值是否为 ref 对象。
 *
 * @param r - 要检查的值。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isref}
 */
export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
/*@__NO_SIDE_EFFECTS__*/
export function isRef(r: any): r is Ref {
    return r ? r[ReactiveFlags.IS_REF] === true : false
}

/**
 * 接收一个内部值，并返回一个响应式且可变的 ref 对象。
 * 这个对象只有一个 `.value` 属性，用来指向内部值。
 *
 * @param value - 要包装成 ref 的对象。
 * @see {@link https://vuejs.org/api/reactivity-core.html#ref}
 */
export function ref<T>(
    value: T,
): [T] extends [Ref] ? IfAny<T, Ref<T>, T> : Ref<UnwrapRef<T>, UnwrapRef<T> | T>
export function ref<T = any>(): Ref<T | undefined>
/*@__NO_SIDE_EFFECTS__*/
export function ref(value?: unknown) {
    return createRef(value, false)
}

declare const ShallowRefMarker: unique symbol

export type ShallowRef<T = any, S = T> = Ref<T, S> & {
    [ShallowRefMarker]?: true
}

/**
 * {@link ref} 的浅层版本。
 *
 * @example
 * ```js
 * const state = shallowRef({ count: 1 })
 *
 * // 不会触发变更
 * state.value.count = 2
 *
 * // 会触发变更
 * state.value = { count: 2 }
 * ```
 *
 * @param value - shallow ref 的内部值。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#shallowref}
 */
export function shallowRef<T>(
    value: T,
): Ref extends T
    ? T extends Ref
        ? IfAny<T, ShallowRef<T>, T>
        : ShallowRef<T>
    : ShallowRef<T>
export function shallowRef<T = any>(): ShallowRef<T | undefined>
/*@__NO_SIDE_EFFECTS__*/
export function shallowRef(value?: unknown) {
    return createRef(value, true)
}

/**
 * 创建 ref 的底层工厂函数。
 *
 * `shallow = false` 时创建深层 ref；
 * `shallow = true` 时创建浅层 ref。
 */
function createRef(rawValue: unknown, shallow: boolean) {
    if (isRef(rawValue)) {
        // 已经是 ref 时直接复用，避免出现 ref(ref(x)) 这种多层包裹。
        return rawValue
    }
    return new RefImpl(rawValue, shallow)
}

/**
 * `shallowRef` / `ref` 的底层实现类。
 * @internal
 */
class RefImpl<T = any> {
    _value: T
    private _rawValue: T

    dep: Dep = new Dep();

    public readonly [ReactiveFlags.IS_REF] = true
    public readonly [ReactiveFlags.IS_SHALLOW]: boolean = false

    constructor(value: T, isShallow: boolean) {
        // `_rawValue` 用于“是否变化”的比较；
        // `_value` 是对外暴露的值，深 ref 下这里会转成 reactive。
        this._rawValue = isShallow ? value : toRaw(value)
        this._value = isShallow ? value : toReactive(value)
        this[ReactiveFlags.IS_SHALLOW] = isShallow
    }

    /**
     当使用 get 关键字时，它和Object.defineProperty() 有类似的效果，在Classes中使用时，二者有细微的差别。
     当使用 get 关键字时，属性将被定义在实例的原型上，当使用Object.defineProperty()时，属性将被定义在实例自身上。
     */

    // getter方法，访问器属性，类似于Object.defineProperty `.value` 不是普通属性，而是访问器属性。
    get value() {
        // 读取 `.value` 时，把当前活跃副作用记录到本 ref 的 dep 上。
        this.dep.track()
        // 返回缓存值；ref 不需要像 computed 那样重新求值。
        return this._value
    }

    // setter方法
    set value(newValue) {
        const oldValue = this._rawValue
        const useDirectValue =
            this[ReactiveFlags.IS_SHALLOW] ||
            isShallow(newValue) ||
            isReadonly(newValue)
        // 深 ref 会先把代理剥掉后再比较/保存，保持原始值语义一致。
        newValue = useDirectValue ? newValue : toRaw(newValue)
        if (hasChanged(newValue, oldValue)) {
            this._rawValue = newValue
            this._value = useDirectValue ? newValue : toReactive(newValue)
            // 只有值真的变化后，才通知所有依赖当前 ref 的副作用重新运行。
            this.dep.trigger()
        }
    }
}

/**
 * 强制触发依赖某个 shallow ref 的副作用。
 * 它通常用于在直接深改 shallow ref 内部值之后，手动通知依赖更新。
 *
 * @example
 * ```js
 * const shallow = shallowRef({
 *   greet: '你好，世界'
 * })
 *
 * // 首次运行时会输出一次“你好，世界”
 * watchEffect(() => {
 *   console.log(shallow.value.greet)
 * })
 *
 * // 因为这是 shallow ref，这里不会触发副作用
 * shallow.value.greet = '你好，宇宙'
 *
 * // 会输出“你好，宇宙”
 * triggerRef(shallow)
 * ```
 *
 * @param ref - 需要触发其关联副作用的 ref。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#triggerref}
 */
export function triggerRef(ref: Ref): void {
    // `ref` 也可能是 `ObjectRefImpl` 的实例。
    if ((ref as unknown as RefImpl).dep) {
        (ref as unknown as RefImpl).dep.trigger()
    }
}

export type MaybeRef<T = any> =
    | T
    | Ref<T>
    | ShallowRef<T>
    | WritableComputedRef<T>

export type MaybeRefOrGetter<T = any> = MaybeRef<T> | ComputedRef<T> | (() => T)

/**
 * 如果参数是 ref，就返回它的内部值；否则直接返回参数本身。
 * 它是 `val = isRef(val) ? val.value : val` 的语法糖。
 *
 * @example
 * ```js
 * function useFoo(x: number | Ref<number>) {
 *   const unwrapped = unref(x)
 *   // 此时可以保证 unwrapped 已经是数字
 * }
 * ```
 *
 * @param ref - 要转换成普通值的 ref 或普通值。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#unref}
 */
export function unref<T>(ref: MaybeRef<T> | ComputedRef<T>): T {
    // 这是最常用的“拆 ref”辅助：是 ref 就取 `.value`，否则直接返回。
    return isRef(ref) ? ref.value : ref
}

/**
 * 把普通值 / ref / getter 统一规范成普通值。
 * 它和 {@link unref} 类似，但额外支持 getter：
 * 如果参数是 getter，会先调用 getter 再返回结果。
 *
 * @example
 * ```js
 * toValue(1) // 1
 * toValue(ref(1)) // 1
 * toValue(() => 1) // 1
 * ```
 *
 * @param source - getter、已有的 ref，或一个非函数值。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#tovalue}
 */
export function toValue<T>(source: MaybeRefOrGetter<T>): T {
    // 相比 `unref`，这里多支持一个 getter 形态。
    return isFunction(source) ? source() : unref(source)
}

// 用于构造“浅层解包 ref 属性”的代理处理器。
const shallowUnwrapHandlers: ProxyHandler<any> = {
    get: (target, key, receiver) =>
        key === ReactiveFlags.RAW
            ? target
            : unref(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
        const oldValue = target[key]
        if (isRef(oldValue) && !isRef(value)) {
            // 旧值是 ref、新值不是 ref 时，不替换 ref 外壳，而是改它内部的 `.value`。
            oldValue.value = value
            return true
        } else {
            return Reflect.set(target, key, value, receiver)
        }
    },
}

/**
 * 为给定对象返回一个代理，这个代理会浅层解包其中值为 ref 的属性。
 * 如果对象本身已经是响应式对象，则直接原样返回；
 * 否则会创建一个新的代理对象。
 *
 * @param objectWithRefs - 一个已经是响应式的对象，或者一个包含 ref 的普通对象。
 */
/**
 * 为一个对象创建“浅拆 ref”代理。
 *
 * 读取属性时会自动把顶层 ref 解包；
 * 写入时如果旧值是 ref、新值不是 ref，则会回写到旧 ref 的 `.value`。
 */
export function proxyRefs<T extends object>(
    objectWithRefs: T,
): ShallowUnwrapRef<T> {
    return isReactive(objectWithRefs)
        ? (objectWithRefs as ShallowUnwrapRef<T>)
        : new Proxy(objectWithRefs, shallowUnwrapHandlers)
}

export type CustomRefFactory<T, S = T> = (
    track: () => void,
    trigger: () => void,
) => {
    get: () => T
    set: (value: S) => void
}

// 自定义 ref 的内部实现类。
class CustomRefImpl<T, S = T> {
    public dep: Dep

    private readonly _get: ReturnType<CustomRefFactory<T, S>>['get']
    private readonly _set: ReturnType<CustomRefFactory<T, S>>['set']

    public readonly [ReactiveFlags.IS_REF] = true

    public _value: T = undefined!

    constructor(factory: CustomRefFactory<T, S>) {
        const dep = (this.dep = new Dep())
        // 把当前 ref 自己的 track/trigger 能力交给用户工厂函数，
        // 让用户精确决定何时收集依赖、何时触发更新。
        const { get, set } = factory(dep.track.bind(dep), dep.trigger.bind(dep))
        this._get = get
        this._set = set
    }

    get value(): T {
        // 真正的收集逻辑由用户在 `factory` 返回的 `get` 里决定。
        return (this._value = this._get())
    }

    set value(newVal: S) {
        this._set(newVal)
    }
}

/**
 * 创建一个自定义 ref，显式控制它的依赖收集和更新触发时机。
 *
 * @param factory - 接收 `track` 和 `trigger` 回调的工厂函数。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#customref}
 */
/**
 * 创建一个自定义 ref。
 *
 * 用户可以完全接管 `.value` 读取时的依赖收集时机，
 * 以及写入后的触发时机。
 */
export function customRef<T, S = T>(
    factory: CustomRefFactory<T, S>,
): Ref<T, S> {
    return new CustomRefImpl(factory) as any
}

export type ToRefs<T = any> = {
    [K in keyof T]: ToRef<T[K]>
}

type ArrayStringKey<T> = T extends readonly any[]
    ? number extends T['length']
        ? `${number}`
        : never
    : never

type ToRefKey<T> = keyof T | ArrayStringKey<T>

type ToRefValue<T extends object, K extends ToRefKey<T>> = K extends keyof T
    ? T[K]
    : T extends readonly (infer V)[]
        ? K extends ArrayStringKey<T>
            ? V
            : never
        : never

/**
 * 把一个响应式对象转换成普通对象，
 * 转换后对象的每个属性都是一个指向原始对象对应属性的 ref。
 * 每个单独的 ref 都是通过 {@link toRef} 创建的。
 *
 * @param object - 要转换成“属性 ref 对象”的响应式对象。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#torefs}
 */
/*@__NO_SIDE_EFFECTS__*/
export function toRefs<T extends object>(object: T): ToRefs<T> {
    // 数组返回等长数组，对象返回普通对象，逐个属性转成 toRef。
    const ret: any = isArray(object) ? new Array(object.length) : {}
    for (const key in object) {
        ret[key] = propertyToRef(object, key)
    }
    return ret
}

class ObjectRefImpl<T extends object, K extends keyof T> {
    public readonly [ReactiveFlags.IS_REF] = true
    public _value: T[K] = undefined!

    private readonly _raw: T
    private readonly _key: K
    private readonly _shallow: boolean

    constructor(
        private readonly _object: T,
        key: K,
        private readonly _defaultValue?: T[K],
    ) {
        this._key = (isSymbol(key) ? key : String(key)) as K
        this._raw = toRaw(_object)

        let shallow = true
        let obj = _object

        // 对数组的整数索引位置，不做 ref 解包。
        if (!isArray(_object) || isSymbol(this._key) || !isIntegerKey(this._key)) {
            // 否则沿着每一层代理向上检查，判断这里是否应该解包。
            do {
                shallow = !isProxy(obj) || isShallow(obj)
            } while (shallow && (obj = (obj as Target)[ReactiveFlags.RAW]))
        }

        this._shallow = shallow
    }

    get value() {
        let val = this._object[this._key]
        if (this._shallow) {
            // 浅模式下，属性本身如果是 ref，则这里顺手拆一层。
            val = unref(val)
        }
        // 如果源属性当前是 `undefined`，则退回到默认值。
        return (this._value = val === undefined ? this._defaultValue! : val)
    }

    set value(newVal) {
        if (this._shallow && isRef(this._raw[this._key])) {
            const nestedRef = this._object[this._key]
            if (isRef(nestedRef)) {
                // 如果目标属性本来就是 ref，则优先回写其 `.value`，
                // 保持与原属性的响应式连接不断开。
                nestedRef.value = newVal
                return
            }
        }

        // 否则直接覆写原对象属性。
        this._object[this._key] = newVal
    }

    get dep(): Dep | undefined {
        // 属性 ref 的依赖实际上仍然挂在原响应式对象对应的 key 上。
        return getDepFromReactive(this._raw, this._key)
    }
}

class GetterRefImpl<T> {
    public readonly [ReactiveFlags.IS_REF] = true
    public readonly [ReactiveFlags.IS_READONLY] = true
    public _value: T = undefined!

    constructor(private readonly _getter: () => T) {}
    get value() {
        // 每次读取时重新执行 getter，因此它天然是只读且无独立缓存。
        return (this._value = this._getter())
    }
}

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>

/**
 * 用于把普通值 / ref / getter 统一规范成 ref。
 *
 * @example
 * ```js
 * // 已有 ref 直接原样返回
 * toRef(existingRef)
 *
 * // 创建一个在访问 .value 时调用 getter 的 ref
 * toRef(() => props.foo)
 *
 * // 从非函数值创建普通 ref
 * // 等价于 ref(1)
 * toRef(1)
 * ```
 *
 * 它也可以用来为响应式对象上的某个属性创建 ref。
 * 创建出的 ref 会和源属性保持同步：修改源属性会更新 ref，反之亦然。
 *
 * @example
 * ```js
 * const state = reactive({
 *   foo: 1,
 *   bar: 2
 * })
 *
 * const fooRef = toRef(state, 'foo')
 *
 * // 修改 ref 会更新原对象
 * fooRef.value++
 * console.log(state.foo) // 2
 *
 * // 修改原对象也会更新 ref
 * state.foo++
 * console.log(fooRef.value) // 3
 * ```
 *
 * @param source - getter、已有的 ref、非函数值，或一个要从中创建属性 ref 的响应式对象。
 * @param [key] - 可选，响应式对象中的属性名。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#toref}
 */
/**
 * 把普通值、getter、已有 ref，或对象上的某个属性统一转换成 ref。
 *
 * 这是 Vue 中“把各种来源的值标准化成 ref 形态”的核心工具函数。
 */
export function toRef<T>(
    value: T,
): T extends () => infer R
    ? Readonly<Ref<R>>
    : T extends Ref
        ? T
        : Ref<UnwrapRef<T>>
export function toRef<T extends object, K extends ToRefKey<T>>(
    object: T,
    key: K,
): ToRef<ToRefValue<T, K>>
export function toRef<T extends object, K extends ToRefKey<T>>(
    object: T,
    key: K,
    defaultValue: ToRefValue<T, K>,
): ToRef<Exclude<ToRefValue<T, K>, undefined>>
/*@__NO_SIDE_EFFECTS__*/
export function toRef(
    source: Record<PropertyKey, any> | MaybeRef,
    key?: string | number | symbol,
    defaultValue?: unknown,
): Ref {
    if (isRef(source)) {
        // 已经是 ref，直接返回。
        return source
    } else if (isFunction(source)) {
        // getter 变成只读 ref。
        return new GetterRefImpl(source) as any
    } else if (isObject(source) && arguments.length > 1) {
        // 从对象的某个属性创建属性 ref。
        return propertyToRef(source, key!, defaultValue)
    } else {
        // 其他普通值走标准 ref 包装。
        return ref(source)
    }
}

/**
 * 基于对象的某个属性，创建一个与该属性双向同步的属性 ref。
 */
function propertyToRef(
    source: Record<PropertyKey, any>,
    key: string | number | symbol,
    defaultValue?: unknown,
) {
    // 属性 ref 本质上只是一个“转发器”，读写都映射回原对象属性。
    return new ObjectRefImpl(source, key, defaultValue) as any
}

/**
 * 这是一个特殊导出的接口，供其他包声明在 ref 解包时
 * 应该跳过处理的额外类型。例如，`@vue/runtime-dom`
 * 可以在它的 `d.ts` 中像下面这样声明：
 *
 * ``` ts
 * declare module '@vue/reactivity' {
 *   export interface RefUnwrapBailTypes {
 *     runtimeDOMBailTypes: Node | Window
 *   }
 * }
 * ```
 */
export interface RefUnwrapBailTypes {}

// 对象层面的“浅拆 ref”类型：
// 只把第一层属性上的 `Ref<X>` 变成 `X`，不会继续深挖更里面的结构。
export type ShallowUnwrapRef<T> = T extends ShallowReactiveBrand
    ? T
    : {
        [K in keyof T]: DistributeRef<T[K]>
    }

type DistributeRef<T> = T extends Ref<infer V, unknown> ? V : T

export type UnwrapRef<T> =
    T extends ShallowRef<infer V, unknown>
        ? V
        : T extends Ref<infer V, unknown>
            ? UnwrapRefSimple<V>
            : UnwrapRefSimple<T>

// `UnwrapRefSimple<T>` 是 Vue ref 类型解包的核心规则。
// 可以把它理解成：“如果一个类型里嵌套了 ref，那么推导出访问时真正看到的值类型”。
// 主要规则如下：
// 1. 基础类型、函数、日期、Error、RegExp 等内建类型不再继续展开。
// 2. `Ref` 本身、显式声明为跳过解包的类型、以及被 `markRaw` 标记的类型保持原样。
// 3. `Map/Set/WeakMap/WeakSet/数组` 会继续递归解包它们内部元素。
// 4. 普通对象会递归遍历每个属性，把属性上的 ref 展开成其内部值类型。
// 5. symbol 键保持原样，避免破坏一些内部标记字段的类型语义。
export type UnwrapRefSimple<T> = T extends
    | Builtin
    | Ref
    | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
    | { [RawSymbol]?: true }
    ? T
    : T extends ShallowReactiveBrand
        ? T
        : T extends Map<infer K, infer V>
            ? Map<K, UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Map<any, any>>>
            : T extends WeakMap<infer K, infer V>
                ? WeakMap<K, UnwrapRefSimple<V>> &
                UnwrapRef<Omit<T, keyof WeakMap<any, any>>>
                : T extends Set<infer V>
                    ? Set<UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Set<any>>>
                    : T extends WeakSet<infer V>
                        ? WeakSet<UnwrapRefSimple<V>> &
                        UnwrapRef<Omit<T, keyof WeakSet<any>>>
                        : T extends ReadonlyArray<any>
                            ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
                            : T extends object
                                ? {
                                    [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
                                }
                                : T
