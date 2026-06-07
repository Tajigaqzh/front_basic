/**
 * 文件作用：实现组件实例的创建、初始化和 render 安装。
 *
 * 这是 runtime-core 的核心文件之一。
 * 它负责把“组件定义对象”转换成“组件实例”，并串起 props、slots、setup、render、effect。
 *
 * 从渲染主链路看，这份文件主要位于：
 * - `renderer.ts` 发现某个 VNode 是组件
 * - 调用这里创建实例、初始化实例、执行 setup
 * - 再回到渲染器里安装渲染副作用并进入后续 patch
 */

import { type VNode, type VNodeChild, isVNode } from './vnode'
import {
  EffectScope,
  type ReactiveEffect,
  TrackOpTypes,
  isRef,
  markRaw,
  pauseTracking,
  proxyRefs,
  resetTracking,
  shallowReadonly,
  track,
} from '@vue-source/reactivity'
import {
  type ComponentPublicInstance,
  type ComponentPublicInstanceConstructor,
  PublicInstanceProxyHandlers,
  RuntimeCompiledPublicInstanceProxyHandlers,
  createDevRenderContext,
  exposePropsOnRenderContext,
  exposeSetupStateOnRenderContext,
  publicPropertiesMap,
} from './componentPublicInstance'
import {
  type ComponentPropsOptions,
  type NormalizedPropsOptions,
  initProps,
  normalizePropsOptions,
} from './componentProps'
import {
  type InternalSlots,
  type Slots,
  type SlotsType,
  type UnwrapSlotsType,
  initSlots,
} from './componentSlots'
import { warn } from './warning'
import { ErrorCodes, callWithErrorHandling, handleError } from './errorHandling'
import {
  type AppConfig,
  type AppContext,
  createAppContext,
} from './apiCreateApp'
import { type Directive, validateDirectiveName } from './directives'
import {
  type ComponentOptions,
  type ComputedOptions,
  type MergedComponentOptions,
  type MethodOptions,
  applyOptions,
  resolveMergedOptions,
} from './componentOptions'
import {
  type EmitFn,
  type EmitsOptions,
  type EmitsToProps,
  type ObjectEmitsOptions,
  type ShortEmitsToObject,
  emit,
  normalizeEmitsOptions,
} from './componentEmits'
import {
  EMPTY_OBJ,
  type IfAny,
  NOOP,
  ShapeFlags,
  extend,
  getGlobalThis,
  isArray,
  isFunction,
  isObject,
  isPromise,
  makeMap,
} from '@vue-source/shared'
import type { SuspenseBoundary } from './components/Suspense'
import type { CompilerOptions } from '@vue-source/compiler-core'
import { markAttrsAccessed } from './componentRenderUtils'
import { currentRenderingInstance } from './componentRenderContext'
import { endMeasure, startMeasure } from './profiling'
import { convertLegacyRenderFn } from './compat/renderFn'
import {
  type CompatConfig,
  globalCompatConfig,
  validateCompatConfig,
} from './compat/compatConfig'
import type { SchedulerJob } from './scheduler'
import type { LifecycleHooks } from './enums'

// Augment GlobalComponents
import type { TeleportProps } from './components/Teleport'
import type { SuspenseProps } from './components/Suspense'
import type { KeepAliveProps } from './components/KeepAlive'
import type { BaseTransitionProps } from './components/BaseTransition'
import type { DefineComponent } from './apiDefineComponent'
import { markAsyncBoundary } from './helpers/useId'
import { isAsyncWrapper } from './apiAsyncComponent'
import type { RendererElement } from './renderer'

export type Data = Record<string, unknown>

/**
 * 作用：给 TSX 扩展“允许透传到组件上的未声明 attrs”类型入口。
 */
export interface AllowedAttrs {}

export type Attrs = Data & AllowedAttrs

/**
 * Public utility type for extracting the instance type of a component.
 * Works with all valid component definition types. This is intended to replace
 * the usage of `InstanceType<typeof Comp>` which only works for
 * constructor-based component definition types.
 *
 * @example
 * ```ts
 * const MyComp = { ... }
 * declare const instance: ComponentInstance<typeof MyComp>
 * ```
 */
export type ComponentInstance<T> = T extends { new (): ComponentPublicInstance }
  ? InstanceType<T>
  : T extends FunctionalComponent<infer Props, infer Emits>
    ? ComponentPublicInstance<Props, {}, {}, {}, {}, ShortEmitsToObject<Emits>>
    : T extends Component<
          infer PropsOrInstance,
          infer RawBindings,
          infer D,
          infer C,
          infer M
        >
      ? PropsOrInstance extends { $props: unknown }
        ? // T is returned by `defineComponent()`
          PropsOrInstance
        : // NOTE we override Props/RawBindings/D to make sure is not `unknown`
          ComponentPublicInstance<
            unknown extends PropsOrInstance ? {} : PropsOrInstance,
            unknown extends RawBindings ? {} : RawBindings,
            unknown extends D ? {} : D,
            C,
            M
          >
      : never // not a vue Component

