/**
 * 文件作用：处理 Options API 选项合并与应用。
 *
 * 这份文件负责 data、computed、methods、watch、inject、provide 等选项的解析、合并和挂载。
 */

import {
  type Component,
  type ComponentInternalInstance,
  type ComponentInternalOptions,
  type ConcreteComponent,
  type Data,
  type InternalRenderFunction,
  type SetupContext,
  currentInstance,
} from './component'
import {
  type LooseRequired,
  NOOP,
  type Prettify,
  extend,
  isArray,
  isFunction,
  isObject,
  isPromise,
  isString,
} from '@vue-source/shared'
import { type Ref, getCurrentScope, isRef, traverse } from '@vue-source/reactivity'
import { computed } from './apiComputed'
import {
  type WatchCallback,
  type WatchOptions,
  createPathGetter,
  watch,
} from './apiWatch'
import { inject, provide } from './apiInject'
import {
  type DebuggerHook,
  type ErrorCapturedHook,
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onMounted,
  onRenderTracked,
  onRenderTriggered,
  onServerPrefetch,
  onUnmounted,
  onUpdated,
} from './apiLifecycle'
import {
  type ComputedGetter,
  type WritableComputedOptions,
  reactive,
} from '@vue-source/reactivity'
import type {
  ComponentObjectPropsOptions,
  ComponentPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
} from './componentProps'
import type {
  EmitsOptions,
  EmitsToProps,
  TypeEmitsToOptions,
} from './componentEmits'
import type { Directive } from './directives'
import {
  type ComponentPublicInstance,
  type CreateComponentPublicInstanceWithMixins,
  type IntersectionMixin,
  type UnwrapMixinsType,
  isReservedPrefix,
} from './componentPublicInstance'
import { warn } from './warning'
import type { VNodeChild } from './vnode'
import { callWithAsyncErrorHandling } from './errorHandling'
import { deepMergeData } from './compat/data'
import { DeprecationTypes, checkCompatEnabled } from './compat/compatConfig'
import {
  type CompatConfig,
  isCompatEnabled,
  softAssertCompatEnabled,
} from './compat/compatConfig'
import type { OptionMergeFunction } from './apiCreateApp'
import { LifecycleHooks } from './enums'
import type { SlotsType } from './componentSlots'
import {
  type ComponentTypeEmits,
  normalizePropsOrEmits,
} from './apiSetupHelpers'
import { markAsyncBoundary } from './helpers/useId'

/**
 * Interface for declaring custom options.
 *
 * @example
 * ```ts
 * declare module 'vue' {
 *   interface ComponentCustomOptions {
 *     beforeRouteUpdate?(
 *       to: Route,
 *       from: Route,
 *       next: () => void
 *     ): void
 *   }
 * }
 * ```
 */
export interface ComponentCustomOptions {}

export type RenderFunction = () => VNodeChild

