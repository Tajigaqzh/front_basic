import {ReactiveFlags} from "./constants";
import {RawSymbol, Ref, UnwrapRefSimple} from "./ref";
import {def, hasOwn, isObject, toRawType} from "@vue-source/shared";
import {mutableHandlers, readonlyHandlers, shallowReactiveHandlers, shallowReadonlyHandlers} from "./baseHandlers";
import {
    mutableCollectionHandlers,
    readonlyCollectionHandlers, shallowCollectionHandlers,
    shallowReadonlyCollectionHandlers
} from "./collectionHandlers";

// 可以被响应式系统处理的目标对象结构。
// 这些字段都是 Vue 在对象上挂载的内部标记，用来描述当前对象的响应式状态。
export interface Target {
    // 标记该对象应跳过响应式代理。
    [ReactiveFlags.SKIP]?: boolean
    // 标记该对象是否已经是响应式对象。
    [ReactiveFlags.IS_REACTIVE]?: boolean
    // 标记该对象是否为只读对象。
    [ReactiveFlags.IS_READONLY]?: boolean
    // 标记该对象是否为浅响应式/浅只读对象。
    [ReactiveFlags.IS_SHALLOW]?: boolean
    // 指向对应的原始对象。
    [ReactiveFlags.RAW]?: any
}

// 缓存“原始对象 -> 深响应式代理对象”的映射，避免重复创建代理。
// 使用 WeakMap 是为了在原始对象不再被引用时，允许垃圾回收自动清理缓存。
export const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>();
// 缓存“原始对象 -> 浅响应式代理对象”的映射。
export const shallowReactiveMap: WeakMap<Target, any> = new WeakMap<
    Target,
    any
>()
// 缓存“原始对象 -> 深只读代理对象”的映射。
export const readonlyMap: WeakMap<Target, any> = new WeakMap<Target, any>();
// 缓存“原始对象 -> 浅只读代理对象”的映射。
export const shallowReadonlyMap: WeakMap<Target, any> = new WeakMap<
    Target,
    any
>();


// 标记目标对象属于哪一类，后续会据此选择不同的代理处理逻辑。
enum TargetType {
    INVALID = 0,
    COMMON = 1,
    COLLECTION = 2,
}

/**
 * 根据对象的原始类型字符串，判断它能否被响应式系统代理，以及应该按哪一类处理。
 *
 * `Object`、`Array` 归为普通对象；
 * `Map`、`Set`、`WeakMap`、`WeakSet` 归为集合类型；
 * 其他类型则视为不可代理。
 */
function targetTypeMap(rawType: string) {
    switch (rawType) {
        // 普通对象和数组共用一套 baseHandlers。
        case 'Object':
        case 'Array':
            return TargetType.COMMON
        // 各类集合对象需要使用 collectionHandlers，
        // 因为它们的读取/写入入口不是普通属性访问，而是 `get/set/add/delete` 等方法。
        case 'Map':
        case 'Set':
        case 'WeakMap':
        case 'WeakSet':
            return TargetType.COLLECTION
        default:
            return TargetType.INVALID
    }
}

// 只解包嵌套在对象内部的 ref。
// 如果 `T` 自己本身就是一个 `Ref`，则保持原样不动；
// 否则就对 `T` 的内部结构做递归解包，把里面嵌套的 `Ref` 展开。
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

// 用于给响应式数组类型打一个仅存在于类型系统中的私有标记。
// 这个 symbol 不会参与运行时逻辑，只是为了帮助 TypeScript 区分某些特殊类型场景。
declare const ReactiveMarkerSymbol: unique symbol

// 响应式类型标记接口。
// 当前主要用于数组类型：当 `T` 是数组时，会额外与这个标记类型做交叉，
// 让 `Reactive<T>` 在类型系统里和普通解包后的数组保持可区分。
export interface ReactiveMarker {
    [ReactiveMarkerSymbol]?: void
}

// `Reactive<T>` 表示“调用 `reactive()` 之后得到的类型”。
// 它会先对 `T` 做嵌套 ref 解包；
// 如果 `T` 是只读数组，再额外挂上一个响应式标记类型。
export type Reactive<T> = UnwrapNestedRefs<T> &
    (T extends readonly any[] ? ReactiveMarker : {})


