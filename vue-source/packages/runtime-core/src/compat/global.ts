/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 global.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import {
  TrackOpTypes,
  TriggerOpTypes,
  isReactive,
  reactive,
  track,
  trigger,
} from '@vue-source/reactivity'
import {
  NOOP,
  extend,
  invokeArrayFns,
  isArray,
  isFunction,
  isObject,
  isString,
} from '@vue-source/shared'
import { warn } from '../warning'
import { cloneVNode, createVNode } from '../vnode'
import type { ElementNamespace, RootRenderFunction } from '../renderer'
import type {
  App,
  AppConfig,
  AppContext,
  CreateAppFunction,
  Plugin,
} from '../apiCreateApp'
import {
  type Component,
  type ComponentOptions,
  createComponentInstance,
  finishComponentSetup,
  isRuntimeOnly,
  setupComponent,
} from '../component'
import {
  type RenderFunction,
  internalOptionMergeStrats,
  mergeOptions,
} from '../componentOptions'
import type { ComponentPublicInstance } from '../componentPublicInstance'
import { devtoolsInitApp, devtoolsUnmountApp } from '../devtools'
import type { Directive } from '../directives'
import { nextTick } from '../scheduler'
import { version } from '..'
import {
  type LegacyConfig,
  installLegacyConfigWarnings,
  installLegacyOptionMergeStrats,
} from './globalConfig'
import type { LegacyDirective } from './customDirective'
import {
  DeprecationTypes,
  assertCompatEnabled,
  configureCompat,
  isCompatEnabled,
  softAssertCompatEnabled,
  warnDeprecation,
} from './compatConfig'
import type { LegacyPublicInstance } from './instance'

/**
 * @deprecated the default `Vue` export has been removed in Vue 3. The type for
 * the default export is provided only for migration purposes. Please use
 * named imports instead - e.g. `import { createApp } from 'vue'`.
 */
export type CompatVue = Pick<App, 'version' | 'component' | 'directive'> & {
  configureCompat: typeof configureCompat

  // no inference here since these types are not meant for actual use - they
  // are merely here to provide type checks for internal implementation and
  // information for migration.
  new (options?: ComponentOptions): LegacyPublicInstance

  version: string
  config: AppConfig & LegacyConfig

  nextTick: typeof nextTick

  use<Options extends unknown[]>(
    plugin: Plugin<Options>,
    ...options: Options
  ): CompatVue
  use<Options>(plugin: Plugin<Options>, options: Options): CompatVue

  mixin(mixin: ComponentOptions): CompatVue

  component(name: string): Component | undefined
  component(name: string, component: Component): CompatVue
  directive<T = any, V = any>(name: string): Directive<T, V> | undefined
  directive<T = any, V = any>(
    name: string,
    directive: Directive<T, V>,
  ): CompatVue

  compile(template: string): RenderFunction

  /**
   * @deprecated Vue 3 no longer supports extending constructors.
   */
  extend: (options?: ComponentOptions) => CompatVue
  /**
   * @deprecated Vue 3 no longer needs set() for adding new properties.
   */
  set(target: any, key: PropertyKey, value: any): void
  /**
   * @deprecated Vue 3 no longer needs delete() for property deletions.
   */
  delete(target: any, key: PropertyKey): void
  /**
   * @deprecated use `reactive` instead.
   */
  observable: typeof reactive
  /**
   * @deprecated filters have been removed from Vue 3.
   */
  filter(name: string, arg?: any): null
  /**
   * @internal
   */
  cid: number
  /**
   * @internal
   */
  options: ComponentOptions
  /**
   * @internal
   */
  util: any
  /**
   * @internal
   */
  super: CompatVue
}

export let isCopyingConfig = false

// 单例 app 和构造器用于兼容 Vue 2 的全局 `Vue` 构造函数式 API。
// `singletonApp` 主要承接全局 component/directive/mixin/config 状态。
export let singletonApp: App
let singletonCtor: CompatVue

/**
 * 作用：创建 Vue 2 风格的全局 `Vue` 构造器兼容层。
 *
 * 参数说明：
 * - `createApp`：普通应用创建函数。
 * - `createSingletonApp`：用来承接全局配置和注册表的单例 app 创建函数。
 */