export interface ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  E extends EmitsOptions,
  EE extends string = string,
  Defaults = {},
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
>
  extends
    LegacyOptions<Props, D, C, M, Mixin, Extends, I, II, Provide>,
    ComponentInternalOptions,
    ComponentCustomOptions {
  setup?: (
    this: void,
    props: LooseRequired<
      Props &
        Prettify<
          UnwrapMixinsType<
            IntersectionMixin<Mixin> & IntersectionMixin<Extends>,
            'P'
          >
        >
    >,
    ctx: SetupContext<E, S>,
  ) => Promise<RawBindings> | RawBindings | RenderFunction | void
  name?: string
  template?: string | object // can be a direct DOM node
  // Note: we are intentionally using the signature-less `Function` type here
  // since any type with signature will cause the whole inference to fail when
  // the return expression contains reference to `this`.
  // Luckily `render()` doesn't need any arguments nor does it care about return
  // type.
  render?: Function
  // NOTE: extending both LC and Record<string, Component> allows objects to be forced
  // to be of type Component, while still inferring LC generic
  components?: LC & Record<string, Component>
  // NOTE: extending both Directives and Record<string, Directive> allows objects to be forced
  // to be of type Directive, while still inferring Directives generic
  directives?: Directives & Record<string, Directive>
  inheritAttrs?: boolean
  emits?: (E | EE[]) & ThisType<void>
  slots?: S
  expose?: Exposed[]
  serverPrefetch?(): void | Promise<any>

  // Runtime compiler only -----------------------------------------------------
  compilerOptions?: RuntimeCompilerOptions

  // Internal ------------------------------------------------------------------

  /**
   * SSR only. This is produced by compiler-ssr and attached in compiler-sfc
   * not user facing, so the typing is lax and for test only.
   * @internal
   */
  ssrRender?: (
    ctx: any,
    push: (item: any) => void,
    parentInstance: ComponentInternalInstance,
    attrs: Data | undefined,
    // for compiler-optimized bindings
    $props: ComponentInternalInstance['props'],
    $setup: ComponentInternalInstance['setupState'],
    $data: ComponentInternalInstance['data'],
    $options: ComponentInternalInstance['ctx'],
  ) => void

  /**
   * Only generated by compiler-sfc to mark a ssr render function inlined and
   * returned from setup()
   * @internal
   */
  __ssrInlineRender?: boolean

  /**
   * marker for AsyncComponentWrapper
   * @internal
   */
  __asyncLoader?: () => Promise<ConcreteComponent>
  /**
   * the inner component resolved by the AsyncComponentWrapper
   * @internal
   */
  __asyncResolved?: ConcreteComponent
  /**
   * Exposed for lazy hydration
   * @internal
   */
  __asyncHydrate?: (
    el: Element,
    instance: ComponentInternalInstance,
    hydrate: () => void,
  ) => void

  // Type differentiators ------------------------------------------------------

  // Note these are internal but need to be exposed in d.ts for type inference
  // to work!

  // type-only differentiator to separate OptionWithoutProps from a constructor
  // type returned by defineComponent() or FunctionalComponent
  call?: (this: unknown, ...args: unknown[]) => never
  // type-only differentiators for built-in Vnode types
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never

  __defaults?: Defaults
}

/**
 * Subset of compiler options that makes sense for the runtime.
 */
export interface RuntimeCompilerOptions {
  isCustomElement?: (tag: string) => boolean
  whitespace?: 'preserve' | 'condense'
  comments?: boolean
  delimiters?: [string, string]
}

export type ComponentOptions<
  Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = any,
  M extends MethodOptions = any,
  Mixin extends ComponentOptionsMixin = any,
  Extends extends ComponentOptionsMixin = any,
  E extends EmitsOptions = any,
  EE extends string = string,
  Defaults = {},
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
> = ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  Defaults,
  I,
  II,
  S,
  LC,
  Directives,
  Exposed,
  Provide
> &
  ThisType<
    CreateComponentPublicInstanceWithMixins<
      {},
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      Readonly<Props>,
      Defaults,
      false,
      I,
      S,
      LC,
      Directives
    >
  >

export type ComponentOptionsMixin = ComponentOptionsBase<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export type ComputedOptions = Record<
  string,
  ComputedGetter<any> | WritableComputedOptions<any>
>

export interface MethodOptions {
  [key: string]: Function
}

export type ExtractComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: (...args: any[]) => infer TReturn }
    ? TReturn
    : T[key] extends (...args: any[]) => infer TReturn
      ? TReturn
      : never
}

export type ObjectWatchOptionItem = {
  handler: WatchCallback | string
} & WatchOptions

type WatchOptionItem = string | WatchCallback | ObjectWatchOptionItem

type ComponentWatchOptionItem = WatchOptionItem | WatchOptionItem[]

type ComponentWatchOptions = Record<string, ComponentWatchOptionItem>

export type ComponentProvideOptions = ObjectProvideOptions | Function

type ObjectProvideOptions = Record<string | symbol, unknown>

export type ComponentInjectOptions = string[] | ObjectInjectOptions

type ObjectInjectOptions = Record<
  string | symbol,
  string | symbol | { from?: string | symbol; default?: unknown }
>

export type InjectToObject<T extends ComponentInjectOptions> =
  T extends string[]
    ? {
        [K in T[number]]?: unknown
      }
    : T extends ObjectInjectOptions
      ? {
          [K in keyof T]?: unknown
        }
      : never