/**
 * 创建一个对象的深响应式代理。
 *
 * 如果传入的已经是只读代理对象，则直接返回它本身；
 * 否则交给 `createReactiveObject` 创建或复用对应的响应式代理。
 */
export function reactive<T extends object>(target: T): Reactive<T>
/*@__NO_SIDE_EFFECTS__*/
export function reactive(target: object) {
    // 如果传入的是只读代理对象，直接返回，不再重复包装。
    if (isReadonly(target)) {
        return target
    }
    // 统一交给底层工厂创建代理。
    // 这里传入“可变 + 深层”的 handler 与缓存表。
    return createReactiveObject(
        target,
        false,
        mutableHandlers,
        mutableCollectionHandlers,
        reactiveMap,
    )
}

export type ShallowReactiveBrand = ShallowReactiveBrandClass

export type ShallowReactive<T> = T & ShallowReactiveBrand
/**
 * {@link reactive} 的浅层版本。
 *
 * 和 {@link reactive} 不同，它不会做深层转换：
 * 只有根级属性会变成响应式。属性值会按原样存储和暴露，
 * 这也意味着值为 ref 的属性不会被自动解包。
 *
 * @example
 * ```js
 * const state = shallowReactive({
 *   foo: 1,
 *   nested: {
 *     bar: 2
 *   }
 * })
 *
 * // 修改 state 自身的属性会触发响应式
 * state.foo++
 *
 * // ……但不会递归转换嵌套对象
 * isReactive(state.nested) // false
 *
 * // 不会触发响应式
 * state.nested.bar++
 * ```
 *
 * @param target - 源对象。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#shallowreactive}
 */
export function shallowReactive<T extends object>(
    target: T,
): ShallowReactive<T> {
/*@__NO_SIDE_EFFECTS__*/
    // 和 `reactive()` 的流程相同，只是换成“浅层”的 handler 与缓存表。
    return createReactiveObject(
        target,
        false,
        shallowReactiveHandlers,
        shallowCollectionHandlers,
        shallowReactiveMap,
    )
}

// JavaScript 中的原始类型联合。
type Primitive = string | number | boolean | bigint | symbol | undefined | null

// Vue 在解包和响应式判断中视为“内置类型”的集合。
// 这些类型通常不会再被当作普通对象那样继续深度展开。
export type Builtin = Primitive | Function | Date | Error | RegExp



export type DeepReadonly<T> = T extends Builtin
    ? T
    : T extends Map<infer K, infer V>
        ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
        : T extends ReadonlyMap<infer K, infer V>
            ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
            : T extends WeakMap<infer K, infer V>
                ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
                : T extends Set<infer U>
                    ? ReadonlySet<DeepReadonly<U>>
                    : T extends ReadonlySet<infer U>
                        ? ReadonlySet<DeepReadonly<U>>
                        : T extends WeakSet<infer U>
                            ? WeakSet<DeepReadonly<U>>
                            : T extends Promise<infer U>
                                ? Promise<DeepReadonly<U>>
                                : T extends Ref<infer U, unknown>
                                    ? Readonly<Ref<DeepReadonly<U>>>
                                    : T extends {}
                                        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
                                        : Readonly<T>


// 使用私有类标记来代替标记属性，这样浅层响应式类型在 `UnwrapRef`
// 中仍然可以被区分出来，同时不会把这个标记泄漏到
// `keyof`/索引访问类型中，也不需要在普通赋值时显式提供这个属性。
declare class ShallowReactiveBrandClass {
    private __shallowReactiveBrand?: never
}



/**
 * 接收一个对象（响应式对象或普通对象）或一个 ref，并返回该原始值的只读代理。
 *
 * 只读代理是深层的：访问到的任何嵌套属性也都会是只读的。
 * 它还具有和 {@link reactive} 相同的 ref 解包行为，
 * 区别在于解包后的值也会被转换为只读。
 *
 * @example
 * ```js
 * const original = reactive({ count: 0 })
 *
 * const copy = readonly(original)
 *
 * watchEffect(() => {
 *   // 可以正常进行响应式依赖追踪
 *   console.log(copy.count)
 * })
 *
 * // 修改 original 会触发依赖 copy 的侦听器
 * original.count++
 *
 * // 修改 copy 会失败，并产生警告
 * copy.count++ // warning!
 * ```
 *
 * @param target - 源对象。
 * @see {@link https://vuejs.org/api/reactivity-core.html#readonly}
 */
