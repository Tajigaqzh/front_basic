// 这个文件是 @vue-source/reactivity 的统一导出层。
//
// 它本身不承载运行时逻辑，职责只有两个：
// 1. 把对外 API 按能力分组重新导出
// 2. 收敛内部文件结构，让外部调用方只依赖包入口，不直接耦合具体实现文件

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
export {
  computed,
  type ComputedRef,
  type WritableComputedRef,
  type WritableComputedOptions,
  type ComputedGetter,
  type ComputedSetter,
  type ComputedRefImpl,
} from './computed'
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
export {
  trigger,
  track,
  ITERATE_KEY,
  ARRAY_ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
} from './dep'
export {
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
} from './effectScope'
export { reactiveReadArray, shallowReadArray } from './arrayInstrumentations'
export { TrackOpTypes, TriggerOpTypes, ReactiveFlags } from './constants'
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