interface LegacyOptions<
  Props,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  I extends ComponentInjectOptions,
  II extends string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
> {
  compatConfig?: CompatConfig

  // allow any custom options
  [key: string]: any

  // state
  // Limitation: we cannot expose RawBindings on the `this` context for data
  // since that leads to some sort of circular inference and breaks ThisType
  // for the entire component.
  data?: (
    this: CreateComponentPublicInstanceWithMixins<
      Props,
      {},
      {},
      {},
      MethodOptions,
      Mixin,
      Extends
    >,
    vm: CreateComponentPublicInstanceWithMixins<
      Props,
      {},
      {},
      {},
      MethodOptions,
      Mixin,
      Extends
    >,
  ) => D
  computed?: C
  methods?: M
  watch?: ComponentWatchOptions
  provide?: Provide
  inject?: I | II[]

  // assets
  filters?: Record<string, Function>

  // composition
  mixins?: Mixin[]
  extends?: Extends

  // lifecycle
  beforeCreate?(): any
  created?(): any
  beforeMount?(): any
  mounted?(): any
  beforeUpdate?(): any
  updated?(): any
  activated?(): any
  deactivated?(): any
  /** @deprecated use `beforeUnmount` instead */
  beforeDestroy?(): any
  beforeUnmount?(): any
  /** @deprecated use `unmounted` instead */
  destroyed?(): any
  unmounted?(): any
  renderTracked?: DebuggerHook
  renderTriggered?: DebuggerHook
  errorCaptured?: ErrorCapturedHook

  /**
   * runtime compile only
   * @deprecated use `compilerOptions.delimiters` instead.
   */
  delimiters?: [string, string]

  /**
   * #3468
   *
   * type-only, used to assist Mixin's type inference,
   * TypeScript will try to simplify the inferred `Mixin` type,
   * with the `__differentiator`, TypeScript won't be able to combine different mixins,
   * because the `__differentiator` will be different
   */
  __differentiator?: keyof D | keyof C | keyof M
}

type MergedHook<T = () => void> = T | T[]

export type MergedComponentOptions = ComponentOptions &
  MergedComponentOptionsOverride

export type MergedComponentOptionsOverride = {
  beforeCreate?: MergedHook
  created?: MergedHook
  beforeMount?: MergedHook
  mounted?: MergedHook
  beforeUpdate?: MergedHook
  updated?: MergedHook
  activated?: MergedHook
  deactivated?: MergedHook
  /** @deprecated use `beforeUnmount` instead */
  beforeDestroy?: MergedHook
  beforeUnmount?: MergedHook
  /** @deprecated use `unmounted` instead */
  destroyed?: MergedHook
  unmounted?: MergedHook
  renderTracked?: MergedHook<DebuggerHook>
  renderTriggered?: MergedHook<DebuggerHook>
  errorCaptured?: MergedHook<ErrorCapturedHook>
}

export type OptionTypesKeys = 'P' | 'B' | 'D' | 'C' | 'M' | 'Defaults'

export type OptionTypesType<
  P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Defaults = {},
> = {
  P: P
  B: B
  D: D
  C: C
  M: M
  Defaults: Defaults
}

enum OptionTypes {
  PROPS = 'Props',
  DATA = 'Data',
  COMPUTED = 'Computed',
  METHODS = 'Methods',
  INJECT = 'Inject',
}

/**
 * 作用：在开发阶段检测 Options API 各选项之间是否出现重名。
 *
 * 返回值：
 * - 返回一个闭包，后续每注册一个 key 就调用一次。
 */
function createDuplicateChecker() {
  const cache = Object.create(null)
  return (type: OptionTypes, key: string) => {
    if (cache[key]) {
      warn(`${type} property "${key}" is already defined in ${cache[key]}.`)
    } else {
      cache[key] = type
    }
  }
}

// 控制公共实例代理是否缓存访问结果，初始化 data/computed 前必须先关闭。
export let shouldCacheAccess = true

