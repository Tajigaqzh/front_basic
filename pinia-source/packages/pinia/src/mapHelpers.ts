import type {
  _StoreWithGetters_Writable,
  StoreActions,
  StoreGetters,
  StoreState,
} from './types'

// Options API helper 接收的 useStore 函数形状。
// 它既是函数，也带有 `$id`，例如 useUserStore.$id === 'user'。
type AnyStoreDefinition = {
  (pinia?: any): any
  $id: string
}

// mapStores 默认生成的属性名后缀。
// useUserStore + 默认后缀会映射成 `userStore`。
export let mapStoreSuffix = 'Store'

// 允许用户全局修改 mapStores 后缀。
// 例如 setMapStoreSuffix('_store') 后会得到 `user_store`。
export function setMapStoreSuffix(suffix: string): void {
  mapStoreSuffix = suffix
}

// 取 useStore 的返回 store 类型。
type _StoreFor<TUseStore extends AnyStoreDefinition> = ReturnType<TUseStore>
// 从 store 中抽取 state key。
type _StateKeys<TUseStore extends AnyStoreDefinition> = keyof StoreState<_StoreFor<TUseStore>> & string
// 从 store 中抽取 getter key。
type _GetterKeys<TUseStore extends AnyStoreDefinition> = keyof StoreGetters<_StoreFor<TUseStore>> & string
// 从 store 中抽取 action key。
type _ActionKeys<TUseStore extends AnyStoreDefinition> = keyof StoreActions<_StoreFor<TUseStore>> & string
// mapState 可以读取 state，也可以读取 getter。
type _StateOrGetterKeys<TUseStore extends AnyStoreDefinition> =
  | _StateKeys<TUseStore>
  | _GetterKeys<TUseStore>
// 可写 getter 来自 writable computed。
type _WritableGetterKeys<TUseStore extends AnyStoreDefinition> =
  keyof _StoreWithGetters_Writable<StoreGetters<_StoreFor<TUseStore>>> & string
// mapWritableState 可以写 state，也可以写 writable getter。
type _WritableStateKeys<TUseStore extends AnyStoreDefinition> =
  | _StateKeys<TUseStore>
  | _WritableGetterKeys<TUseStore>

// mapStores 返回对象的类型。
// key 是 `${storeId}${suffix}`，value 是 Options API computed 方法。
type _MapStoresReturn<Stores extends readonly AnyStoreDefinition[]> = {
  [K in Stores[number] as `${K['$id']}${string}`]: (
    this: { $pinia: Parameters<K>[0] }
  ) => ReturnType<K>
}

/**
 * Options API helper：把多个 useStore 映射成 computed。
 *
 * 示例：
 * computed: {
 *   ...mapStores(useUserStore)
 * }
 *
 * 运行时生成：
 * {
 *   userStore() { return useUserStore(this.$pinia) }
 * }
 */
export function mapStores<Stores extends readonly AnyStoreDefinition[]>(
  ...stores: Stores
): _MapStoresReturn<Stores> {
  // reduce 把 useStore[] 合成一个 computed 对象。
  return stores.reduce((mapped, useStore) => {
    // 生成属性名：store id + 当前后缀。
    ;(mapped as Record<string, (this: { $pinia: unknown }) => ReturnType<typeof useStore>>)[
      `${useStore.$id}${mapStoreSuffix}`
    ] = function (this: {
      $pinia: Parameters<typeof useStore>[0]
    }) {
      // Options API 中通过 this.$pinia 找到当前 app 安装的 Pinia。
      return useStore(this.$pinia)
    }
    return mapped
  }, {} as _MapStoresReturn<Stores>)
}

// 数组写法 mapState(useStore, ['count']) 的返回类型。
type _MapStateArrayReturn<
  TUseStore extends AnyStoreDefinition,
  Keys extends _StateOrGetterKeys<TUseStore>,
> = {
  [K in Keys]: (
    this: { $pinia: Parameters<TUseStore>[0] }
  ) => ReturnType<TUseStore>[K]
}

// 对象写法 mapState(useStore, { localName: 'count' }) 的返回类型。
// mapper value 也可以是函数：{ double: store => store.count * 2 }。
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

// 数组重载：key 必须来自 state 或 getter。
export function mapState<
  TUseStore extends AnyStoreDefinition,
  Keys extends _StateOrGetterKeys<TUseStore>,
>(
  useStore: TUseStore,
  keysOrMapper: readonly Keys[]
): _MapStateArrayReturn<TUseStore, Keys>
// 对象重载：本地 key 可以自定义，value 可以是远程 key 或 mapper 函数。
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
  // 数组写法：每个 key 直接映射到 store 同名属性。
  if (Array.isArray(keysOrMapper)) {
    return keysOrMapper.reduce((mapped, key) => {
      // Options API computed 函数，this 指向组件实例。
      mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }) {
        // 每次计算时拿到当前 store，并读取对应字段。
        return useStore(this.$pinia)[key]
      }
      return mapped
    }, {} as Record<string, (this: { $pinia: unknown }) => any>)
  }

  // 对象写法：key 是组件内 computed 名称，value 是 store key 或自定义函数。
  const mapper = keysOrMapper as Record<
    string,
    string | ((store: any) => any)
  >

  // 遍历 mapper 生成 computed 对象。
  return Object.keys(mapper).reduce((mapped, key) => {
    mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }) {
      // 先解析当前 store。
      const store = useStore(this.$pinia)
      // target 可能是字符串，也可能是函数。
      const target = mapper[key]
      // 函数写法把 store 交给用户；字符串写法直接读取 store[target]。
      return typeof target === 'function' ? target.call(this, store) : store[target]
    }
    return mapped
  }, {} as Record<string, (this: { $pinia: unknown }) => any>)
}

