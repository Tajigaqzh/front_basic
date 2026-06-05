// `ref` 相关 API：负责单值响应式、属性 ref 化以及值规范化。
export {
    ref,
    shallowRef,
    isRef,
    toRef,
    toValue,
    toRefs,
    unref,
    proxyRefs,
    customRef,
    triggerRef,
    type Ref,
    type MaybeRef,
    type MaybeRefOrGetter,
    type ToRef,
    type ToRefs,
    type UnwrapRef,
    type ShallowRef,
    type ShallowUnwrapRef,
    type RefUnwrapBailTypes,
    type CustomRefFactory,
} from './ref'

// `reactive` 相关 API：负责对象代理化、只读代理和原始值逃生口。
export {
    reactive,
    readonly,
    isReactive,
    isReadonly,
    isShallow,
    isProxy,
    shallowReactive,
    shallowReadonly,
    markRaw,
    toRaw,
    toReactive,
    toReadonly,
    type Raw,
    type DeepReadonly,
    type ShallowReactive,
    type UnwrapNestedRefs,
    type Reactive,
    type ReactiveMarker,
} from './reactive'

// `computed` 相关 API：负责带缓存的派生值。
export {
    computed,
    type ComputedRef,
    type WritableComputedRef,
    type WritableComputedOptions,
    type ComputedGetter,
    type ComputedSetter,
    type ComputedRefImpl,
} from './computed'

// `effect` 相关 API：负责副作用注册、依赖收集控制与手动停止。
export {
    effect,
    stop,
    enableTracking,
    pauseTracking,
    resetTracking,
    onEffectCleanup,
    ReactiveEffect,
    EffectFlags,
    type ReactiveEffectRunner,
    type ReactiveEffectOptions,
    type EffectScheduler,
    type DebuggerOptions,
    type DebuggerEvent,
    type DebuggerEventExtraInfo,
} from './effect'

// 依赖系统底层 API：通常由代理层和 ref / computed 内部调用。
export {
    trigger,
    track,
    ITERATE_KEY,
    ARRAY_ITERATE_KEY,
    MAP_KEY_ITERATE_KEY,
} from './dep'

// effect scope：负责把一组 effects 组织到同一个可停止的作用域里。
export {
    effectScope,
    EffectScope,
    getCurrentScope,
    onScopeDispose,
} from './effectScope'

// 数组增强辅助：给数组读取方法补依赖收集逻辑。
export { reactiveReadArray, shallowReadArray } from './arrayInstrumentations'

// 响应式系统使用的内部常量和标记位。
export { TrackOpTypes, TriggerOpTypes, ReactiveFlags } from './constants'

// `watch` 相关 API：负责监听 source、执行回调和深度遍历。
export {
    watch,
    getCurrentWatcher,
    traverse,
    onWatcherCleanup,
    WatchErrorCodes,
    type WatchOptions,
    type WatchScheduler,
    type WatchStopHandle,
    type WatchHandle,
    type WatchEffect,
    type WatchSource,
    type WatchCallback,
    type OnCleanup,
} from './watch'