/**
 * For extending allowed non-declared props on components in TSX
 */
export interface ComponentCustomProps {}

/**
 * For globally defined Directives
 * Here is an example of adding a directive `VTooltip` as global directive:
 *
 * @example
 * ```ts
 * import VTooltip from 'v-tooltip'
 *
 * declare module '@vue-source/runtime-core' {
 *   interface GlobalDirectives {
 *     VTooltip
 *   }
 * }
 * ```
 */
export interface GlobalDirectives {}

/**
 * For globally defined Components
 * Here is an example of adding a component `RouterView` as global component:
 *
 * @example
 * ```ts
 * import { RouterView } from 'vue-router'
 *
 * declare module '@vue-source/runtime-core' {
 *   interface GlobalComponents {
 *     RouterView
 *   }
 * }
 * ```
 */
export interface GlobalComponents {
  Teleport: DefineComponent<TeleportProps>
  Suspense: DefineComponent<SuspenseProps>
  KeepAlive: DefineComponent<KeepAliveProps>
  BaseTransition: DefineComponent<BaseTransitionProps>
}

/**
 * Default allowed non-declared props on component in TSX
 */
export interface AllowedComponentProps {
  class?: unknown
  style?: unknown
}

// Note: can't mark this whole interface internal because some public interfaces
// extend it.
export interface ComponentInternalOptions {
  /**
   * @internal
   */
  __scopeId?: string
  /**
   * @internal
   */
  __cssModules?: Data
  /**
   * @internal
   */
  __hmrId?: string
  /**
   * Compat build only, for bailing out of certain compatibility behavior
   */
  __isBuiltIn?: boolean
  /**
   * This one should be exposed so that devtools can make use of it
   */
  __file?: string
  /**
   * name inferred from filename
   */
  __name?: string
}

export interface FunctionalComponent<
  P = {},
  E extends EmitsOptions | Record<string, any[]> = {},
  S extends Record<string, any> = any,
  EE extends EmitsOptions = ShortEmitsToObject<E>,
> extends ComponentInternalOptions {
  // use of any here is intentional so it can be a valid JSX Element constructor
  (
    props: P & EmitsToProps<EE>,
    ctx: Omit<SetupContext<EE, IfAny<S, {}, SlotsType<S>>>, 'expose'>,
  ): any
  props?: ComponentPropsOptions<P>
  emits?: EE | (keyof EE)[]
  slots?: IfAny<S, Slots, SlotsType<S>>
  inheritAttrs?: boolean
  displayName?: string
  compatConfig?: CompatConfig
}

export interface ClassComponent {
  new (...args: any[]): ComponentPublicInstance<any, any, any, any, any>
  __vccOpts: ComponentOptions
}

/**
 * Concrete component type matches its actual value: it's either an options
 * object, or a function. Use this where the code expects to work with actual
 * values, e.g. checking if its a function or not. This is mostly for internal
 * implementation code.
 */
export type ConcreteComponent<
  Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  E extends EmitsOptions | Record<string, any[]> = {},
  S extends Record<string, any> = any,
> =
  | ComponentOptions<Props, RawBindings, D, C, M>
  | FunctionalComponent<Props, E, S>

/**
 * A type used in public APIs where a component type is expected.
 * The constructor type is an artificial type returned by defineComponent().
 */
export type Component<
  PropsOrInstance = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  E extends EmitsOptions | Record<string, any[]> = {},
  S extends Record<string, any> = any,
> =
  | ConcreteComponent<PropsOrInstance, RawBindings, D, C, M, E, S>
  | ComponentPublicInstanceConstructor<PropsOrInstance>

export type { ComponentOptions }

export type LifecycleHook<TFn = Function> = (TFn & SchedulerJob)[] | null

// use `E extends any` to force evaluating type to fix #2362
export type SetupContext<
  E = EmitsOptions,
  S extends SlotsType = {},
> = E extends any
  ? {
      attrs: Attrs
      slots: UnwrapSlotsType<S>
      emit: EmitFn<E>
      expose: <Exposed extends Record<string, any> = Record<string, any>>(
        exposed?: Exposed,
      ) => void
    }
  : never

/**
 * @internal
 */
export type InternalRenderFunction = {
  (
    ctx: ComponentPublicInstance,
    cache: ComponentInternalInstance['renderCache'],
    // for compiler-optimized bindings
    $props: ComponentInternalInstance['props'],
    $setup: ComponentInternalInstance['setupState'],
    $data: ComponentInternalInstance['data'],
    $options: ComponentInternalInstance['ctx'],
  ): VNodeChild
  _rc?: boolean // isRuntimeCompiled

  // __COMPAT__ only
  _compatChecked?: boolean // v3 and already checked for v2 compat
  _compatWrapped?: boolean // is wrapped for v2 compat
}

/**
 * We expose a subset of properties on the internal instance as they are
 * useful for advanced external libraries and tools.
 */