// Pinia 中 mapGetters 是 mapState 的别名。
// 因为 getter 在 store 上表现为普通属性，读取方式和 state 一样。
export const mapGetters = mapState

// mapWritableState 单个字段返回的是 computed descriptor，而不是函数。
type _MapWritableStateEntry<
  TUseStore extends AnyStoreDefinition,
  K extends _WritableStateKeys<TUseStore>,
> = {
  // computed.get 读取 store 字段。
  get: (this: { $pinia: Parameters<TUseStore>[0] }) => ReturnType<TUseStore>[K]
  // computed.set 写回 store 字段。
  set: (this: { $pinia: Parameters<TUseStore>[0] }, value: ReturnType<TUseStore>[K]) => void
}

// 数组写法返回同名 computed descriptor。
type _MapWritableStateArrayReturn<
  TUseStore extends AnyStoreDefinition,
  Keys extends _WritableStateKeys<TUseStore>,
> = {
  [K in Keys]: _MapWritableStateEntry<TUseStore, K>
}

// 对象写法返回重命名后的 computed descriptor。
type _MapWritableStateObjectReturn<
  TUseStore extends AnyStoreDefinition,
  TMapper extends Record<string, _WritableStateKeys<TUseStore>>,
> = {
  [K in keyof TMapper]: _MapWritableStateEntry<TUseStore, TMapper[K]>
}

// 数组重载。
export function mapWritableState<
  TUseStore extends AnyStoreDefinition,
  Keys extends _WritableStateKeys<TUseStore>,
>(
  useStore: TUseStore,
  keysOrMapper: readonly Keys[]
): _MapWritableStateArrayReturn<TUseStore, Keys>
// 对象重载。
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
  // 数组写法：同名 get/set。
  if (Array.isArray(keysOrMapper)) {
    return keysOrMapper.reduce((mapped, key) => {
      mapped[key] = {
        // getter 读取 store[key]。
        get(this: { $pinia: Parameters<typeof useStore>[0] }) {
          return useStore(this.$pinia)[key]
        },
        // setter 写回 store[key]，触发 Pinia state 更新。
        set(this: { $pinia: Parameters<typeof useStore>[0] }, value: unknown) {
          useStore(this.$pinia)[key] = value
        },
      }
      return mapped
    }, {} as Record<string, { get(this: { $pinia: unknown }): unknown; set(this: { $pinia: unknown }, value: unknown): void }>)
  }

  // 对象写法：组件字段名和 store 字段名可以不同。
  const mapper = keysOrMapper as Record<string, string>

  return Object.keys(mapper).reduce((mapped, key) => {
    // target 是真正的 store 字段名。
    const target = mapper[key]
    mapped[key] = {
      // 读取 store[target]。
      get(this: { $pinia: Parameters<typeof useStore>[0] }) {
        return useStore(this.$pinia)[target]
      },
      // 写入 store[target]。
      set(this: { $pinia: Parameters<typeof useStore>[0] }, value: unknown) {
        useStore(this.$pinia)[target] = value
      },
    }
    return mapped
  }, {} as Record<string, { get(this: { $pinia: unknown }): unknown; set(this: { $pinia: unknown }, value: unknown): void }>)
}

// mapActions 数组写法的返回类型。
type _MapActionsArrayReturn<
  TUseStore extends AnyStoreDefinition,
  Keys extends _ActionKeys<TUseStore>,
> = {
  [K in Keys]: (
    this: { $pinia: Parameters<TUseStore>[0] },
    ...args: StoreActions<_StoreFor<TUseStore>>[K] extends (...args: infer Args) => any ? Args : never
  ) => StoreActions<_StoreFor<TUseStore>>[K] extends (...args: any[]) => infer R ? R : never
}

// mapActions 对象写法的返回类型。
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

// 数组重载：组件 method 名和 action 名相同。
export function mapActions<
  TUseStore extends AnyStoreDefinition,
  Keys extends _ActionKeys<TUseStore>,
>(
  useStore: TUseStore,
  keysOrMapper: readonly Keys[]
): _MapActionsArrayReturn<TUseStore, Keys>
// 对象重载：组件 method 名可以重命名。
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
  // 数组写法：每个 key 生成一个 method。
  if (Array.isArray(keysOrMapper)) {
    return keysOrMapper.reduce((mapped, key) => {
      // method 被组件调用时，把参数原样转发给 store action。
      mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }, ...args: unknown[]) {
        return useStore(this.$pinia)[key](...args)
      }
      return mapped
    }, {} as Record<string, (this: { $pinia: unknown }, ...args: unknown[]) => any>)
  }

  // 对象写法：key 是组件 method 名，value 是 store action 名。
  const mapper = keysOrMapper as Record<string, string>

  return Object.keys(mapper).reduce((mapped, key) => {
    // target 是真正要调用的 action 名称。
    const target = mapper[key]
    mapped[key] = function (this: { $pinia: Parameters<typeof useStore>[0] }, ...args: unknown[]) {
      // 保留 this.$pinia 解析能力，并把所有参数透传。
      return useStore(this.$pinia)[target](...args)
    }
    return mapped
  }, {} as Record<string, (this: { $pinia: unknown }, ...args: unknown[]) => any>)
}
