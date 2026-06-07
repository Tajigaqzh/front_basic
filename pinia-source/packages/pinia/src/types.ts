import type {
  ComputedRef,
  Ref,
  ToRef,
  WatchOptions,
  WritableComputedRef,
} from 'vue'

export type StateTree = Record<PropertyKey, any>

export type _Method = (...args: any[]) => any

export type _GettersTree<S extends StateTree = StateTree> = Record<
  string,
  (state: UnwrapState<S> & PiniaCustomStateProperties<S> & Record<string, any>) => any
>

export type _ActionsTree = Record<string, _Method>

export type UnwrapState<S extends StateTree> = {
  [K in keyof S]: S[K]
}

export interface PiniaCustomProperties<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> {}

export interface PiniaCustomStateProperties<S extends StateTree = StateTree> {}

export interface DefineStoreOptionsBase<S extends StateTree, Store> {}

export interface DefineStoreOptions<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends _GettersTree<S> = _GettersTree<S>,
  A = {},
> extends DefineStoreOptionsBase<S, Store<Id, S, G, A>> {
  id?: Id
  state?: () => S
  getters?: G
  actions?: A
}

export interface DefineSetupStoreOptions<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> extends DefineStoreOptionsBase<S, Store<Id, S, G, A>> {
  actions?: A
}

export interface SetupStoreHelpers {}

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

export type _StoreWithGetters_Writable<G> = {
  [K in keyof G as G[K] extends WritableComputedRef<any> ? K : never]:
    G[K] extends WritableComputedRef<infer R> ? R : never
}

export type _StoreWithGetters<G> = _StoreWithGetters_Readonly<G> &
  _StoreWithGetters_Writable<G>

export type _ExtractActionsFromSetupStore<SS> = Pick<
  SS,
  {
    [K in keyof SS]: SS[K] extends _Method ? K : never
  }[keyof SS]
>

export type _ExtractGettersFromSetupStore<SS> = Pick<
  SS,
  {
    [K in keyof SS]: SS[K] extends ComputedRef<any> ? K : never
  }[keyof SS]
>

export type _ExtractStateFromSetupStore<SS> = {
  [K in keyof SS as SS[K] extends _Method
    ? never
    : SS[K] extends ComputedRef<any>
      ? never
      : K]: SS[K] extends Ref<infer R> ? R : SS[K]
}

export type _ActionNames<A> = A extends Record<string, any> ? Extract<keyof A, string> : never

export type Store<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> = {
  $id: Id
  $state: S & Partial<PiniaCustomStateProperties<S>>
  $patch(partialState: Partial<S> | ((state: S) => void)): void
  $reset(): void
  $dispose(): void
  $onAction(
    listener: StoreOnActionListener<Id, S, G, A>,
    detached?: boolean
  ): () => void
  $subscribe(
    listener: SubscriptionCallback<S>,
    options?: { detached?: boolean } & WatchOptions
  ): () => void
} & S &
  _StoreWithGetters<G> &
  (_ActionsTree extends A ? {} : A) &
  Partial<PiniaCustomProperties<Id, S, G, A>>

export type StoreState<TStore> =
  TStore extends Store<string, infer S, infer _G, infer _A> ? S : never

export type StoreGetters<TStore> =
  TStore extends Store<string, infer _S, infer G, infer _A> ? G : never

export type StoreActions<TStore> =
  TStore extends Store<string, infer _S, infer _G, infer A>
    ? _ActionsTree extends A
      ? {}
      : A
    : never

export type StoreToRefs<TStore> = {
  [K in keyof StoreState<TStore>]: ToRef<StoreState<TStore>[K]>
} & {
  [K in keyof PiniaCustomStateProperties<StoreState<TStore>>]:
    ToRef<PiniaCustomStateProperties<StoreState<TStore>>[K]>
} & _StoreToRefsForGetters<StoreGetters<TStore>>

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

export interface StoreGeneric {
  $id: string
  $state: StateTree
  $patch(partialState: Partial<StateTree> | ((state: StateTree) => void)): void
  $reset(): void
  $dispose(): void
  $onAction(listener: StoreOnActionListener, detached?: boolean): () => void
  $subscribe(
    listener: SubscriptionCallback<StateTree>,
    options?: { detached?: boolean } & WatchOptions
  ): () => void
  _stateKeys?: string[]
  _gettersKeys?: string[]
  _actionSubscriptions?: Set<StoreOnActionListener<string, StateTree, Record<string, any>, Record<string, any>>>
  _p?: any
  [key: string]: any
}

export interface StoreDefinition<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = Record<string, any>,
> {
  (pinia?: any): Store<Id, S, G, A>
  $id: Id
}

export interface DefineStoreOptionsInPlugin<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = {},
> extends Omit<DefineStoreOptions<Id, S, G, A>, 'id' | 'actions'> {
  actions: A
}

export type _StoreOnActionListenerContext<
  TStore,
  TName extends string,
  TAction,
> = {
  name: TName
  store: TStore
  args: TAction extends _Method ? Parameters<TAction> : unknown[]
  after(
    callback: TAction extends _Method
      ? (resolvedReturn: Awaited<ReturnType<TAction>>) => void
      : (resolvedReturn: unknown) => void
  ): void
  onError(callback: (error: unknown) => void): void
}

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

export type StoreOnActionListener<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends Record<string, any> = Record<string, any>,
  A = Record<string, any>,
> = (
  context: StoreOnActionListenerContext<Id, S, G, A>
) => void

export enum MutationType {
  direct = 'direct',
  patchObject = 'patch object',
  patchFunction = 'patch function',
}

export interface SubscriptionCallbackMutationBase {
  storeId: string
  type: MutationType
}

export interface SubscriptionCallbackMutationDirect
  extends SubscriptionCallbackMutationBase {
  type: MutationType.direct
}

export interface SubscriptionCallbackMutationPatchObject<S>
  extends SubscriptionCallbackMutationBase {
  type: MutationType.patchObject
  payload: Partial<S>
}

export interface SubscriptionCallbackMutationPatchFunction
  extends SubscriptionCallbackMutationBase {
  type: MutationType.patchFunction
}

export type SubscriptionCallbackMutation<S> =
  | SubscriptionCallbackMutationDirect
  | SubscriptionCallbackMutationPatchObject<S>
  | SubscriptionCallbackMutationPatchFunction

export type SubscriptionCallback<S> = (
  mutation: SubscriptionCallbackMutation<S>,
  state: S
) => void

export function isPlainObject(value: unknown): value is StateTree {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

export function isComputedLike(value: unknown): value is ComputedRef<unknown> {
  return !!value && typeof value === 'object' && 'effect' in (value as Record<string, unknown>)
}

export function isWritableRef(value: unknown): value is Ref<unknown> {
  return !!value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)
}