export interface ComponentInternalInstance {
  uid: number
  type: ConcreteComponent
  parent: ComponentInternalInstance | null
  root: ComponentInternalInstance
  appContext: AppContext
  /**
   * Vnode representing this component in its parent's vdom tree
   */
  vnode: VNode
  /**
   * The pending new vnode from parent updates
   * @internal
   */
  next: VNode | null
  /**
   * Root vnode of this component's own vdom tree
   */
  subTree: VNode
  /**
   * Render effect instance
   */
  effect: ReactiveEffect
  /**
   * Force update render effect
   */
  update: () => void
  /**
   * Render effect job to be passed to scheduler (checks if dirty)
   */
  job: SchedulerJob
  /**
   * The render function that returns vdom tree.
   * @internal
   */
  render: InternalRenderFunction | null
  /**
   * SSR render function
   * @internal
   */
  ssrRender?: Function | null
  /**
   * Object containing values this component provides for its descendants
   * @internal
   */
  provides: Data
  /**
   * for tracking useId()
   * first element is the current boundary prefix
   * second number is the index of the useId call within that boundary
   * @internal
   */
  ids: [string, number, number]
  /**
   * Tracking reactive effects (e.g. watchers) associated with this component
   * so that they can be automatically stopped on component unmount
   * @internal
   */
  scope: EffectScope
  /**
   * cache for proxy access type to avoid hasOwnProperty calls
   * @internal
   */
  accessCache: Data | null
  /**
   * cache for render function values that rely on _ctx but won't need updates
   * after initialized (e.g. inline handlers)
   * @internal
   */
  renderCache: (Function | VNode | undefined)[]

  /**
   * Resolved component registry, only for components with mixins or extends
   * @internal
   */
  components: Record<string, ConcreteComponent> | null
  /**
   * Resolved directive registry, only for components with mixins or extends
   * @internal
   */
  directives: Record<string, Directive> | null
  /**
   * Resolved filters registry, v2 compat only
   * @internal
   */
  filters?: Record<string, Function>
  /**
   * resolved props options
   * @internal
   */
  propsOptions: NormalizedPropsOptions
  /**
   * resolved emits options
   * @internal
   */
  emitsOptions: ObjectEmitsOptions | null
  /**
   * resolved inheritAttrs options
   * @internal
   */
  inheritAttrs?: boolean
  /**
   * Custom Element instance (if component is created by defineCustomElement)
   * @internal
   */
  ce?: ComponentCustomElementInterface
  /**
   * is custom element? (kept only for compatibility)
   * @internal
   */
  isCE?: boolean
  /**
   * custom element specific HMR method
   * @internal
   */
  ceReload?: (newStyles?: string[]) => void

  // the rest are only for stateful components ---------------------------------

  // main proxy that serves as the public instance (`this`)
  proxy: ComponentPublicInstance | null

  // exposed properties via expose()
  exposed: Record<string, any> | null
  exposeProxy: Record<string, any> | null

  /**
   * alternative proxy used only for runtime-compiled render functions using
   * `with` block
   * @internal
   */
  withProxy: ComponentPublicInstance | null
  /**
   * This is the target for the public instance proxy. It also holds properties
   * injected by user options (computed, methods etc.) and user-attached
   * custom properties (via `this.x = ...`)
   * @internal
   */
  ctx: Data

  // state
  data: Data
  props: Data
  attrs: Data
  slots: InternalSlots
  refs: Data
  emit: EmitFn

  /**
   * used for keeping track of .once event handlers on components
   * @internal
   */
  emitted: Record<string, boolean> | null
  /**
   * used for caching the value returned from props default factory functions to
   * avoid unnecessary watcher trigger
   * @internal
   */
  propsDefaults: Data
  /**
   * setup related
   * @internal
   */
  setupState: Data
  /**
   * devtools access to additional info
   * @internal
   */
  devtoolsRawSetupState?: any
  /**
   * @internal
   */
  setupContext: SetupContext | null

  /**
   * suspense related
   * @internal
   */
  suspense: SuspenseBoundary | null
  /**
   * suspense pending batch id
   * @internal
   */
  suspenseId: number
  /**
   * @internal
   */
  asyncDep: Promise<any> | null
  /**
   * @internal
   */
  asyncResolved: boolean

  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_CREATE]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.CREATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.MOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.UPDATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.RENDER_TRACKED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.RENDER_TRIGGERED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.ACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.DEACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.ERROR_CAPTURED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.SERVER_PREFETCH]: LifecycleHook<() => Promise<unknown>>

  /**
   * For caching bound $forceUpdate on public proxy access
   * @internal
   */
  f?: () => void
  /**
   * For caching bound $nextTick on public proxy access
   * @internal
   */
  n?: () => Promise<void>
  /**
   * `updateTeleportCssVars`
   * For updating css vars on contained teleports
   * @internal
   */
  ut?: (vars?: Record<string, unknown>) => void

  /**
   * dev only. For style v-bind hydration mismatch checks
   * @internal
   */
  getCssVars?: () => Record<string, unknown>

  /**
   * v2 compat only, for caching mutated $options
   * @internal
   */
  resolvedOptions?: MergedComponentOptions
}

