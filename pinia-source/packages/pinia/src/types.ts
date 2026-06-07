import type {
  ComputedRef,
  Ref,
  ToRef,
  WatchOptions,
  WritableComputedRef,
} from 'vue'

// Pinia state 的基础约束。
// key 可以是 string/number/symbol，value 在源码阅读版里保持 any，避免类型实现喧宾夺主。
export type StateTree = Record<PropertyKey, any>

// action/getter 内部复用的通用函数类型。
export type _Method = (...args: any[]) => any

// option store 的 getters 结构。
// 每个 getter 接收展开后的 state，并允许读取插件注入的自定义 state 属性。
export type _GettersTree<S extends StateTree = StateTree> = Record<
  string,
  (state: UnwrapState<S> & PiniaCustomStateProperties<S> & Record<string, any>) => any
>

// option/setup store 的 actions 结构。
export type _ActionsTree = Record<string, _Method>

// 阅读版只做浅层展开。
// 官方 Pinia 对 ref/reactive 的类型展开更复杂，这里保留主线含义。
export type UnwrapState<S extends StateTree> = {
  [K in keyof S]: S[K]
}

// 插件可通过模块扩展给所有 store 注入属性。
// 这里保留空接口，是为了让类型扩展点和官方 Pinia 对齐。
export interface PiniaCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> {}

// 插件可通过模块扩展给 $state 注入属性。
export interface PiniaCustomStateProperties<S extends StateTree = StateTree> {}

// defineStore 选项的基础扩展点。
// 官方 Pinia 插件类型会基于它读取额外字段。
export interface DefineStoreOptionsBase<S extends StateTree, Store> {}

// option store 的 defineStore 配置。
export interface DefineStoreOptions<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends _GettersTree<S> = _GettersTree<S>,
  A = {},
> extends DefineStoreOptionsBase<S, Store<Id, S, G, A>> {
  // store id。实际 defineStore(id, options) 已经单独传入 id，这里保留兼容字段。
  id?: Id
  // state 必须是函数，避免多个 store 实例共享同一个对象。
  state?: () => S
  // getters 会被转成 computed。
  getters?: G
  // actions 会被 wrapAction 包装。
  actions?: A
}

// setup store 的 defineStore 配置。
// setup store 的 state/getter/action 来自 setup 返回值，所以这里只保留 actions 给插件读取。
export interface DefineSetupStoreOptions<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> extends DefineStoreOptionsBase<S, Store<Id, S, G, A>> {
  actions?: A
}

// setup store helper 参数。
// 阅读版暂不实现 hydrate/action helper，但保留入口以对齐官方结构。
export interface SetupStoreHelpers {}

// 从 getter 定义中提取只读 getter。
// 支持两种来源：
// 1. option getter 函数。
// 2. setup store 返回的 readonly computed。
export type _StoreWithGetters_Readonly<G> = {
  readonly [K in keyof G as G[K] extends (...args: any[]) => any
    ? K
    : G[K] extends ComputedRef<any>
      ? G[K] extends WritableComputedRef<any>
        ? never
        : K
      : never]: G[K] extends (...args: any[]) => infer R
    ? R
    : G[K] extends ComputedRef<infer R>
      ? R
      : never
}

// 从 getter 定义中提取可写 getter。
// setup store 返回 WritableComputedRef 时，store 上应允许写入。
export type _StoreWithGetters_Writable<G> = {
  [K in keyof G as G[K] extends WritableComputedRef<any> ? K : never]:
    G[K] extends WritableComputedRef<infer R> ? R : never
}

// store 上最终暴露的 getter 类型 = 只读 getter + 可写 getter。
export type _StoreWithGetters<G> = _StoreWithGetters_Readonly<G> &
  _StoreWithGetters_Writable<G>

// 从 setup 返回对象中抽取 action：
// 函数字段就是 action。
export type _ExtractActionsFromSetupStore<SS> = Pick<
  SS,
  {
    [K in keyof SS]: SS[K] extends _Method ? K : never
  }[keyof SS]
>

// 从 setup 返回对象中抽取 getter：
// ComputedRef 字段就是 getter。
export type _ExtractGettersFromSetupStore<SS> = Pick<
  SS,
  {
    [K in keyof SS]: SS[K] extends ComputedRef<any> ? K : never
  }[keyof SS]
>