export function createCompatVue(
  createApp: CreateAppFunction<Element>,
  createSingletonApp: CreateAppFunction<Element>,
): CompatVue {
  singletonApp = createSingletonApp({})

  const Vue: CompatVue = (singletonCtor = function Vue(
    options: ComponentOptions = {},
  ) {
    return createCompatApp(options, Vue)
  } as any)

  /**
   * 作用：把 Vue 2 风格的组件选项对象包装成一个兼容 app，并返回根实例代理。
   */
  function createCompatApp(options: ComponentOptions = {}, Ctor: any) {
    assertCompatEnabled(DeprecationTypes.GLOBAL_MOUNT, null)

    const { data } = options
    if (
      data &&
      !isFunction(data) &&
      softAssertCompatEnabled(DeprecationTypes.OPTIONS_DATA_FN, null)
    ) {
      options.data = () => data
    }

    const app = createApp(options)

    if (Ctor !== Vue) {
      // `Vue.extend()` 生成的子构造器会带自己的原型链，这里要把单例原型复制过去。
      applySingletonPrototype(app, Ctor)
    }

    const vm = app._createRoot!(options)
    if (options.el) {
      return (vm as any).$mount(options.el)
    } else {
      return vm
    }
  }

  Vue.version = `2.6.14-compat:${__VERSION__}`
  Vue.config = singletonApp.config

  Vue.use = (plugin: Plugin, ...options: any[]) => {
    if (plugin && isFunction(plugin.install)) {
      plugin.install(Vue as any, ...options)
    } else if (isFunction(plugin)) {
      plugin(Vue as any, ...options)
    }
    return Vue
  }

  Vue.mixin = m => {
    singletonApp.mixin(m)
    return Vue
  }

  Vue.component = ((name: string, comp: Component) => {
    if (comp) {
      singletonApp.component(name, comp)
      return Vue
    } else {
      return singletonApp.component(name)
    }
  }) as any

  Vue.directive = ((name: string, dir: Directive | LegacyDirective) => {
    if (dir) {
      singletonApp.directive(name, dir as Directive)
      return Vue
    } else {
      return singletonApp.directive(name)
    }
  }) as any

  Vue.options = { _base: Vue }

  let cid = 1
  Vue.cid = cid

  Vue.nextTick = nextTick

  // `extendCache` 避免同一个 options 对象反复生成新的子构造器。
  const extendCache = new WeakMap()

  function extendCtor(this: any, extendOptions: ComponentOptions = {}) {
    assertCompatEnabled(DeprecationTypes.GLOBAL_EXTEND, null)
    if (isFunction(extendOptions)) {
      extendOptions = extendOptions.options
    }

    if (extendCache.has(extendOptions)) {
      return extendCache.get(extendOptions)
    }

    const Super = this
    // `SubVue` 是 Vue 2 `Vue.extend()` 返回的子构造器兼容实现。
    function SubVue(inlineOptions?: ComponentOptions) {
      if (!inlineOptions) {
        return createCompatApp(SubVue.options, SubVue)
      } else {
        return createCompatApp(
          mergeOptions(
            extend({}, SubVue.options),
            inlineOptions,
            internalOptionMergeStrats as any,
          ),
          SubVue,
        )
      }
    }
    SubVue.super = Super
    SubVue.prototype = Object.create(Vue.prototype)
    SubVue.prototype.constructor = SubVue

    // 复制父构造器 options 的非原始值，避免子构造器误共享可变配置对象。
    const mergeBase: any = {}
    for (const key in Super.options) {
      const superValue = Super.options[key]
      mergeBase[key] = isArray(superValue)
        ? superValue.slice()
        : isObject(superValue)
          ? extend(Object.create(null), superValue)
          : superValue
    }

    SubVue.options = mergeOptions(
      mergeBase,
      extendOptions,
      internalOptionMergeStrats as any,
    )

    SubVue.options._base = SubVue
    SubVue.extend = extendCtor.bind(SubVue)
    SubVue.mixin = Super.mixin
    SubVue.use = Super.use
    SubVue.cid = ++cid

    extendCache.set(extendOptions, SubVue)
    return SubVue
  }

  Vue.extend = extendCtor.bind(Vue) as any

  Vue.set = (target, key, value) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_SET, null)
    target[key] = value
  }

  Vue.delete = (target, key) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_DELETE, null)
    delete target[key]
  }

  Vue.observable = (target: any) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_OBSERVABLE, null)
    return reactive(target)
  }

  Vue.filter = ((name: string, filter?: any) => {
    if (filter) {
      singletonApp.filter!(name, filter)
      return Vue
    } else {
      return singletonApp.filter!(name)
    }
  }) as any

  // internal utils - these are technically internal but some plugins use it.
  const util = {
    warn: __DEV__ ? warn : NOOP,
    extend,
    mergeOptions: (parent: any, child: any, vm?: ComponentPublicInstance) =>
      mergeOptions(
        parent,
        child,
        vm ? undefined : (internalOptionMergeStrats as any),
      ),
    defineReactive,
  }
  Object.defineProperty(Vue, 'util', {
    get() {
      assertCompatEnabled(DeprecationTypes.GLOBAL_PRIVATE_UTIL, null)
      return util
    },
  })

  Vue.configureCompat = configureCompat

  return Vue
}