const emptyAppContext = createAppContext()

let uid = 0

/**
 * 创建组件实例对象。
 *
 * 主要功能：
 * - 把“组件定义 + 父子关系 + 应用上下文”组装成一份真正可运行的实例
 * - 为 props、slots、setupState、effect、subTree 等运行时状态预留存储位置
 *
 * 参数：
 * - `vnode`：当前组件对应的组件 VNode，是实例创建的直接输入
 * - `parent`：父组件实例；根组件时为 `null`
 * - `suspense`：当前组件所属的 Suspense 边界；不在 Suspense 中时为 `null`
 *
 * 返回值：
 * - 返回完整的 `ComponentInternalInstance`
 *
 * 依赖：
 * - `normalizePropsOptions()`：预解析组件 props 选项
 * - `normalizeEmitsOptions()`：预解析组件 emits 选项
 * - `createAppContext()`：根组件没有父级上下文时会回退到空应用上下文
 */
export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  suspense: SuspenseBoundary | null,
): ComponentInternalInstance {
  // 组件定义对象只是“静态描述”，真正参与运行时调度的是组件实例。
  // renderer 识别到组件 vnode 后，会先在这里把它转换成实例，
  // 后面所有 props / setup / render / effect / lifecycle 都围绕这份实例继续推进。
  const type = vnode.type as ConcreteComponent
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext

  /**
   * 组件实例本体。
   *
   * 字段含义可以粗略分为 6 组：
   * - 身份信息：`uid / vnode / type / parent / root`
   * - 渲染相关：`subTree / render / effect / update / job`
   * - 依赖与上下文：`appContext / provides / scope`
   * - 输入输出：`props / attrs / slots / emit`
   * - 组件内部状态：`data / setupState / refs / accessCache`
   * - 生命周期与异步能力：`isMounted / suspense / 各类 hook 容器`
   */
  const instance: ComponentInternalInstance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null!, // to be immediately set
    next: null,
    subTree: null!, // will be set synchronously right after creation
    effect: null!,
    update: null!, // will be set synchronously right after creation
    job: null!,
    scope: new EffectScope(true /* detached */),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,

    provides: parent ? parent.provides : Object.create(appContext.provides),
    ids: parent ? parent.ids : ['', 0, 0],
    accessCache: null!,
    renderCache: [],

    // local resolved assets
    components: null,
    directives: null,

    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),

    // emit
    emit: null!, // to be set immediately
    emitted: null,

    // props default value
    propsDefaults: EMPTY_OBJ,

    // inheritAttrs
    inheritAttrs: type.inheritAttrs,

    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,

    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,

    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null,
  }
  if (__DEV__) {
    instance.ctx = createDevRenderContext(instance)
  } else {
    instance.ctx = { _: instance }
  }
  instance.root = parent ? parent.root : instance
  instance.emit = emit.bind(null, instance)

  // apply custom element special handling
  if (vnode.ce) {
    vnode.ce(instance)
  }

  return instance
}

export let currentInstance: ComponentInternalInstance | null = null

/**
 * 读取当前活跃组件实例。
 *
 * 作用：
 * - 优先返回 `setup()` / 生命周期执行期间设置的 `currentInstance`
 * - 如果当前处于 render 过程中，则退回到 `currentRenderingInstance`
 */
export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance
// 这里把 render 阶段的 `currentRenderingInstance` 也纳入兜底，
// 是为了让某些 helper 在函数式组件 / 渲染上下文里仍能读到“当前组件”。

let internalSetCurrentInstance: (
  instance: ComponentInternalInstance | null,
) => void
export let setInSSRSetupState: (state: boolean) => void

/**
 * The following makes getCurrentInstance() usage across multiple copies of Vue
 * work. Some cases of how this can happen are summarized in #7590. In principle
 * the duplication should be avoided, but in practice there are often cases
 * where the user is unable to resolve on their own, especially in complicated
 * SSR setups.
 *
 * Note this fix is technically incomplete, as we still rely on other singletons
 * for effectScope and global reactive dependency maps. However, it does make
 * some of the most common cases work. It also warns if the duplication is
 * found during browser execution.
 */
if (__SSR__) {
  type Setter = (v: any) => void
  const g = getGlobalThis()
  const registerGlobalSetter = (key: string, setter: Setter) => {
    let setters: Setter[]
    if (!(setters = g[key])) setters = g[key] = []
    setters.push(setter)
    return (v: any) => {
      // 多份 Vue runtime 并存时，要把 currentInstance / SSR setup 状态同步广播给所有副本。
      if (setters.length > 1) setters.forEach(set => set(v))
      else setters[0](v)
    }
  }
  internalSetCurrentInstance = registerGlobalSetter(
    `__VUE_INSTANCE_SETTERS__`,
    v => (currentInstance = v),
  )
  // also make `isInSSRComponentSetup` sharable across copies of Vue.
  // this is needed in the SFC playground when SSRing async components, since
  // we have to load both the runtime and the server-renderer from CDNs, they
  // contain duplicated copies of Vue runtime code.
  setInSSRSetupState = registerGlobalSetter(
    `__VUE_SSR_SETTERS__`,
    v => (isInSSRComponentSetup = v),
  )
} else {
  internalSetCurrentInstance = i => {
    currentInstance = i
  }
  setInSSRSetupState = v => {
    isInSSRComponentSetup = v
  }
}