// 从 setup 返回对象中抽取 state：
// 排除函数和 computed，ref 会提取 value 类型，reactive/plain object 保留原类型。
export type _ExtractStateFromSetupStore<SS> = {
  [K in keyof SS as SS[K] extends _Method
    ? never
    : SS[K] extends ComputedRef<any>
      ? never
      : K]: SS[K] extends Ref<infer R> ? R : SS[K]
}

// 获取 action 名称联合类型。
export type _ActionNames<A> = A extends Record<string, any> ? Extract<keyof A, string> : never

// Store 是用户拿到的最终对象类型。
// 它由公共 API、state、getters、actions、自定义插件属性组合而成。
export type Store<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> = {
  // store 唯一 id。
  $id: Id
  // 根 state 快捷访问器。
  $state: S & Partial<PiniaCustomStateProperties<S>>
  // 批量 patch：对象写法或函数写法。
  $patch(partialState: Partial<S> | ((state: S) => void)): void
  // 重置 state。
  $reset(): void
  // 销毁 store。
  $dispose(): void
  // 监听 action。
  $onAction(
    listener: StoreOnActionListener<Id, S, G, A>,
    detached?: boolean
  ): () => void
  // 监听 state mutation。
  $subscribe(
    listener: SubscriptionCallback<S>,
    options?: { detached?: boolean } & WatchOptions
  ): () => void
} & S &
  // 合并 getters。
  _StoreWithGetters<G> &
  // 如果 A 还是默认 ActionsTree，说明没有具体 action 类型，就不额外合并。
  (_ActionsTree extends A ? {} : A) &
  // 合并插件自定义属性。
  Partial<PiniaCustomProperties<Id, S, G, A>>

// 从 Store 类型中反推出 state。
export type StoreState<TStore> =
  TStore extends Store<string, infer S, infer _G, infer _A> ? S : never

// 从 Store 类型中反推出 getters。
export type StoreGetters<TStore> =
  TStore extends Store<string, infer _S, infer G, infer _A> ? G : never

// 从 Store 类型中反推出 actions。
export type StoreActions<TStore> =
  TStore extends Store<string, infer _S, infer _G, infer A>
    ? _ActionsTree extends A
      ? {}
      : A
    : never

// storeToRefs 的返回类型。
// state/custom state 全部转 ToRef，getter 走 _StoreToRefsForGetters。
export type StoreToRefs<TStore> = {
  [K in keyof StoreState<TStore>]: ToRef<StoreState<TStore>[K]>
} & {
  [K in keyof PiniaCustomStateProperties<StoreState<TStore>>]:
    ToRef<PiniaCustomStateProperties<StoreState<TStore>>[K]>
} & _StoreToRefsForGetters<StoreGetters<TStore>>

// getter 转 ref 的规则：
// - 只读 getter -> ComputedRef
// - 可写 getter -> WritableComputedRef
export type _StoreToRefsForGetters<G> = {
  readonly [K in keyof G as G[K] extends (...args: any[]) => any
    ? K
    : G[K] extends ComputedRef<any>
      ? G[K] extends WritableComputedRef<any>
        ? never
        : K
      : never]: G[K] extends (...args: any[]) => infer R
    ? ComputedRef<R>
    : G[K] extends ComputedRef<infer R>
      ? ComputedRef<R>
      : never
} & {
  [K in keyof G as G[K] extends WritableComputedRef<any> ? K : never]:
    G[K] extends WritableComputedRef<infer R> ? WritableComputedRef<R> : never
}

// 运行时通用 store 类型。
// 插件、缓存、内部工具不关心具体 state/getter/action 类型时使用它。
export interface StoreGeneric {
  // store id。
  $id: string
  // 任意形状 state。
  $state: StateTree
  // 公共 patch API。
  $patch(partialState: Partial<StateTree> | ((state: StateTree) => void)): void
  // 公共 reset API。
  $reset(): void
  // 公共 dispose API。
  $dispose(): void
  // action 订阅 API。
  $onAction(listener: StoreOnActionListener, detached?: boolean): () => void
  // state 订阅 API。
  $subscribe(
    listener: SubscriptionCallback<StateTree>,
    options?: { detached?: boolean } & WatchOptions
  ): () => void
  // storeToRefs 用来识别 state 字段。
  _stateKeys?: string[]
  // storeToRefs 用来识别 getter 字段。
  _gettersKeys?: string[]
  // wrapAction 用来触发 $onAction 订阅。
  _actionSubscriptions?: Set<StoreOnActionListener<string, StateTree, Record<string, any>, Record<string, any>>>
  // 阅读版中用于保留 active pinia 线索的内部字段。
  _p?: any
  // 允许插件、state、getter、action 挂任意 key。
  [key: string]: any
}

