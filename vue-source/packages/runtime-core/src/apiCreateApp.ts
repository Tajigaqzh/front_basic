/**
 * 文件作用：实现应用级入口 API。
 *
 * 这份文件负责创建 `app` 对象，以及 `app.use`、`app.mount`、`app.provide`
 * 等应用级能力，是组件树进入渲染器之前的最高层入口。
 *
 * 从整体链路看：
 * - 用户先 `createApp(rootComponent)`
 * - 这里生成应用实例与应用上下文
 * - 后续再由 `app.mount()` 把根组件包装成 VNode 并交给渲染器
 */

import {
  type Component,
  type ComponentInternalInstance,
  type ConcreteComponent,
  type Data,
  getComponentPublicInstance,
  validateComponentName,
} from './component'
import type {
  ComponentOptions,
  MergedComponentOptions,
  RuntimeCompilerOptions,
} from './componentOptions'
import type {
  ComponentCustomProperties,
  ComponentPublicInstance,
} from './componentPublicInstance'
import { type Directive, validateDirectiveName } from './directives'
import type { ElementNamespace, RootRenderFunction } from './renderer'
import type { InjectionKey } from './apiInject'
import { type VNode, cloneVNode, createVNode } from './vnode'
import type { RootHydrateFunction } from './hydration'
import { devtoolsInitApp, devtoolsUnmountApp } from './devtools'
import { NO, extend, hasOwn, isFunction, isObject } from '@vue-source/shared'
import { version } from '.'
import { installAppCompatProperties } from './compat/global'
import type { NormalizedPropsOptions } from './componentProps'
import type { ObjectEmitsOptions } from './componentEmits'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import type { DefineComponent } from './apiDefineComponent'

export interface App<HostElement = any> {
  version: string
  config: AppConfig

  use<Options extends unknown[]>(
    plugin: Plugin<Options>,
    ...options: NoInfer<Options>
  ): this
  use<Options>(plugin: Plugin<Options>, options: NoInfer<Options>): this

  mixin(mixin: ComponentOptions): this
  component(name: string): Component | undefined
  component<T extends Component | DefineComponent>(
    name: string,
    component: T,
  ): this
  directive<
    HostElement = any,
    Value = any,
    Modifiers extends string = string,
    Arg = any,
  >(
    name: string,
  ): Directive<HostElement, Value, Modifiers, Arg> | undefined
  directive<
    HostElement = any,
    Value = any,
    Modifiers extends string = string,
    Arg = any,
  >(
    name: string,
    directive: Directive<HostElement, Value, Modifiers, Arg>,
  ): this
  mount(
    rootContainer: HostElement | string,
    /**
     * @internal
     */
    isHydrate?: boolean,
    /**
     * @internal
     */
    namespace?: boolean | ElementNamespace,
    /**
     * @internal
     */
    vnode?: VNode,
  ): ComponentPublicInstance
  unmount(): void
  onUnmount(cb: () => void): void
  provide<T, K = InjectionKey<T> | string | number>(
    key: K,
    value: K extends InjectionKey<infer V> ? V : T,
  ): this

  /**
   * 作用：临时把当前 app 设为活动应用上下文，再执行传入函数。
   *
   * 这样函数内部即便不在组件实例里，也可以通过 `inject()` 读取 `app.provide()` 提供的值。
   */
  runWithContext<T>(fn: () => T): T

  // internal, but we need to expose these for the server-renderer and devtools
  _uid: number
  _component: ConcreteComponent
  _props: Data | null
  _container: HostElement | null
  _context: AppContext
  _instance: ComponentInternalInstance | null

  /**
   * @internal custom element vnode
   */
  _ceVNode?: VNode

  /**
   * v2 compat only
   */
  filter?(name: string): Function | undefined
  filter?(name: string, filter: Function): this

  /**
   * @internal v3 compat only
   */
  _createRoot?(options: ComponentOptions): ComponentPublicInstance
}

export type OptionMergeFunction = (to: unknown, from: unknown) => any

export interface AppConfig {
  // @private
  readonly isNativeTag: (tag: string) => boolean

  performance: boolean
  optionMergeStrategies: Record<string, OptionMergeFunction>
  globalProperties: ComponentCustomProperties & Record<string, any>
  errorHandler?: (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string,
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentPublicInstance | null,
    trace: string,
  ) => void

  /**
   * Options to pass to `@vue-source/compiler-dom`.
   * Only supported in runtime compiler build.
   */
  compilerOptions: RuntimeCompilerOptions