export function installAppCompatProperties(
  app: App,
  context: AppContext,
  render: RootRenderFunction<any>,
): void {
  // 这里把 Vue 2 全局 API、filter、mount 等旧入口桥接到当前 app 实例上。
  installFilterMethod(app, context)
  installLegacyOptionMergeStrats(app.config)

  if (!singletonApp) {
    // this is the call of creating the singleton itself so the rest is
    // unnecessary
    return
  }

  installCompatMount(app, context, render)
  installLegacyAPIs(app)
  applySingletonAppMutations(app)
  if (__DEV__) installLegacyConfigWarnings(app.config)
}

function installFilterMethod(app: App, context: AppContext) {
  // compat 下 filters 被放在 appContext.filters 中维护。
  context.filters = {}
  app.filter = (name: string, filter?: Function): any => {
    assertCompatEnabled(DeprecationTypes.FILTERS, null)
    if (!filter) {
      return context.filters![name]
    }
    if (__DEV__ && context.filters![name]) {
      warn(`Filter "${name}" has already been registered.`)
    }
    context.filters![name] = filter
    return app
  }
}

function installLegacyAPIs(app: App) {
  // 给 legacy plugin 暴露 Vue 2 风格的全局 API 入口。
  Object.defineProperties(app, {
    // so that app.use() can work with legacy plugins that extend prototypes
    prototype: {
      get() {
        __DEV__ && warnDeprecation(DeprecationTypes.GLOBAL_PROTOTYPE, null)
        return app.config.globalProperties
      },
    },
    nextTick: { value: nextTick },
    extend: { value: singletonCtor.extend },
    set: { value: singletonCtor.set },
    delete: { value: singletonCtor.delete },
    observable: { value: singletonCtor.observable },
    util: {
      get() {
        return singletonCtor.util
      },
    },
  })
}

function applySingletonAppMutations(app: App) {
  // 把单例 app 上累积的 mixin/component/directive/filter 全部复制到当前 app。
  app._context.mixins = [...singletonApp._context.mixins]
  ;['components', 'directives', 'filters'].forEach(key => {
    // @ts-expect-error
    app._context[key] = Object.create(singletonApp._context[key])
  })

  // 全局 config 也要一起复制，保证 `new Vue()` 和 `createApp()` 在 compat 下行为一致。
  isCopyingConfig = true
  for (const key in singletonApp.config) {
    if (key === 'isNativeTag') continue
    if (
      isRuntimeOnly() &&
      (key === 'isCustomElement' || key === 'compilerOptions')
    ) {
      continue
    }
    const val = singletonApp.config[key as keyof AppConfig]
    // @ts-expect-error
    app.config[key] = isObject(val) ? Object.create(val) : val

    // Vue 2 的 `ignoredElements` 在这里桥接成 Vue 3 的 `compilerOptions.isCustomElement`。
    if (
      key === 'ignoredElements' &&
      isCompatEnabled(DeprecationTypes.CONFIG_IGNORED_ELEMENTS, null) &&
      !isRuntimeOnly() &&
      isArray(val)
    ) {
      app.config.compilerOptions.isCustomElement = tag => {
        return val.some(v => (isString(v) ? v === tag : v.test(tag)))
      }
    }
  }
  isCopyingConfig = false
  applySingletonPrototype(app, singletonCtor)
}

function applySingletonPrototype(app: App, Ctor: Function) {
  // Vue 2 上通过 `Vue.prototype.xxx = ...` 挂的成员，在 Vue 3 里桥接到 globalProperties。
  const enabled = isCompatEnabled(DeprecationTypes.GLOBAL_PROTOTYPE, null)
  if (enabled) {
    app.config.globalProperties = Object.create(Ctor.prototype)
  }
  let hasPrototypeAugmentations = false
  for (const key of Object.getOwnPropertyNames(Ctor.prototype)) {
    if (key !== 'constructor') {
      hasPrototypeAugmentations = true
      if (enabled) {
        Object.defineProperty(
          app.config.globalProperties,
          key,
          Object.getOwnPropertyDescriptor(Ctor.prototype, key)!,
        )
      }
    }
  }
  if (__DEV__ && hasPrototypeAugmentations) {
    warnDeprecation(DeprecationTypes.GLOBAL_PROTOTYPE, null)
  }
}