// defineStore 返回的 useStore 函数类型。
export interface StoreDefinition<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = Record<string, any>,
> {
  // 调用 useStore 可显式传入 pinia，也可以从 inject/activePinia 获取。
  (pinia?: any): Store<Id, S, G, A>
  // useStore.$id 用于 mapStores、调试和缓存定位。
  $id: Id
}

// 插件上下文中的 options 类型。
// id 已经单独放在 store.$id，actions 始终补成对象。
export interface DefineStoreOptionsInPlugin<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> extends Omit<DefineStoreOptions<Id, S, G, A>, 'id' | 'actions'> {
  actions: A
}

// $onAction 监听器收到的上下文。
export type _StoreOnActionListenerContext<
  TStore,
  TName extends string,
  TAction,
> = {
  // action 名称。
  name: TName
  // 当前 store。
  store: TStore
  // action 入参。
  args: TAction extends _Method ? Parameters<TAction> : unknown[]
  // action 成功后注册回调。
  after(
    callback: TAction extends _Method
      ? (resolvedReturn: Awaited<ReturnType<TAction>>) => void
      : (resolvedReturn: unknown) => void
  ): void
  // action 报错后注册回调。
  onError(callback: (error: unknown) => void): void
}

// 根据 action 类型生成精确的 $onAction context。
// 没有具体 actions 时退回通用 string/_Method。
export type StoreOnActionListenerContext<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = Record<string, any>,
> = _ActionNames<A> extends never
  ? _StoreOnActionListenerContext<Store<Id, S, G, A>, string, _Method>
  : {
      [Name in _ActionNames<A>]: _StoreOnActionListenerContext<
        Store<Id, S, G, A>,
        Name,
        A[Name]
      >
    }[_ActionNames<A>]

// $onAction(listener) 的 listener 类型。
export type StoreOnActionListener<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = Record<string, any>,
> = (
  context: StoreOnActionListenerContext<Id, S, G, A>
) => void

// mutation 类型枚举。
export enum MutationType {
  // 直接修改：store.count++。
  direct = 'direct',
  // 对象 patch：store.$patch({ count: 1 })。
  patchObject = 'patch object',
  // 函数 patch：store.$patch(state => state.count++)。
  patchFunction = 'patch function',
}

// 所有 mutation 事件的公共字段。
export interface SubscriptionCallbackMutationBase {
  // 发生 mutation 的 store id。
  storeId: string
  // mutation 类型。
  type: MutationType
}

// direct mutation。
export interface SubscriptionCallbackMutationDirect
  extends SubscriptionCallbackMutationBase {
  type: MutationType.direct
}

// patch object mutation，额外携带 payload。
export interface SubscriptionCallbackMutationPatchObject<S>
  extends SubscriptionCallbackMutationBase {
  type: MutationType.patchObject
  payload: Partial<S>
}

// patch function mutation。
export interface SubscriptionCallbackMutationPatchFunction
  extends SubscriptionCallbackMutationBase {
  type: MutationType.patchFunction
}

// $subscribe 回调可能收到的 mutation 联合类型。
export type SubscriptionCallbackMutation<S> =
  | SubscriptionCallbackMutationDirect
  | SubscriptionCallbackMutationPatchObject<S>
  | SubscriptionCallbackMutationPatchFunction

// $subscribe(listener) 的 listener 类型。
export type SubscriptionCallback<S> = (
  mutation: SubscriptionCallbackMutation<S>,
  state: S
) => void

// 判断普通对象。
// 用于区分需要深合并的 state object 和数组/Date/类实例等值。
export function isPlainObject(value: unknown): value is StateTree {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

// 判断 computed-like。
// Vue computed ref 内部带 effect 字段，阅读版用这个轻量规则区分 getter ref。
export function isComputedLike(value: unknown): value is ComputedRef<unknown> {
  return !!value && typeof value === 'object' && 'effect' in (value as Record<string, unknown>)
}

// 判断 ref-like。
// 当前阅读版主要用于类型/测试辅助。
export function isWritableRef(value: unknown): value is Ref<unknown> {
  return !!value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)
}