export const setCurrentInstance = (instance: ComponentInternalInstance) => {
  const prev = currentInstance
  internalSetCurrentInstance(instance)
  // 打开当前组件 effect scope，保证 setup / 生命周期里创建的副作用都归属到这个实例。
  instance.scope.on()
  return (): void => {
    // 返回恢复函数而不是单独暴露 prev，便于外层用 try/finally 成对还原上下文。
    instance.scope.off()
    internalSetCurrentInstance(prev)
  }
}

export const unsetCurrentInstance = (): void => {
  // 异步边界或 setup 结束后要显式清空 currentInstance，避免泄漏到后续用户代码微任务里。
  currentInstance && currentInstance.scope.off()
  internalSetCurrentInstance(null)
}

const isBuiltInTag = /*@__PURE__*/ makeMap('slot,component')

export function validateComponentName(
  name: string,
  { isNativeTag }: AppConfig,
): void {
  // 组件名若撞上内置标签或宿主原生标签，会让模板解析阶段出现“到底是组件还是原生元素”的歧义。
  if (isBuiltInTag(name) || isNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name,
    )
  }
}

export function isStatefulComponent(
  instance: ComponentInternalInstance,
): number {
  // 这里直接复用 vnode.shapeFlag，避免每次再去根据组件定义类型重新判断。
  return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
}

export let isInSSRComponentSetup = false

export function setupComponent(
  instance: ComponentInternalInstance,
  isSSR = false,
  optimized = false,
): Promise<void> | undefined {
  /**
   * 组件初始化总入口。
   *
   * 主要功能：
   * - 初始化 props
   * - 初始化 slots
   * - 如果是有状态组件，则继续执行 `setupStatefulComponent()`
   *
   * 参数：
   * - `instance`：当前待初始化的组件实例
   * - `isSSR`：是否处于服务端渲染初始化阶段
   * - `optimized`：是否允许基于编译优化结果走更快初始化路径
   *
   * 所在链路：
   * - `renderer.ts -> mountComponent / updateComponent`
   * - 渲染器创建好实例后，会先进入这里把组件运行前置状态补齐
   */
  isSSR && setInSSRSetupState(isSSR)

  const { props, children } = instance.vnode
  const isStateful = isStatefulComponent(instance)
  // setup 之前先把“输入面”固定下来：
  // - props 解决组件从父级接收了什么
  // - slots 解决组件拿到了什么子内容
  //
  // 只有这两步完成，setup/render 才能在稳定实例视图上运行。
  initProps(instance, props, isStateful, isSSR)
  initSlots(instance, children, optimized || isSSR)

  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined

  isSSR && setInSSRSetupState(false)
  return setupResult
}