/**
 * 作用：把组件定义中的 Options API 选项真正挂到组件实例上。
 *
 * 参数说明：
 * - `instance`：当前正在初始化的组件实例。
 *
 * 依赖关系：
 * - 依赖 `resolveMergedOptions` 先拿到 mixin / extends / 全局 mixin 合并后的最终选项。
 * - 会串联 `inject`、`methods`、`data`、`computed`、`watch`、生命周期注册等完整流程。
 */
export function applyOptions(instance: ComponentInternalInstance): void {
  const options = resolveMergedOptions(instance)
  const publicThis = instance.proxy! as any
  // `ctx` 是公共实例代理背后的原始上下文对象，Options API 的结果大多挂在这里。
  const ctx = instance.ctx

  // 状态初始化期间不能缓存代理访问结果，否则后续补挂字段时代理命中会失真。
  shouldCacheAccess = false

  // `beforeCreate` 必须最先执行，因为它有机会动态改写后续选项。
  if (options.beforeCreate) {
    callHook(options.beforeCreate, instance, LifecycleHooks.BEFORE_CREATE)
  }

  const {
    // state
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // lifecycle
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    renderTracked,
    renderTriggered,
    errorCaptured,
    serverPrefetch,
    // public API
    expose,
    inheritAttrs,
    // assets
    components,
    directives,
    filters,
  } = options

  const checkDuplicateProperties = __DEV__ ? createDuplicateChecker() : null

  if (__DEV__) {
    const [propsOptions] = instance.propsOptions
    if (propsOptions) {
      for (const key in propsOptions) {
        checkDuplicateProperties!(OptionTypes.PROPS, key)
      }
    }
  }

  // 初始化顺序要与 Vue 2 保持一致，避免旧项目迁移时行为差异。

  if (injectOptions) {
    resolveInjections(injectOptions, ctx, checkDuplicateProperties)
  }

  if (methods) {
    for (const key in methods) {
      const methodHandler = (methods as MethodOptions)[key]
      if (isFunction(methodHandler)) {
        // 方法最终都要绑定到公共实例，保证 `this` 指向组件代理。
        if (__DEV__) {
          Object.defineProperty(ctx, key, {
            value: methodHandler.bind(publicThis),
            configurable: true,
            enumerable: true,
            writable: true,
          })
        } else {
          ctx[key] = methodHandler.bind(publicThis)
        }
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.METHODS, key)
        }
      } else if (__DEV__) {
        warn(
          `Method "${key}" has type "${typeof methodHandler}" in the component definition. ` +
            `Did you reference the function correctly?`,
        )
      }
    }
  }

  if (dataOptions) {
    if (__DEV__ && !isFunction(dataOptions)) {
      warn(
        `The data option must be a function. ` +
          `Plain object usage is no longer supported.`,
      )
    }
    const data = dataOptions.call(publicThis, publicThis)
    if (__DEV__ && isPromise(data)) {
      warn(
        `data() returned a Promise - note data() cannot be async; If you ` +
          `intend to perform data fetching before component renders, use ` +
          `async setup() + <Suspense>.`,
      )
    }
    if (!isObject(data)) {
      __DEV__ && warn(`data() should return an object.`)
    } else {
      // `data()` 返回值会被转成响应式对象，后续渲染访问的就是这里。
      instance.data = reactive(data)
      if (__DEV__) {
        for (const key in data) {
          checkDuplicateProperties!(OptionTypes.DATA, key)
          // 开发环境把 data 暴露到 ctx，方便调试和开发代理提示。
          if (!isReservedPrefix(key[0])) {
            Object.defineProperty(ctx, key, {
              configurable: true,
              enumerable: true,
              get: () => data[key],
              set: NOOP,
            })
          }
        }
      }
    }
  }

  // data 已经挂完，之后可以重新启用代理访问缓存。
  shouldCacheAccess = true

  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = (computedOptions as ComputedOptions)[key]
      // 统一转成标准 computed getter/setter 形式，后面才能复用 reactivity 的 computed。
      const get = isFunction(opt)
        ? opt.bind(publicThis, publicThis)
        : isFunction(opt.get)
          ? opt.get.bind(publicThis, publicThis)
          : NOOP
      if (__DEV__ && get === NOOP) {
        warn(`Computed property "${key}" has no getter.`)
      }
      const set =
        !isFunction(opt) && isFunction(opt.set)
          ? opt.set.bind(publicThis)
          : __DEV__
            ? () => {
                warn(
                  `Write operation failed: computed property "${key}" is readonly.`,
                )
              }
            : NOOP
      const c = computed({
        get,
        set,
      })
      // 组件代理读取 computed 时，实际读取的是底层 computed ref 的 `.value`。
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c.value,
        set: v => (c.value = v),
      })
      if (__DEV__) {
        checkDuplicateProperties!(OptionTypes.COMPUTED, key)
      }
    }
  }

  if (watchOptions) {
    for (const key in watchOptions) {
      createWatcher(watchOptions[key], ctx, publicThis, key)
    }
  }

  if (provideOptions) {
    // `provide` 既支持对象也支持函数，函数场景要绑定组件实例执行。
    const provides = isFunction(provideOptions)
      ? provideOptions.call(publicThis)
      : provideOptions
    Reflect.ownKeys(provides).forEach(key => {
      provide(key, provides[key])
    })
  }

  if (created) {
    callHook(created, instance, LifecycleHooks.CREATED)
  }

  /**
   * 作用：把 Options API 生命周期统一注册到底层 hook 系统。
   */
  function registerLifecycleHook(
    register: Function,
    hook?: Function | Function[],
  ) {
    if (isArray(hook)) {
      hook.forEach(_hook => register(_hook.bind(publicThis)))
    } else if (hook) {
      register(hook.bind(publicThis))
    }
  }

  // 下面这一组调用把 Options API 生命周期全部桥接到 runtime-core 的统一 hook 系统。
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
  registerLifecycleHook(onBeforeUpdate, beforeUpdate)
  registerLifecycleHook(onUpdated, updated)
  registerLifecycleHook(onActivated, activated)
  registerLifecycleHook(onDeactivated, deactivated)
  registerLifecycleHook(onErrorCaptured, errorCaptured)
  registerLifecycleHook(onRenderTracked, renderTracked)
  registerLifecycleHook(onRenderTriggered, renderTriggered)
  registerLifecycleHook(onBeforeUnmount, beforeUnmount)
  registerLifecycleHook(onUnmounted, unmounted)
  registerLifecycleHook(onServerPrefetch, serverPrefetch)

  if (__COMPAT__) {
    if (
      beforeDestroy &&
      softAssertCompatEnabled(DeprecationTypes.OPTIONS_BEFORE_DESTROY, instance)
    ) {
      registerLifecycleHook(onBeforeUnmount, beforeDestroy)
    }
    if (
      destroyed &&
      softAssertCompatEnabled(DeprecationTypes.OPTIONS_DESTROYED, instance)
    ) {
      registerLifecycleHook(onUnmounted, destroyed)
    }
  }

  if (isArray(expose)) {
    if (expose.length) {
      // `exposed` 保存组件通过 `expose` 主动暴露给父组件的公开成员。
      const exposed = instance.exposed || (instance.exposed = {})
      expose.forEach(key => {
        Object.defineProperty(exposed, key, {
          get: () => publicThis[key],
          set: val => (publicThis[key] = val),
          enumerable: true,
        })
      })
    } else if (!instance.exposed) {
      instance.exposed = {}
    }
  }

  // 这些选项在实例创建时已经处理过，但 mixin / extends 合并后还需要再次兜底。
  if (render && instance.render === NOOP) {
    instance.render = render as InternalRenderFunction
  }
  if (inheritAttrs != null) {
    instance.inheritAttrs = inheritAttrs
  }

  // asset options.
  if (components) instance.components = components as any
  if (directives) instance.directives = directives
  if (
    __COMPAT__ &&
    filters &&
    isCompatEnabled(DeprecationTypes.FILTERS, instance)
  ) {
    instance.filters = filters
  }

  if (__SSR__ && serverPrefetch) {
    markAsyncBoundary(instance)
  }
}