export function readonly<T extends object>(
    target: T,
): DeepReadonly<UnwrapNestedRefs<T>> {
/*@__NO_SIDE_EFFECTS__*/
    // 和 `reactive()` 共用同一个代理创建入口，
    // 区别只是这里走“只读”分支。
    return createReactiveObject(
        target,
        true,
        readonlyHandlers,
        readonlyCollectionHandlers,
        readonlyMap,
    )
}


export type Raw<T> = T & { [RawSymbol]?: true }
/**
 * 把一个对象标记为“永远不要被转换成代理”，并返回对象本身。
 *
 * @example
 * ```js
 * const foo = markRaw({})
 * console.log(isReactive(reactive(foo))) // false
 *
 * // 嵌套进其他响应式对象里也同样生效
 * const bar = reactive({ foo })
 * console.log(isReactive(bar.foo)) // false
 * ```
 *
 * **警告：** `markRaw()` 配合 {@link shallowReactive} 这类浅层 API 使用时，
 * 可以让你有选择地跳过默认的深层 reactive/readonly 转换，
 * 从而把原始的、未代理的对象嵌入到状态图中。
 *
 * @param value - 要被标记为“原始对象”的目标对象。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#markraw}
 */
export function markRaw<T extends object>(value: T): Raw<T> {
    // 只有对象本身还没被标记，且仍可扩展时，才挂上跳过标记。
    if (!hasOwn(value, ReactiveFlags.SKIP) && Object.isExtensible(value)) {
        def(value, ReactiveFlags.SKIP, true)
    }
    // 返回原对象本身，方便链式使用或内联传参。
    return value
}

/**
 * {@link readonly} 的浅层版本。
 *
 * 和 {@link readonly} 不同，它不会做深层转换：
 * 只有根级属性会变成只读。属性值会按原样存储和暴露，
 * 这也意味着值为 ref 的属性不会被自动解包。
 *
 * @example
 * ```js
 * const state = shallowReadonly({
 *   foo: 1,
 *   nested: {
 *     bar: 2
 *   }
 * })
 *
 * // 修改 state 自身的属性会失败
 * state.foo++
 *
 * // ……但嵌套对象仍然可以修改
 * isReadonly(state.nested) // false
 *
 * // 可以正常修改
 * state.nested.bar++
 * ```
 *
 * @param target - 源对象。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#shallowreadonly}
 */
/*@__NO_SIDE_EFFECTS__*/
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
    // 与 `readonly()` 相同，但这里只把根层属性做成只读。
    return createReactiveObject(
        target,
        true,
        shallowReadonlyHandlers,
        shallowReadonlyCollectionHandlers,
        shallowReadonlyMap,
    )
}

/**
 * 检查传入的值是否为只读对象。只读对象的属性值本身可能会发生变化，
 * 但不能通过当前传入的这个对象直接对属性重新赋值。
 *
 * 由 {@link readonly} 和 {@link shallowReadonly} 创建出来的代理对象，
 * 都会被视为只读对象；没有 `set` 函数的计算属性 ref 也同样如此。
 *
 * @param value - 要检查的值。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isreadonly}
 */
/*@__NO_SIDE_EFFECTS__*/
export function isReadonly(value: unknown): boolean {
    // 只要对象上带有只读标记，就视为只读代理或只读 ref。
    return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}



/**
 * 检查一个对象是否是由 {@link reactive} 或 {@link shallowReactive}
 * 创建出的代理对象（某些情况下也可能来自 {@link ref}）。
 *
 * @example
 * ```js
 * isReactive(reactive({}))            // => true
 * isReactive(readonly(reactive({})))  // => true
 * isReactive(ref({}).value)           // => true
 * isReactive(readonly(ref({})).value) // => true
 * isReactive(ref(true))               // => false
 * isReactive(shallowRef({}).value)    // => false
 * isReactive(shallowReactive({}))     // => true
 * ```
 *
 * @param value - 要检查的值。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isreactive}
 */
/*@__NO_SIDE_EFFECTS__*/
export function isReactive(value: unknown): boolean {
    if (isReadonly(value)) {
        // 只读代理如果包裹的是 reactive，
        // 需要继续透过 RAW 递归判断其底层是否响应式。
        return isReactive((value as Target)[ReactiveFlags.RAW])
    }
    return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}