  /**
   * @deprecated use config.compilerOptions.isCustomElement
   */
  isCustomElement?: (tag: string) => boolean

  /**
   * TODO document for 3.5
   * Enable warnings for computed getters that recursively trigger itself.
   */
  warnRecursiveComputed?: boolean

  /**
   * Whether to throw unhandled errors in production.
   * Default is `false` to avoid crashing on any error (and only logs it)
   * But in some cases, e.g. SSR, throwing might be more desirable.
   */
  throwUnhandledErrorInProduction?: boolean

  /**
   * Prefix for all useId() calls within this app
   */
  idPrefix?: string
}

export interface AppContext {
  app: App // for devtools
  config: AppConfig
  mixins: ComponentOptions[]
  components: Record<string, Component>
  directives: Record<string, Directive>
  provides: Record<string | symbol, any>

  /**
   * Cache for merged/normalized component options
   * Each app instance has its own cache because app-level global mixins and
   * optionMergeStrategies can affect merge behavior.
   * @internal
   */
  optionsCache: WeakMap<ComponentOptions, MergedComponentOptions>
  /**
   * Cache for normalized props options
   * @internal
   */
  propsCache: WeakMap<ConcreteComponent, NormalizedPropsOptions>
  /**
   * Cache for normalized emits options
   * @internal
   */
  emitsCache: WeakMap<ConcreteComponent, ObjectEmitsOptions | null>
  /**
   * HMR only
   * @internal
   */
  reload?: () => void
  /**
   * v2 compat only
   * @internal
   */
  filters?: Record<string, Function>
}

type PluginInstallFunction<Options = any[]> = Options extends unknown[]
  ? (app: App, ...options: Options) => any
  : (app: App, options: Options) => any

export type ObjectPlugin<Options = any[]> = {
  install: PluginInstallFunction<Options>
}
export type FunctionPlugin<Options = any[]> = PluginInstallFunction<Options> &
  Partial<ObjectPlugin<Options>>

export type Plugin<
  Options = any[],
  // TODO: in next major Options extends unknown[] and remove P
  P extends unknown[] = Options extends unknown[] ? Options : [Options],
> = FunctionPlugin<P> | ObjectPlugin<P>

export function createAppContext(): AppContext {
  /**
   * 创建应用级上下文。
   *
   * 主要功能：
   * - 为整棵应用树准备一份共享配置
   * - 保存全局组件、全局指令、provide、缓存等运行时资源
   *
   * 返回值：
   * - 返回一个全新的 `AppContext`
   *
   * 依赖：
   * - `optionsCache / propsCache / emitsCache` 会被后续组件初始化复用
   */
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {},
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  }
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null,
) => App<HostElement>

let uid = 0

/**
 * 基于渲染器能力创建 `createApp()` 工厂。
 *
 * 主要功能：
 * - 把平台无关的 `render` / `hydrate` 能力包装成应用级 API
 * - 生成 `app.use / app.mount / app.provide` 等统一入口
 *
 * 参数：
 * - `render`：平台渲染函数，由 `renderer.ts` 提供
 * - `hydrate`：可选的激活函数，SSR 场景下使用
 *
 * 返回值：
 * - 返回一个真正的 `createApp(rootComponent, rootProps?)`
 */