function setupStatefulComponent(
  instance: ComponentInternalInstance,
  isSSR: boolean,
) {
  /**
   * 有状态组件初始化入口。
   *
   * 主要功能：
   * - 校验组件定义
   * - 创建组件代理 `proxy`
   * - 执行用户编写的 `setup()`
   * - 处理同步 / 异步 setup 返回值
   *
   * 依赖：
   * - `PublicInstanceProxyHandlers`：实现模板 / render 中的 `this.xxx` 访问
   * - `createSetupContext()`：给 setup 暴露 attrs / slots / emit / expose
   * - `handleSetupResult()`：承接 setup 返回值并继续完成 render 安装
   */
  const Component = instance.type as ComponentOptions

  if (__DEV__) {
    if (Component.name) {
      validateComponentName(Component.name, instance.appContext.config)
    }
    if (Component.components) {
      const names = Object.keys(Component.components)
      for (let i = 0; i < names.length; i++) {
        validateComponentName(names[i], instance.appContext.config)
      }
    }
    if (Component.directives) {
      const names = Object.keys(Component.directives)
      for (let i = 0; i < names.length; i++) {
        validateDirectiveName(names[i])
      }
    }
    if (Component.compilerOptions && isRuntimeOnly()) {
      warn(
        `"compilerOptions" is only supported when using a build of Vue that ` +
          `includes the runtime compiler. Since you are using a runtime-only ` +
          `build, the options should be passed via your build tool config instead.`,
      )
    }
  }
  // `accessCache` 用来缓存运行时 public proxy 的取值命中路径，减少多次访问时的分支判断成本。
  instance.accessCache = Object.create(null)
  // `proxy` 是模板 / render 执行时最常用的公开代理对象，this.xxx 基本都会落到这里。
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  if (__DEV__) {
    exposePropsOnRenderContext(instance)
  }
  // 进入用户定义的 setup()。这一步是组合式 API 的核心接入点。
  const { setup } = Component
  if (setup) {
    pauseTracking()
    // 只有 setup 显式声明第二个参数时，才延迟创建 setupContext，避免无意义对象分配。
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)
    const reset = setCurrentInstance(instance)
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [
        __DEV__ ? shallowReadonly(instance.props) : instance.props,
        setupContext,
      ],
    )
    // `isAsyncSetup` 用来区分“当前组件能否立刻继续 mount”。
    // 一旦 setup 返回 Promise，非 SSR 场景下就要把控制权交给 Suspense / 异步恢复逻辑。
    const isAsyncSetup = isPromise(setupResult)
    resetTracking()
    reset()

    if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
      // async setup / serverPrefetch, mark as async boundary for useId()
      markAsyncBoundary(instance)
    }

    if (isAsyncSetup) {
      setupResult.then(unsetCurrentInstance, unsetCurrentInstance)
      if (isSSR) {
        // return the promise so server-renderer can wait on it
        return setupResult
          .then((resolvedResult: unknown) => {
            // SSR 必须等异步 setup resolve 后再继续，否则拿不到完整渲染上下文。
            handleSetupResult(instance, resolvedResult, isSSR)
          })
          .catch(e => {
            handleError(e, instance, ErrorCodes.SETUP_FUNCTION)
          })
      } else if (__FEATURE_SUSPENSE__) {
        // async setup returned Promise.
        // bail here and wait for re-entry.
        // 客户端异步 setup 的真正渲染恢复要交给 Suspense，在这里先记住 Promise 即可。
        instance.asyncDep = setupResult
        if (__DEV__ && !instance.suspense) {
          const name = formatComponentName(instance, Component)
          warn(
            `Component <${name}>: setup function returned a promise, but no ` +
              `<Suspense> boundary was found in the parent component tree. ` +
              `A component with async setup() must be nested in a <Suspense> ` +
              `in order to be rendered.`,
          )
        }
      } else if (__DEV__) {
        warn(
          `setup() returned a Promise, but the version of Vue you are using ` +
            `does not support it yet.`,
        )
      }
    } else {
      handleSetupResult(instance, setupResult, isSSR)
    }
  } else {
    finishComponentSetup(instance, isSSR)
  }
}

export function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown,
  isSSR: boolean,
): void {
  // setup 的返回值最终只会汇总成两种运行时语义：
  // - 返回函数：直接当作组件 render
  // - 返回对象：暴露为 setupState，供模板/this 读取
  //
  // 无论走哪条分支，最后都会进入 finishComponentSetup，
  // 保证实例拥有完整 render 能力。
  /**
   * 处理 `setup()` 的返回值。
   *
   * 主要功能：
   * - 返回函数：把它当作组件 render
   * - 返回对象：把它当作 setupState，并自动解包 ref
   * - 其余返回值：开发期给出告警
   *
   * 所在链路：
   * - `setupStatefulComponent()` 执行完 setup 后会进入这里
   * - 这里处理完成后会统一进入 `finishComponentSetup()`
   */
  if (isFunction(setupResult)) {
    // setup returned an inline render function
    if (__SSR__ && (instance.type as ComponentOptions).__ssrInlineRender) {
      // when the function's name is `ssrRender` (compiled by SFC inline mode),
      // set it as ssrRender instead.
      instance.ssrRender = setupResult
    } else {
      instance.render = setupResult as InternalRenderFunction
    }
  } else if (isObject(setupResult)) {
    if (__DEV__ && isVNode(setupResult)) {
      warn(
        `setup() should not return VNodes directly - ` +
          `return a render function instead.`,
      )
    }
    // setup returned bindings.
    // assuming a render function compiled from template is present.
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      instance.devtoolsRawSetupState = setupResult
    }
    instance.setupState = proxyRefs(setupResult)
    if (__DEV__) {
      exposeSetupStateOnRenderContext(instance)
    }
  } else if (__DEV__ && setupResult !== undefined) {
    warn(
      `setup() should return an object. Received: ${
        setupResult === null ? 'null' : typeof setupResult
      }`,
    )
  }
  finishComponentSetup(instance, isSSR)
}

type CompileFunction = (
  template: string | object,
  options?: CompilerOptions,
) => InternalRenderFunction

let compile: CompileFunction | undefined
let installWithProxy: (i: ComponentInternalInstance) => void

/**
 * For runtime-dom to register the compiler.
 * Note the exported method uses any to avoid d.ts relying on the compiler types.
 */
export function registerRuntimeCompiler(_compile: any): void {
  compile = _compile
  installWithProxy = i => {
    if (i.render!._rc) {
      // 运行时编译得到的 render 使用 `with` 作用域，需要专门的 proxy `has/get` 语义。
      i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers)
    }
  }
}

// dev only
export const isRuntimeOnly = (): boolean => !compile