export function resolveInjections(
  injectOptions: ComponentInjectOptions,
  ctx: any,
  checkDuplicateProperties = NOOP as any,
): void {
  if (isArray(injectOptions)) {
    injectOptions = normalizeInject(injectOptions)!
  }
  for (const key in injectOptions) {
    const opt = injectOptions[key]
    // `injected` 保存当前 key 最终解析出来的注入值。
    let injected: unknown
    if (isObject(opt)) {
      if ('default' in opt) {
        injected = inject(
          opt.from || key,
          opt.default,
          true /* treat default function as factory */,
        )
      } else {
        injected = inject(opt.from || key)
      }
    } else {
      injected = inject(opt)
    }
    if (isRef(injected)) {
      // 注入值本身是 ref 时，直接在 ctx 上做代理展开，保留双向联动能力。
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => (injected as Ref).value,
        set: v => ((injected as Ref).value = v),
      })
    } else {
      ctx[key] = injected
    }
    if (__DEV__) {
      checkDuplicateProperties!(OptionTypes.INJECT, key)
    }
  }
}

/**
 * 作用：以当前组件代理为 `this` 执行生命周期钩子。
 */
function callHook(
  hook: Function,
  instance: ComponentInternalInstance,
  type: LifecycleHooks,
) {
  callWithAsyncErrorHandling(
    isArray(hook)
      ? hook.map(h => h.bind(instance.proxy!))
      : hook.bind(instance.proxy!),
    instance,
    type,
  )
}