export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
  hydrate?: RootHydrateFunction,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      rootComponent = extend({}, rootComponent)
    }

    if (rootProps != null && !isObject(rootProps)) {
      rootProps = null
    }

    const context = createAppContext()

    /**
     * 已安装插件集合。
     *
     * 作用：
     * - 防止同一个插件被重复安装
     * - 使用 `WeakSet` 避免长期持有插件对象
     */
    const installedPlugins = new WeakSet()

    /**
     * 应用卸载时要执行的清理函数集合。
     *
     * 作用：
     * - 存放 `app.onUnmount()` 注册的清理逻辑
     * - 在整棵应用卸载时统一执行
     */
    const pluginCleanupFns: Array<() => any> = []

    /**
     * 当前应用是否已经完成挂载。
     *
     * 作用：
     * - 保证同一个 app 只走一次首次挂载流程
     * - 后续重复 mount 会被直接忽略
     */
    let isMounted = false

    const app: App = (context.app = {
      _uid: uid++,
      _component: rootComponent as ConcreteComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,

      version,

      get config() {
        return context.config
      },

      /**
       * 配置对象只允许改内部字段，不允许整体替换。
       *
       * 当前这里保留空 setter，
       * 用来阻止外部直接把 `app.config` 整体重写掉。
       */
      set config(v) {},

      /**
       * 安装插件。
       *
       * 主要功能：
       * - 支持对象插件：调用 `plugin.install(app, ...options)`
       * - 支持函数插件：调用 `plugin(app, ...options)`
       * - 通过 `installedPlugins` 避免重复安装
       *
       * 参数：
       * - `plugin`：插件对象或插件函数
       * - `options`：传给插件的剩余参数
       */
      use(plugin: Plugin, ...options: any[]) {
        if (!installedPlugins.has(plugin) && plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (!installedPlugins.has(plugin) && isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        }
        return app
      },

      /**
       * 注册全局 mixin。
       *
       * 主要功能：
       * - 仅在 Options API 打开时生效
       * - 把 mixin 存到应用上下文，后续每个组件解析选项时都会参与合并
       */
      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          }
        }
        return app
      },

      /**
       * 注册或读取全局组件。
       *
       * 参数：
       * - `name`：组件名
       * - `component`：可选；传入时表示注册，不传时表示读取
       */
      component(name: string, component?: Component): any {
        if (!component) {
          return context.components[name]
        }
        context.components[name] = component
        return app
      },

      /**
       * 注册或读取全局指令。
       *
       * 参数：
       * - `name`：指令名
       * - `directive`：可选；传入时表示注册，不传时表示读取
       */
      directive(name: string, directive?: Directive) {
        if (!directive) {
          return context.directives[name] as any
        }
        context.directives[name] = directive
        return app
      },

      /**
       * 把应用挂载到宿主容器上。
       *
       * 主要功能：
       * - 创建根 VNode
       * - 把应用上下文挂到根 VNode
       * - 根据是否 SSR 激活，选择 `hydrate` 或 `render`
       * - 记录根容器和根组件实例
       *
       * 参数：
       * - `rootContainer`：宿主容器
       * - `isHydrate`：是否走激活流程
       * - `namespace`：当前根命名空间，SVG / MathML 场景会用到
       *
       * 依赖：
       * - `createVNode()`：把根组件包装成 VNode
       * - `render()` / `hydrate()`：真正进入渲染器主流程
       */
      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        namespace?: boolean | ElementNamespace,
      ): any {
        if (!isMounted) {
          const vnode = app._ceVNode || createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          if (namespace === true) {
            namespace = 'svg'
          } else if (namespace === false) {
            namespace = undefined
          }

          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            render(vnode, rootContainer, namespace)
          }
          isMounted = true
          app._container = rootContainer
          // for devtools and telemetry
          ;(rootContainer as any).__vue_app__ = app

          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = vnode.component
            devtoolsInitApp(app, version)
          }

          return getComponentPublicInstance(vnode.component!)
        }
      },

      /**
       * 注册应用卸载时的清理回调。
       *
       * 作用：
       * - 让插件或宿主层可以在应用销毁时释放资源
       */
      onUnmount(cleanupFn: () => void) {
        pluginCleanupFns.push(cleanupFn)
      },

      /**
       * 卸载整棵应用树。
       *
       * 主要功能：
       * - 先执行插件注册的清理函数
       * - 再调用 `render(null, container)` 触发整棵树卸载
       * - 最后清理应用实例和容器上的引用
       */
      unmount() {
        if (isMounted) {
          callWithAsyncErrorHandling(
            pluginCleanupFns,
            app._instance,
            ErrorCodes.APP_UNMOUNT_CLEANUP,
          )
          render(null, app._container)
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = null
            devtoolsUnmountApp(app)
          }
          delete app._container.__vue_app__
        }
      },

      /**
       * 在应用上下文上写入 provide。
       *
       * 作用：
       * - 让根级别提供的数据可以被整棵应用树后代 `inject()`
       */
      provide(key, value) {
        context.provides[key as string | symbol] = value

        return app
      },

      /**
       * 临时把当前 app 设为激活上下文并执行函数。
       *
       * 主要功能：
       * - 让 `inject()` 即使不在组件 setup 中，也能借助 app 上下文工作
       *
       * 参数：
       * - `fn`：需要在当前 app 上下文里执行的函数
       */
      runWithContext(fn) {
        const lastApp = currentApp
        currentApp = app
        try {
          return fn()
        } finally {
          currentApp = lastApp
        }
      },
    })

    if (__COMPAT__) {
      installAppCompatProperties(app, context, render)
    }

    return app
  }
}

/**
 * @internal Used to identify the current app when using `inject()` within
 * `app.runWithContext()`.
 */
export let currentApp: App<unknown> | null = null