export function finishComponentSetup(
  instance: ComponentInternalInstance,
  isSSR: boolean,
  skipOptions?: boolean,
): void {
  /**
   * 完成组件初始化的收尾工作。
   *
   * 主要功能：
   * - 归一化 render / template
   * - 必要时运行运行时编译器把 template 编译成 render
   * - 执行 Options API 选项合并后的初始化逻辑
   *
   * 参数：
   * - `instance`：当前组件实例
   * - `isSSR`：是否为 SSR 初始化
   * - `skipOptions`：兼容模式下是否跳过 Options API 处理
   *
   * 所在链路：
   * - `setup()` 返回值处理完后，最终都会进入这里
   * - 到这里之后，组件实例才真正具备后续 `renderComponentRoot()` 所需能力
   */
  const Component = instance.type as ComponentOptions

  if (__COMPAT__) {
    convertLegacyRenderFn(instance)

    if (__DEV__ && Component.compatConfig) {
      validateCompatConfig(Component.compatConfig)
    }
  }

  // 这里统一保证实例最终一定能拿到 `instance.render`。
  // 它可能来自：
  // - setup 返回的内联 render
  // - 组件选项上的 render
  // - template 经过运行时编译生成的 render
  if (!instance.render) {
    // only do on-the-fly compile if not in SSR - SSR on-the-fly compilation
    // is done by server-renderer
    if (!isSSR && compile && !Component.render) {
      const template =
        (__COMPAT__ &&
          instance.vnode.props &&
          instance.vnode.props['inline-template']) ||
        Component.template ||
        (__FEATURE_OPTIONS_API__ && resolveMergedOptions(instance).template)
      if (template) {
        if (__DEV__) {
          startMeasure(instance, `compile`)
        }
        const { isCustomElement, compilerOptions } = instance.appContext.config
        const { delimiters, compilerOptions: componentCompilerOptions } =
          Component
        const finalCompilerOptions: CompilerOptions = extend(
          extend(
            {
              isCustomElement,
              delimiters,
            },
            compilerOptions,
          ),
          componentCompilerOptions,
        )
        // 最终编译配置会合并 app 级与组件级 compilerOptions，后者优先级更高。
        if (__COMPAT__) {
          // pass runtime compat config into the compiler
          finalCompilerOptions.compatConfig = Object.create(globalCompatConfig)
          if (Component.compatConfig) {
            // @ts-ignore types are not compatible
            extend(finalCompilerOptions.compatConfig, Component.compatConfig)
          }
        }
        Component.render = compile(template, finalCompilerOptions)
        if (__DEV__) {
          endMeasure(instance, `compile`)
        }
      }
    }

    instance.render = (Component.render || NOOP) as InternalRenderFunction

    // for runtime-compiled render functions using `with` blocks, the render
    // proxy used needs a different `has` handler which is more performant and
    // also only allows a whitelist of globals to fallthrough.
    if (installWithProxy) {
      installWithProxy(instance)
    }
  }

  // support for 2.x options
  if (__FEATURE_OPTIONS_API__ && !(__COMPAT__ && skipOptions)) {
    const reset = setCurrentInstance(instance)
    pauseTracking()
    try {
      applyOptions(instance)
    } finally {
      resetTracking()
      reset()
    }
  }

  // warn missing template/render
  // the runtime compilation of template in SSR is done by server-render
  if (__DEV__ && !Component.render && instance.render === NOOP && !isSSR) {
    if (!compile && Component.template) {
      /* v8 ignore start */
      warn(
        `Component provided template option but ` +
          `runtime compilation is not supported in this build of Vue.` +
          (__ESM_BUNDLER__
            ? ` Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
            : __ESM_BROWSER__
              ? ` Use "vue.esm-browser.js" instead.`
              : __GLOBAL__
                ? ` Use "vue.global.js" instead.`
                : ``) /* should not happen */,
      )
      /* v8 ignore stop */
    } else {
      warn(`Component is missing template or render function: `, Component)
    }
  }
}

const attrsProxyHandlers = __DEV__
  ? {
      get(target: Data, key: string) {
        markAttrsAccessed()
        track(target, TrackOpTypes.GET, '')
        return target[key]
      },
      set() {
        warn(`setupContext.attrs is readonly.`)
        return false
      },
      deleteProperty() {
        warn(`setupContext.attrs is readonly.`)
        return false
      },
    }
  : {
      get(target: Data, key: string) {
        track(target, TrackOpTypes.GET, '')
        return target[key]
      },
    }

/**
 * Dev-only
 */
function getSlotsProxy(instance: ComponentInternalInstance): Slots {
  return new Proxy(instance.slots, {
    get(target, key: string) {
      track(instance, TrackOpTypes.GET, '$slots')
      return target[key]
    },
  })
}

export function createSetupContext(
  instance: ComponentInternalInstance,
): SetupContext {
  /**
   * 创建传给 `setup(props, context)` 的第二个参数。
   *
   * 主要功能：
   * - 暴露 `attrs`
   * - 暴露 `slots`
   * - 暴露 `emit`
   * - 暴露 `expose`
   *
   * 依赖：
   * - `attrsProxyHandlers`：拦截 attrs 读取并建立依赖
   * - `getSlotsProxy()`：在开发期追踪 `$slots` 访问
   */
  const expose: SetupContext['expose'] = exposed => {
    if (__DEV__) {
      if (instance.exposed) {
        warn(`expose() should be called only once per setup().`)
      }
      if (exposed != null) {
        let exposedType: string = typeof exposed
        if (exposedType === 'object') {
          if (isArray(exposed)) {
            exposedType = 'array'
          } else if (isRef(exposed)) {
            exposedType = 'ref'
          }
        }
        if (exposedType !== 'object') {
          warn(
            `expose() should be passed a plain object, received ${exposedType}.`,
          )
        }
      }
    }
    instance.exposed = exposed || {}
  }

  if (__DEV__) {
    // We use getters in dev in case libs like test-utils overwrite instance
    // properties (overwrites should not be done in prod)
    let attrsProxy: Attrs
    let slotsProxy: Slots
    return Object.freeze({
      get attrs() {
        return (
          attrsProxy ||
          // attrs proxy 要延迟创建，避免 setup 从未访问 attrs 时也平白多一层代理对象。
          (attrsProxy = new Proxy(instance.attrs, attrsProxyHandlers) as Attrs)
        )
      },
      get slots() {
        // slots 同样按需创建代理，开发期用于更精细地追踪访问与给出调试行为。
        return slotsProxy || (slotsProxy = getSlotsProxy(instance))
      },
      get emit() {
        return (event: string, ...args: any[]) => instance.emit(event, ...args)
      },
      expose,
    })
  } else {
    return {
      attrs: new Proxy(instance.attrs, attrsProxyHandlers) as Attrs,
      slots: instance.slots,
      emit: instance.emit,
      expose,
    }
  }
}

export function getComponentPublicInstance(
  instance: ComponentInternalInstance,
): ComponentPublicInstance | ComponentInternalInstance['exposed'] | null {
  /**
   * 读取组件对外暴露的公开实例。
   *
   * 优先级：
   * - 若组件显式 `expose()` 过，则返回 expose proxy
   * - 否则返回标准 public proxy
   */
  /**
   * 返回“外部可见”的组件实例对象。
   *
   * 主要功能：
   * - 如果组件调用过 `expose()`，优先返回 expose 结果代理
   * - 否则返回默认的组件 public proxy
   *
   * 为什么需要这层：
   * - 组件内部实例字段很多是运行时私有状态，不能直接全部暴露给模板 ref / 父组件
   * - expose 机制允许组件显式控制外部能访问哪些能力
   */
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key: string) {
          if (key in target) {
            return target[key]
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance)
          }
        },
        has(target, key: string) {
          return key in target || key in publicPropertiesMap
        },
      }))
    )
  } else {
    return instance.proxy
  }
}

const classifyRE = /(?:^|[-_])\w/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

export function getComponentName(
  Component: ConcreteComponent,
  includeInferred = true,
): string | false | undefined {
  /**
   * 读取组件名。
   *
   * 取值顺序：
   * - 函数组件优先用 `displayName / name`
   * - 对象组件用 `name`
   * - 允许时再退回到编译阶段推断出的 `__name`
   */
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name || (includeInferred && Component.__name)
}

export function formatComponentName(
  instance: ComponentInternalInstance | null,
  Component: ConcreteComponent,
  isRoot = false,
): string {
  /**
   * 格式化组件名，主要用于报错、警告、调试信息。
   *
   * 主要功能：
   * - 尽量从组件自身、文件名、注册表反推可读名称
   * - 最终把 kebab / snake 风格统一转成首字母大写形式
   * - 如果仍然推不出来，则根组件返回 `App`，其他组件返回 `Anonymous`
   */
  let name = getComponentName(Component)
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/)
    if (match) {
      name = match[1]
    }
  }

  if (!name && instance) {
    // try to infer the name based on reverse resolution
    const inferFromRegistry = (
      registry: Record<string, any> | undefined | null,
    ) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key
        }
      }
    }
    name =
      inferFromRegistry(instance.components) ||
      (instance.parent &&
        inferFromRegistry(
          (instance.parent.type as ComponentOptions).components,
        )) ||
      inferFromRegistry(instance.appContext.components)
  }

  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}

export function isClassComponent(value: unknown): value is ClassComponent {
  return isFunction(value) && '__vccOpts' in value
}

export interface ComponentCustomElementInterface {
  /**
   * @internal
   */
  _isVueCE: boolean
  /**
   * @internal
   */
  _injectChildStyle(type: ConcreteComponent, parent?: ConcreteComponent): void
  /**
   * @internal
   */
  _removeChildStyle(type: ConcreteComponent): void
  /**
   * @internal
   */
  _setProp(
    key: string,
    val: any,
    shouldReflect?: boolean,
    shouldUpdate?: boolean,
  ): void
  /**
   * @internal
   */
  _beginPatch(): void
  /**
   * @internal
   */
  _endPatch(): void
  /**
   * @internal attached by the nested Teleport when shadowRoot is false.
   */
  _teleportTargets?: Set<RendererElement>
  /**
   * @internal check if shadow root is enabled
   */
  _hasShadowRoot(): boolean
}