/**
 * 作用：把 `watch` 选项转换成底层 `watch()` 调用。
 *
 * 参数说明：
 * - `raw`：用户声明的 watch 配置，可能是函数、字符串、对象或数组。
 * - `ctx`：组件上下文，字符串 handler 会从这里取方法。
 * - `publicThis`：组件公共实例，getter 和 handler 都需要绑定它。
 * - `key`：当前 watch 对应的表达式或字段名。
 */
export function createWatcher(
  raw: ComponentWatchOptionItem,
  ctx: Data,
  publicThis: ComponentPublicInstance,
  key: string,
): void {
  // `getter` 统一表示当前 watch 的被观察数据来源。
  let getter = key.includes('.')
    ? createPathGetter(publicThis, key)
    : () => publicThis[key as keyof typeof publicThis]

  // `options` 用于兼容模式下补充额外 watch 配置。
  const options: WatchOptions = {}
  if (__COMPAT__) {
    const instance =
      currentInstance && getCurrentScope() === currentInstance.scope
        ? currentInstance
        : null

    const newValue = getter()
    if (
      isArray(newValue) &&
      isCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
    ) {
      options.deep = true
    }

    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (
        isArray(val) &&
        checkCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
      ) {
        traverse(val)
      }
      return val
    }
  }

  if (isString(raw)) {
    const handler = ctx[raw]
    if (isFunction(handler)) {
      if (__COMPAT__) {
        watch(getter, handler as WatchCallback, options)
      } else {
        watch(getter, handler as WatchCallback)
      }
    } else if (__DEV__) {
      warn(`Invalid watch handler specified by key "${raw}"`, handler)
    }
  } else if (isFunction(raw)) {
    if (__COMPAT__) {
      watch(getter, raw.bind(publicThis), options)
    } else {
      watch(getter, raw.bind(publicThis))
    }
  } else if (isObject(raw)) {
    if (isArray(raw)) {
      raw.forEach(r => createWatcher(r, ctx, publicThis, key))
    } else {
      const handler = isFunction(raw.handler)
        ? raw.handler.bind(publicThis)
        : (ctx[raw.handler] as WatchCallback)
      if (isFunction(handler)) {
        watch(getter, handler, __COMPAT__ ? extend(raw, options) : raw)
      } else if (__DEV__) {
        warn(`Invalid watch handler specified by key "${raw.handler}"`, handler)
      }
    }
  } else if (__DEV__) {
    warn(`Invalid watch option: "${key}"`, raw)
  }
}

/**
 * 作用：拿到当前组件最终可执行的 options，并缓存到 appContext 的 optionsCache 中。
 */