function installCompatMount(
  app: App,
  context: AppContext,
  render: RootRenderFunction,
) {
  let isMounted = false

  /**
   * Vue 2 supports the behavior of creating a component instance but not
   * mounting it, which is no longer possible in Vue 3 - this internal
   * function simulates that behavior.
   */
  app._createRoot = options => {
    const component = app._component
    const vnode = createVNode(component, options.propsData || null)
    vnode.appContext = context

    const hasNoRender =
      !isFunction(component) && !component.render && !component.template
    const emptyRender = () => {}

    // create root instance
    const instance = createComponentInstance(vnode, null, null)
    // suppress "missing render fn" warning since it can't be determined
    // until $mount is called
    if (hasNoRender) {
      instance.render = emptyRender
    }
    setupComponent(instance)
    vnode.component = instance
    vnode.isCompatRoot = true

    // $mount & $destroy
    // these are defined on ctx and picked up by the $mount/$destroy
    // public property getters on the instance proxy.
    // Note: the following assumes DOM environment since the compat build
    // only targets web. It essentially includes logic for app.mount from
    // both runtime-core AND runtime-dom.
    instance.ctx._compat_mount = (selectorOrEl?: string | Element) => {
      if (isMounted) {
        __DEV__ && warn(`Root instance is already mounted.`)
        return
      }

      let container: Element
      if (typeof selectorOrEl === 'string') {
        // eslint-disable-next-line
        const result = document.querySelector(selectorOrEl)
        if (!result) {
          __DEV__ &&
            warn(
              `Failed to mount root instance: selector "${selectorOrEl}" returned null.`,
            )
          return
        }
        container = result
      } else {
        // eslint-disable-next-line
        container = selectorOrEl || document.createElement('div')
      }

      let namespace: ElementNamespace
      if (container instanceof SVGElement) namespace = 'svg'
      else if (
        typeof MathMLElement === 'function' &&
        container instanceof MathMLElement
      )
        namespace = 'mathml'

      // HMR root reload
      if (__DEV__) {
        context.reload = () => {
          const cloned = cloneVNode(vnode)
          // compat mode will use instance if not reset to null
          cloned.component = null
          render(cloned, container, namespace)
        }
      }

      // resolve in-DOM template if component did not provide render
      // and no setup/mixin render functions are provided (by checking
      // that the instance is still using the placeholder render fn)
      if (hasNoRender && instance.render === emptyRender) {
        // root directives check
        if (__DEV__) {
          for (let i = 0; i < container.attributes.length; i++) {
            const attr = container.attributes[i]
            if (attr.name !== 'v-cloak' && /^(?:v-|:|@)/.test(attr.name)) {
              warnDeprecation(DeprecationTypes.GLOBAL_MOUNT_CONTAINER, null)
              break
            }
          }
        }
        instance.render = null
        ;(component as ComponentOptions).template = container.innerHTML
        finishComponentSetup(instance, false, true /* skip options */)
      }

      // clear content before mounting
      container.textContent = ''

      // TODO hydration
      render(vnode, container, namespace)

      if (container instanceof Element) {
        container.removeAttribute('v-cloak')
        container.setAttribute('data-v-app', '')
      }

      isMounted = true
      app._container = container
      // for devtools and telemetry
      ;(container as any).__vue_app__ = app
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsInitApp(app, version)
      }

      return instance.proxy!
    }

    instance.ctx._compat_destroy = () => {
      if (isMounted) {
        render(null, app._container)
        if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
          devtoolsUnmountApp(app)
        }
        delete app._container.__vue_app__
      } else {
        const { bum, scope, um } = instance
        // beforeDestroy hooks
        if (bum) {
          invokeArrayFns(bum)
        }
        if (isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)) {
          instance.emit('hook:beforeDestroy')
        }
        // stop effects
        if (scope) {
          scope.stop()
        }
        // unmounted hook
        if (um) {
          invokeArrayFns(um)
        }
        if (isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)) {
          instance.emit('hook:destroyed')
        }
      }
    }

    return instance.proxy!
  }
}

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
]

const patched = new WeakSet<object>()

function defineReactive(obj: any, key: string, val: any) {
  // it's possible for the original object to be mutated after being defined
  // and expecting reactivity... we are covering it here because this seems to
  // be a bit more common.
  if (isObject(val) && !isReactive(val) && !patched.has(val)) {
    const reactiveVal = reactive(val)
    if (isArray(val)) {
      methodsToPatch.forEach((m: any) => {
        val[m] = (...args: any[]) => {
          Array.prototype[m].apply(reactiveVal, args)
        }
      })
    } else {
      Object.keys(val).forEach(key => {
        try {
          defineReactiveSimple(val, key, val[key])
        } catch (e: any) {}
      })
    }
  }

  const i = obj.$
  if (i && obj === i.proxy) {
    // target is a Vue instance - define on instance.ctx
    defineReactiveSimple(i.ctx, key, val)
    i.accessCache = Object.create(null)
  } else if (isReactive(obj)) {
    obj[key] = val
  } else {
    defineReactiveSimple(obj, key, val)
  }
}

function defineReactiveSimple(obj: any, key: string, val: any) {
  val = isObject(val) ? reactive(val) : val
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      track(obj, TrackOpTypes.GET, key)
      return val
    },
    set(newVal) {
      val = isObject(newVal) ? reactive(newVal) : newVal
      trigger(obj, TriggerOpTypes.SET, key, newVal)
    },
  })
}