/*@__NO_SIDE_EFFECTS__*/
/**
 * 检查一个值是否是“浅层代理”。
 *
 * 浅层代理只处理根层属性，不会递归把嵌套对象转换成代理。
 */
export function isShallow(value: unknown): boolean {
    return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW])
}


/**
 * 检查一个对象是否是由 {@link reactive}、{@link readonly}、
 * {@link shallowReactive} 或 {@link shallowReadonly} 创建出来的代理对象。
 *
 * @param value - 要检查的值。
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isproxy}
 */
/*@__NO_SIDE_EFFECTS__*/
export function isProxy(value: any): boolean {
    return value ? !!value[ReactiveFlags.RAW] : false
}

/**
 * 创建响应式 / 只读代理对象的底层统一入口。
 *
 * 它负责：
 * 1. 判断目标值是否允许被代理
 * 2. 复用已存在的代理缓存
 * 3. 根据目标类型选择普通对象 handler 或集合 handler
 */
function createReactiveObject(
    target: Target,
    isReadonly: boolean,
    baseHandlers: ProxyHandler<any>,
    collectionHandlers: ProxyHandler<any>,
    proxyMap: WeakMap<Target, any>,
) {
    // 只有对象才能被 Proxy 代理；原始值直接原样返回。
    if (!isObject(target)) {
        return target
    }
    // 目标本身已经是代理对象时，直接返回。
    // 例外是：允许对一个 reactive 对象再包一层 readonly。
    if (
        target[ReactiveFlags.RAW] &&
        !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
    ) {
        return target
    }
    // 只有特定类型的值才允许被代理。
    if (target[ReactiveFlags.SKIP] || !Object.isExtensible(target)) {
        return target
    }
    // 如果当前模式下已经缓存过代理，直接复用。
    const existingProxy = proxyMap.get(target)
    if (existingProxy) {
        return existingProxy
    }
    const targetType = targetTypeMap(toRawType(target))
    if (targetType === TargetType.INVALID) {
        // 例如某些内建对象或被显式跳过的对象，不参与代理。
        return target
    }
    // 普通对象与集合对象使用不同的 handler，
    // 因为集合的行为需要围绕方法调用做额外处理。
    const proxy = new Proxy(
        target,
        targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers,
    )
    // 缓存起来，确保同一个原对象永远对应同一个代理实例。
    proxyMap.set(target, proxy)
    return proxy
}


/**
 * 返回 Vue 创建的代理对象背后的原始对象。
 *
 * `toRaw()` 可以从 {@link reactive}、{@link readonly}、
 * {@link shallowReactive} 或 {@link shallowReadonly} 创建的代理中取回原始对象。
 *
 * 这是一个“逃生口” API：你可以临时绕过代理层读取或写入，
 * 避免代理访问 / 依赖追踪的开销。但**不建议**长期持有原始对象引用，
 * 使用时需要格外谨慎。
 *
 * @example
 * ```js
 * const foo = {}
 * const reactiveFoo = reactive(foo)
 *
 * console.log(toRaw(reactiveFoo) === foo) // true
 * ```
 *
 * @param observed - 要获取其原始值的对象。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#toraw}
 */
/*@__NO_SIDE_EFFECTS__*/
export function toRaw<T>(observed: T): T {
    const raw = observed && (observed as Target)[ReactiveFlags.RAW]
    // 代理可能被多层包裹（例如 reactive 外再包 readonly），
    // 所以这里递归一直剥到最底层原始对象。
    return raw ? toRaw(raw) : observed
}



/**
 * 如果可能的话，返回给定值对应的响应式代理。
 *
 * 如果给定值不是对象，就直接返回原值。
 *
 * @param value - 要创建响应式代理的值。
 */
export const toReactive = <T extends unknown>(value: T): T =>
    // 对象转 reactive，非对象原样返回。
    isObject(value) ? reactive(value) : value


/**
 * 如果可能的话，返回给定值对应的只读代理。
 *
 * 如果给定值不是对象，就直接返回原值。
 *
 * @param value - 要创建只读代理的值。
 */
export const toReadonly = <T extends unknown>(value: T): DeepReadonly<T> =>
    // 对象转 readonly，非对象原样返回。
    isObject(value) ? readonly(value) : (value as DeepReadonly<T>)