export function resolveMergedOptions(
  instance: ComponentInternalInstance,
): MergedComponentOptions {
  const base = instance.type as ComponentOptions
  const { mixins, extends: extendsOptions } = base
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies },
  } = instance.appContext
  // `cached` 用于避免同一组件类型重复做相同的 options 合并。
  const cached = cache.get(base)

  let resolved: MergedComponentOptions

  if (cached) {
    resolved = cached
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    if (
      __COMPAT__ &&
      isCompatEnabled(DeprecationTypes.PRIVATE_APIS, instance)
    ) {
      resolved = extend({}, base) as MergedComponentOptions
      resolved.parent = instance.parent && instance.parent.proxy
      resolved.propsData = instance.vnode.props
    } else {
      resolved = base as MergedComponentOptions
    }
  } else {
    resolved = {}
    if (globalMixins.length) {
      globalMixins.forEach(m =>
        mergeOptions(resolved, m, optionMergeStrategies, true),
      )
    }
    mergeOptions(resolved, base, optionMergeStrategies)
  }
  if (isObject(base)) {
    cache.set(base, resolved)
  }
  return resolved
}

/**
 * 作用：把来源组件的 options 合并进目标对象。
 */
export function mergeOptions(
  to: any,
  from: any,
  strats: Record<string, OptionMergeFunction>,
  asMixin = false,
): any {
  if (__COMPAT__ && isFunction(from)) {
    from = from.options
  }

  const { mixins, extends: extendsOptions } = from

  if (extendsOptions) {
    mergeOptions(to, extendsOptions, strats, true)
  }
  if (mixins) {
    mixins.forEach((m: ComponentOptionsMixin) =>
      mergeOptions(to, m, strats, true),
    )
  }

  for (const key in from) {
    if (asMixin && key === 'expose') {
      __DEV__ &&
        warn(
          `"expose" option is ignored when declared in mixins or extends. ` +
            `It should only be declared in the base component itself.`,
        )
    } else {
      const strat = internalOptionMergeStrats[key] || (strats && strats[key])
      to[key] = strat ? strat(to[key], from[key]) : from[key]
    }
  }
  return to
}

// 这里定义每一种内置 option 的默认合并策略，是 Options API 合并的核心表。
export const internalOptionMergeStrats: Record<string, Function> = {
  data: mergeDataFn,
  props: mergeEmitsOrPropsOptions,
  emits: mergeEmitsOrPropsOptions,
  // objects
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  // lifecycle
  beforeCreate: mergeAsArray,
  created: mergeAsArray,
  beforeMount: mergeAsArray,
  mounted: mergeAsArray,
  beforeUpdate: mergeAsArray,
  updated: mergeAsArray,
  beforeDestroy: mergeAsArray,
  beforeUnmount: mergeAsArray,
  destroyed: mergeAsArray,
  unmounted: mergeAsArray,
  activated: mergeAsArray,
  deactivated: mergeAsArray,
  errorCaptured: mergeAsArray,
  serverPrefetch: mergeAsArray,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  // watch
  watch: mergeWatchOptions,
  // provide / inject
  provide: mergeDataFn,
  inject: mergeInject,
}

if (__COMPAT__) {
  internalOptionMergeStrats.filters = mergeObjectOptions
}

/**
 * 作用：合并 `data` / `provide` 这类既可能是对象也可能是函数的选项。
 */
function mergeDataFn(to: any, from: any) {
  if (!from) {
    return to
  }
  if (!to) {
    return from
  }
  return function mergedDataFn(this: ComponentPublicInstance) {
    return (
      __COMPAT__ && isCompatEnabled(DeprecationTypes.OPTIONS_DATA_MERGE, null)
        ? deepMergeData
        : extend
    )(
      isFunction(to) ? to.call(this, this) : to,
      isFunction(from) ? from.call(this, this) : from,
    )
  }
}

/**
 * 作用：先把 inject 规范化成对象，再走对象合并策略。
 */
function mergeInject(
  to: ComponentInjectOptions | undefined,
  from: ComponentInjectOptions,
) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from))
}

/**
 * 作用：把数组形式的 inject 语法转成对象形式，方便后续统一处理。
 */
