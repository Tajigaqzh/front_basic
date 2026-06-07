import type {
  _StoreWithGetters_Writable,
  StoreActions,
  StoreGetters,
  StoreState,
} from './types'

type AnyStoreDefinition = {
  (pinia?: any): any
  $id: string
}

export let mapStoreSuffix = 'Store'

export function setMapStoreSuffix(suffix: string): void {
  mapStoreSuffix = suffix
}

type _StoreFor<TUseStore extends AnyStoreDefinition> = ReturnType<TUseStore>
type _StateKeys<TUseStore extends AnyStoreDefinition> = keyof StoreState<_StoreFor<TUseStore>> & string
type _GetterKeys<TUseStore extends AnyStoreDefinition> = keyof StoreGetters<_StoreFor<TUseStore>> & string
type _ActionKeys<TUseStore extends AnyStoreDefinition> = keyof StoreActions<_StoreFor<TUseStore>> & string
type _StateOrGetterKeys<TUseStore extends AnyStoreDefinition> =
  | _StateKeys<TUseStore>
  | _GetterKeys<TUseStore>
type _WritableGetterKeys<TUseStore extends AnyStoreDefinition> =
  keyof _StoreWithGetters_Writable<StoreGetters<_StoreFor<TUseStore>>> & string
type _WritableStateKeys<TUseStore extends AnyStoreDefinition> =
  | _StateKeys<TUseStore>
  | _WritableGetterKeys<TUseStore>

type _MapStoresReturn<Stores extends readonly AnyStoreDefinition[]> = {
  [K in Stores[number] as `${K['$id']}${string}`]: (
    this: { $pinia: Parameters<K>[0] }
  ) => ReturnType<K>
}

export function mapStores<Stores extends readonly AnyStoreDefinition[]>(
  ...stores: Stores
): _MapStoresReturn<Stores> {
  return stores.reduce((mapped, useStore) => {
    ;(mapped as Record<string, (this: { $pinia: unknown }) => ReturnType<typeof useStore>>)[
      `${useStore.$id}${mapStoreSuffix}`
    ] = function (this: {
      $pinia: Parameters<typeof useStore>[0]
    }) {
      return useStore(this.$pinia)
    }
    return mapped
  }, {} as _MapStoresReturn<Stores>)
}

type _MapStateArrayReturn<
  TUseStore extends AnyStoreDefinition,
  Keys extends _StateOrGetterKeys<TUseStore>,
> = {
  [K in Keys]: (
    this: { $pinia: Parameters<TUseStore>[0] }
  ) => ReturnType<TUseStore>[K]
}

type _MapStateObjectReturn<
  TUseStore extends AnyStoreDefinition,
  TMapper extends Record<
    string,
    _StateOrGetterKeys<TUseStore> | ((store: ReturnType<TUseStore>) => any)
  >,
> = {
  [K in keyof TMapper]: (
    this: { $pinia: Parameters<TUseStore>[0] }
  ) => TMapper[K] extends (store: ReturnType<TUseStore>) => infer R
    ? R
    : TMapper[K] extends keyof ReturnType<TUseStore>
      ? ReturnType<TUseStore>[TMapper[K]]
      : never
}

export function mapState<
  TUseStore extends AnyStoreDefinition,
  Keys extends _StateOrGetterKeys<TUseStore>,
>(
  useStore: TUseStore,
  keysOrMapper: readonly Keys[]
): _MapStateArrayReturn<TUseStore, Keys>
export function mapState<
  TUseStore extends AnyStoreDefinition,
  TMapper extends Record<
    string,
    _StateOrGetterKeys<TUseStore> | ((store: ReturnType<TUseStore>) => any)
  >,
>(
  useStore: TUseStore,
  keysOrMapper: TMapper
): _MapStateObjectReturn<TUseStore, TMapper>
export function mapState(
  useStore: AnyStoreDefinition,
  keysOrMapper: readonly string[] | Record<string, string | ((store: any) => any)>
) {
  if (Array.isArray(keysOrMapper)) {
    return keysOrMapper.reduce((mapped, key) => {
      mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }) {
        return useStore(this.$pinia)[key]
      }
      return mapped
    }, {} as Record<string, (this: { $pinia: unknown }) => any>)
  }

  const mapper = keysOrMapper as Record<
    string,
    string | ((store: any) => any)
  >

  return Object.keys(mapper).reduce((mapped, key) => {
    mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }) {
      const store = useStore(this.$pinia)
      const target = mapper[key]
      return typeof target === 'function' ? target.call(this, store) : store[target]
    }
    return mapped
  }, {} as Record<string, (this: { $pinia: unknown }) => any>)
}

export const mapGetters = mapState

type _MapWritableStateEntry<
  TUseStore extends AnyStoreDefinition,
  K extends _WritableStateKeys<TUseStore>,
> = {
  get: (this: { $pinia: Parameters<TUseStore>[0] }) => ReturnType<TUseStore>[K]
  set: (this: { $pinia: Parameters<TUseStore>[0] }, value: ReturnType<TUseStore>[K]) => void
}

type _MapWritableStateArrayReturn<
  TUseStore extends AnyStoreDefinition,
  Keys extends _WritableStateKeys<TUseStore>,
> = {
  [K in Keys]: _MapWritableStateEntry<TUseStore, K>
}

type _MapWritableStateObjectReturn<
  TUseStore extends AnyStoreDefinition,
  TMapper extends Record<string, _WritableStateKeys<TUseStore>>,
> = {
  [K in keyof TMapper]: _MapWritableStateEntry<TUseStore, TMapper[K]>
}

export function mapWritableState<
  TUseStore extends AnyStoreDefinition,
  Keys extends _WritableStateKeys<TUseStore>,
>(
  useStore: TUseStore,
  keysOrMapper: readonly Keys[]
): _MapWritableStateArrayReturn<TUseStore, Keys>
export function mapWritableState<
  TUseStore extends AnyStoreDefinition,
  TMapper extends Record<string, _WritableStateKeys<TUseStore>>,
>(
  useStore: TUseStore,
  keysOrMapper: TMapper
): _MapWritableStateObjectReturn<TUseStore, TMapper>
export function mapWritableState(
  useStore: AnyStoreDefinition,
  keysOrMapper: readonly string[] | Record<string, string>
) {
  if (Array.isArray(keysOrMapper)) {
    return keysOrMapper.reduce((mapped, key) => {
      mapped[key] = {
        get(this: { $pinia: Parameters<typeof useStore>[0] }) {
          return useStore(this.$pinia)[key]
        },
        set(this: { $pinia: Parameters<typeof useStore>[0] }, value: unknown) {
          useStore(this.$pinia)[key] = value
        },
      }
      return mapped
    }, {} as Record<string, { get(this: { $pinia: unknown }): unknown; set(this: { $pinia: unknown }, value: unknown): void }>)
  }

  const mapper = keysOrMapper as Record<string, string>

  return Object.keys(mapper).reduce((mapped, key) => {
    const target = mapper[key]
    mapped[key] = {
      get(this: { $pinia: Parameters<typeof useStore>[0] }) {
        return useStore(this.$pinia)[target]
      },
      set(this: { $pinia: Parameters<typeof useStore>[0] }, value: unknown) {
        useStore(this.$pinia)[target] = value
      },
    }
    return mapped
  }, {} as Record<string, { get(this: { $pinia: unknown }): unknown; set(this: { $pinia: unknown }, value: unknown): void }>)
}

type _MapActionsArrayReturn<
  TUseStore extends AnyStoreDefinition,
  Keys extends _ActionKeys<TUseStore>,
> = {
  [K in Keys]: (
    this: { $pinia: Parameters<TUseStore>[0] },
    ...args: StoreActions<_StoreFor<TUseStore>>[K] extends (...args: infer Args) => any ? Args : never
  ) => StoreActions<_StoreFor<TUseStore>>[K] extends (...args: any[]) => infer R ? R : never
}

type _MapActionsObjectReturn<
  TUseStore extends AnyStoreDefinition,
  TMapper extends Record<string, _ActionKeys<TUseStore>>,
> = {
  [K in keyof TMapper]: (
    this: { $pinia: Parameters<TUseStore>[0] },
    ...args: StoreActions<_StoreFor<TUseStore>>[TMapper[K]] extends (...args: infer Args) => any
      ? Args
      : never
  ) => StoreActions<_StoreFor<TUseStore>>[TMapper[K]] extends (...args: any[]) => infer R
    ? R
    : never
}

export function mapActions<
  TUseStore extends AnyStoreDefinition,
  Keys extends _ActionKeys<TUseStore>,
>(
  useStore: TUseStore,
  keysOrMapper: readonly Keys[]
): _MapActionsArrayReturn<TUseStore, Keys>
export function mapActions<
  TUseStore extends AnyStoreDefinition,
  TMapper extends Record<string, _ActionKeys<TUseStore>>,
>(
  useStore: TUseStore,
  keysOrMapper: TMapper
): _MapActionsObjectReturn<TUseStore, TMapper>
export function mapActions(
  useStore: AnyStoreDefinition,
  keysOrMapper: readonly string[] | Record<string, string>
) {
  if (Array.isArray(keysOrMapper)) {
    return keysOrMapper.reduce((mapped, key) => {
      mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }, ...args: unknown[]) {
        return useStore(this.$pinia)[key](...args)
      }
      return mapped
    }, {} as Record<string, (this: { $pinia: unknown }, ...args: unknown[]) => any>)
  }

  const mapper = keysOrMapper as Record<string, string>

  return Object.keys(mapper).reduce((mapped, key) => {
    const target = mapper[key]
    mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }, ...args: unknown[]) {
      return useStore(this.$pinia)[target](...args)
    }
    return mapped
  }, {} as Record<string, (this: { $pinia: unknown }, ...args: unknown[]) => any>)
}