function normalizeInject(
  raw: ComponentInjectOptions | undefined,
): ObjectInjectOptions | undefined {
  if (isArray(raw)) {
    const res: ObjectInjectOptions = {}
    for (let i = 0; i < raw.length; i++) {
      res[raw[i]] = raw[i]
    }
    return res
  }
  return raw
}

/**
 * 作用：把生命周期这类“可叠加”选项合并成去重后的数组。
 */
function mergeAsArray<T = Function>(to: T[] | T | undefined, from: T | T[]) {
  return to ? [...new Set([].concat(to as any, from as any))] : from
}

/**
 * 作用：合并对象类 options，并让结果对象不受原型链干扰。
 */
function mergeObjectOptions(to: Object | undefined, from: Object | undefined) {
  return to ? extend(Object.create(null), to, from) : from
}

function mergeEmitsOrPropsOptions(
  to: EmitsOptions | undefined,
  from: EmitsOptions | undefined,
): EmitsOptions | undefined
function mergeEmitsOrPropsOptions(
  to: ComponentPropsOptions | undefined,
  from: ComponentPropsOptions | undefined,
): ComponentPropsOptions | undefined
function mergeEmitsOrPropsOptions(
  to: ComponentPropsOptions | EmitsOptions | undefined,
  from: ComponentPropsOptions | EmitsOptions | undefined,
) {
  if (to) {
    if (isArray(to) && isArray(from)) {
      return [...new Set([...to, ...from])]
    }
    return extend(
      Object.create(null),
      normalizePropsOrEmits(to),
      normalizePropsOrEmits(from ?? {}),
    )
  } else {
    return from
  }
}

function mergeWatchOptions(
  to: ComponentWatchOptions | undefined,
  from: ComponentWatchOptions | undefined,
) {
  if (!to) return from
  if (!from) return to
  const merged = extend(Object.create(null), to)
  for (const key in from) {
    merged[key] = mergeAsArray(to[key], from[key])
  }
  return merged
}

// Deprecated legacy types, kept because they were previously exported ---------

/**
 * @deprecated
 */
export type ComponentOptionsWithoutProps<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  TE extends ComponentTypeEmits = {},
  ResolvedEmits extends EmitsOptions = {} extends E
    ? TypeEmitsToOptions<TE>
    : E,
  PE = Props & EmitsToProps<ResolvedEmits>,
> = ComponentOptionsBase<
  PE,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  {},
  I,
  II,
  S,
  LC,
  Directives,
  Exposed,
  Provide
> & {
  props?: never
  /**
   * @private for language-tools use only
   */
  __typeProps?: Props
  /**
   * @private for language-tools use only
   */
  __typeEmits?: TE
} & ThisType<
    CreateComponentPublicInstanceWithMixins<
      PE,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      ResolvedEmits,
      EE,
      {},
      false,
      I,
      S,
      LC,
      Directives,
      string
    >
  >

/**
 * @deprecated
 */
export type ComponentOptionsWithArrayProps<
  PropNames extends string = string,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  Props = Prettify<Readonly<{ [key in PropNames]?: any } & EmitsToProps<E>>>,
> = ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  {},
  I,
  II,
  S,
  LC,
  Directives,
  Exposed,
  Provide
> & {
  props: PropNames[]
} & ThisType<
    CreateComponentPublicInstanceWithMixins<
      Props,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      Props,
      {},
      false,
      I,
      S,
      LC,
      Directives,
      string
    >
  >

/**
 * @deprecated
 */
export type ComponentOptionsWithObjectProps<
  PropsOptions = ComponentObjectPropsOptions,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  Props = Prettify<
    Readonly<ExtractPropTypes<PropsOptions>> & Readonly<EmitsToProps<E>>
  >,
  Defaults = ExtractDefaultPropTypes<PropsOptions>,
> = ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  Defaults,
  I,
  II,
  S,
  LC,
  Directives,
  Exposed,
  Provide
> & {
  props: PropsOptions & ThisType<void>
} & ThisType<
    CreateComponentPublicInstanceWithMixins<
      Props,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      Props,
      Defaults,
      false,
      I,
      S,
      LC,
      Directives
    >
  >
