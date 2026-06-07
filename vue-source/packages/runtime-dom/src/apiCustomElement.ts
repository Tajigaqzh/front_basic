/**
 * 文件作用：实现 Vue 组件到浏览器 Custom Element 的桥接能力。
 *
 * 它负责：
 * - `defineCustomElement()` 类型和运行时封装
 * - `VueElement` 自定义元素基类
 * - attrs / props / slots / styles / shadowRoot 与 Vue 组件实例之间的同步
 *
 * 可以把它理解成“Vue 组件运行时”和“原生 Web Components 生命周期”之间的适配层。
 */

import {
  type App,
  type Component,
  type ComponentCustomElementInterface,
  type ComponentInjectOptions,
  type ComponentInternalInstance,
  type ComponentObjectPropsOptions,
  type ComponentOptions,
  type ComponentOptionsBase,
  type ComponentOptionsMixin,
  type ComponentProvideOptions,
  type ComponentPublicInstance,
  type ComputedOptions,
  type ConcreteComponent,
  type CreateAppFunction,
  type CreateComponentPublicInstanceWithMixins,
  type DefineComponent,
  type Directive,
  type EmitsOptions,
  type EmitsToProps,
  type ExtractPropTypes,
  type MethodOptions,
  type RenderFunction,
  type SetupContext,
  type SlotsType,
  type VNode,
  type VNodeProps,
  createVNode,
  defineComponent,
  getCurrentInstance,
  nextTick,
  unref,
  warn,
} from '@vue-source/runtime-core'
import {
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isPlainObject,
  toNumber,
} from '@vue-source/shared'
import { createApp, createSSRApp, render } from '.'

// 这个哨兵值表示“当前属性应当被删除”，而不是设置成普通值。
const REMOVAL = {}

export type VueElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VueElement & P
}

export interface CustomElementOptions {
  styles?: string[]
  shadowRoot?: boolean
  shadowRootOptions?: Omit<ShadowRootInit, 'mode'>
  nonce?: string
  configureApp?: (app: App) => void
}

// `defineCustomElement` 需要尽量和 `defineComponent` 保持同样的类型推导体验。

// overload 1: direct setup function
export function defineCustomElement<Props, RawBindings = object>(
  setup: (props: Props, ctx: SetupContext) => RawBindings | RenderFunction,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs' | 'emits'> &
    CustomElementOptions & {
      props?: (keyof Props)[]
    },
): VueElementConstructor<Props>
export function defineCustomElement<Props, RawBindings = object>(
  setup: (props: Props, ctx: SetupContext) => RawBindings | RenderFunction,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs' | 'emits'> &
    CustomElementOptions & {
      props?: ComponentObjectPropsOptions<Props>
    },
): VueElementConstructor<Props>

// overload 2: defineCustomElement with options object, infer props from options
export function defineCustomElement<
  // props
  RuntimePropsOptions extends ComponentObjectPropsOptions =
    ComponentObjectPropsOptions,
  PropsKeys extends string = string,
  // emits
  RuntimeEmitsOptions extends EmitsOptions = {},
  EmitsKeys extends string = string,
  // other options
  Data = {},
  SetupBindings = {},
  Computed extends ComputedOptions = {},
  Methods extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  InjectOptions extends ComponentInjectOptions = {},
  InjectKeys extends string = string,
  Slots extends SlotsType = {},
  LocalComponents extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  // resolved types
  InferredProps = string extends PropsKeys
    ? ComponentObjectPropsOptions extends RuntimePropsOptions
      ? {}
      : ExtractPropTypes<RuntimePropsOptions>
    : { [key in PropsKeys]?: any },
  ResolvedProps = InferredProps & EmitsToProps<RuntimeEmitsOptions>,
>(
  options: CustomElementOptions & {
    props?: (RuntimePropsOptions & ThisType<void>) | PropsKeys[]
  } & ComponentOptionsBase<
      ResolvedProps,
      SetupBindings,
      Data,
      Computed,
      Methods,
      Mixin,
      Extends,
      RuntimeEmitsOptions,
      EmitsKeys,
      {}, // Defaults
      InjectOptions,
      InjectKeys,
      Slots,
      LocalComponents,
      Directives,
      Exposed,
      Provide
    > &
    ThisType<
      CreateComponentPublicInstanceWithMixins<
        Readonly<ResolvedProps>,
        SetupBindings,
        Data,
        Computed,
        Methods,
        Mixin,
        Extends,
        RuntimeEmitsOptions,
        EmitsKeys,
        {},
        false,
        InjectOptions,
        Slots,
        LocalComponents,
        Directives,
        Exposed
      >
    >,
  extraOptions?: CustomElementOptions,
): VueElementConstructor<ResolvedProps>

// overload 3: defining a custom element from the returned value of
// `defineComponent`
export function defineCustomElement<
  // this should be `ComponentPublicInstanceConstructor` but that type is not exported
  T extends { new (...args: any[]): ComponentPublicInstance<any> },
>(
  options: T,
  extraOptions?: CustomElementOptions,
): VueElementConstructor<
  T extends DefineComponent<infer P, any, any, any> ? P : unknown
>

/*@__NO_SIDE_EFFECTS__*/
export function defineCustomElement(
  options: any,
  extraOptions?: ComponentOptions,
  /**
   * @internal
   */
  _createApp?: CreateAppFunction<Element>,
): VueElementConstructor {
  let Comp = defineComponent(options, extraOptions) as any
  if (isPlainObject(Comp)) Comp = extend({}, Comp, extraOptions)
  // 这里生成最终注册到 Custom Elements Registry 的宿主类。
  class VueCustomElement extends VueElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, _createApp)
    }
  }

  return VueCustomElement
}

/*@__NO_SIDE_EFFECTS__*/
export const defineSSRCustomElement = ((
  options: any,
  extraOptions?: ComponentOptions,
) => {
  // @ts-expect-error
  return defineCustomElement(options, extraOptions, createSSRApp)
}) as typeof defineCustomElement

const BaseClass = (
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
) as typeof HTMLElement

type InnerComponentDef = ConcreteComponent & CustomElementOptions

/**
 * 作用：Vue 自定义元素运行时宿主类。
 *
 * 核心职责：
 * - 接管浏览器 Custom Element 生命周期。
 * - 同步 attribute / prop。
 * - 在元素内部创建并维护 Vue 应用与组件实例。
 * - 处理 slot、style、Teleport 目标等浏览器专属细节。
 */
export class VueElement
  extends BaseClass
  implements ComponentCustomElementInterface
{
  _isVueCE = true
  /**
   * @internal
   */
  _instance: ComponentInternalInstance | null = null
  /**
   * @internal
   */
  _app: App | null = null
  /**
   * @internal
   */
  _root: Element | ShadowRoot
  /**
   * @internal
   */
  _nonce: string | undefined = this._def.nonce

  /**
   * @internal
   */
  _teleportTargets?: Set<Element>

  // 下面这些私有状态用来跟踪连接状态、解析状态、样式子树、待处理任务等运行时细节。
  private _connected = false
  private _resolved = false
  private _patching = false
  private _dirty = false
  private _numberProps: Record<string, true> | null = null
  private _styleChildren = new WeakSet()
  private _pendingResolve: Promise<void> | undefined
  private _parent: VueElement | undefined
  private _styleAnchors: WeakMap<ConcreteComponent, HTMLStyleElement> =
    new WeakMap()
  /**
   * dev only
   */
  private _styles?: HTMLStyleElement[]
  /**
   * dev only
   */
  private _childStyles?: Map<string, HTMLStyleElement[]>
  private _ob?: MutationObserver | null = null
  private _slots?: Record<string, Node[]>

  constructor(
    /**
     * 组件定义。这里传进来的可能还是 AsyncWrapper，
     * 真正解析完成后的定义会再同步到 `this._def`。
     */
    private _def: InnerComponentDef,
    private _props: Record<string, any> = {},
    private _createApp: CreateAppFunction<Element> = createApp,
  ) {
    super()
    // SSR 自定义元素 hydrate 时，浏览器可能已经有 declarative shadow root，这里优先复用。
    if (this.shadowRoot && _createApp !== createApp) {
      this._root = this.shadowRoot
    } else {
      if (__DEV__ && this.shadowRoot) {
        warn(
          `Custom element has pre-rendered declarative shadow root but is not ` +
            `defined as hydratable. Use \`defineSSRCustomElement\`.`,
        )
      }
      // 默认会为自定义元素创建一个开放的 shadowRoot，除非用户显式关闭。
      if (_def.shadowRoot !== false) {
        this.attachShadow(
          extend({}, _def.shadowRootOptions, {
            mode: 'open',
          }) as ShadowRootInit,
        )
        this._root = this.shadowRoot!
      } else {
        this._root = this
      }
    }
  }

  connectedCallback(): void {
    // 只有真正连入文档树后才开始解析和挂载组件。
    if (!this.isConnected) return

    // 非 shadow 模式下，初次连接时需要把现有 light DOM 解析成 slots。
    if (!this.shadowRoot && !this._resolved) {
      this._parseSlots()
    }
    this._connected = true

    // 向上寻找最近的 Vue 自定义元素父级，为 provide/inject 和 appContext 继承做准备。
    let parent: Node | null = this
    while (
      (parent =
        parent &&
        // #12479 should check assignedSlot first to get correct parent
        ((parent as Element).assignedSlot ||
          parent.parentNode ||
          (parent as ShadowRoot).host))
    ) {
      if (parent instanceof VueElement) {
        this._parent = parent
        break
      }
    }

    if (!this._instance) {
      if (this._resolved) {
        // 定义已经解析完但实例还没挂，说明是重连或“先 resolve 后 connect”，直接挂载即可。
        this._mount(this._def)
      } else {
        // 如果父自定义元素还在异步解析，当前元素要等待父级解析完成后再继续。
        if (parent && parent._pendingResolve) {
          this._pendingResolve = parent._pendingResolve.then(() => {
            this._pendingResolve = undefined
            this._resolveDef()
          })
        } else {
          // 没有父级异步阻塞时，当前元素自己开始解析定义。
          this._resolveDef()
        }
      }
    }
  }

  /**
   * 作用：把当前自定义元素对应的组件实例接到父自定义元素实例之下。
   */
  private _setParent(parent = this._parent) {
    if (parent) {
      this._instance!.parent = parent._instance
      this._inheritParentContext(parent)
    }
  }

  /**
   * 作用：继承父自定义元素的 appContext / provides 原型链。
   */
  private _inheritParentContext(parent = this._parent) {
    // 这样当前元素既能拿到应用级 provide，也能拿到父自定义元素级 provide。
    if (parent && this._app) {
      Object.setPrototypeOf(
        this._app._context.provides,
        parent._instance!.provides,
      )
    }
  }

  disconnectedCallback(): void {
    this._connected = false
    nextTick(() => {
      if (!this._connected) {
        if (this._ob) {
          this._ob.disconnect()
          this._ob = null
        }
        // 延迟到 nextTick 再卸载，给可能发生的“先移除后重新插入”留一个缓冲窗口。
        this._app && this._app.unmount()
        if (this._instance) this._instance.ce = undefined
        this._app = this._instance = null
        if (this._teleportTargets) {
          this._teleportTargets.clear()
          this._teleportTargets = undefined
        }
      }
    })
  }

  private _processMutations(mutations: MutationRecord[]) {
    // 只关心 attribute 变化，统一转回 props 更新链。
    for (const m of mutations) {
      this._setAttr(m.attributeName!)
    }
  }

  /**
   * 作用：解析组件定义，并完成首次 props / styles / mount 准备。
   *
   * 这里会同时处理同步组件和异步组件两条路径。
   */
  private _resolveDef() {
    if (this._pendingResolve) {
      // 避免同一个元素并发触发多次定义解析。
      return
    }

    // 先把升级前或连接前已经写到元素上的 attribute 同步进 props。
    for (let i = 0; i < this.attributes.length; i++) {
      this._setAttr(this.attributes[i].name)
    }

    // 后续 attribute 变化继续通过 MutationObserver 回流到 props。
    this._ob = new MutationObserver(this._processMutations.bind(this))

    this._ob.observe(this, { attributes: true })

    const resolve = (def: InnerComponentDef, isAsync = false) => {
      this._resolved = true
      this._pendingResolve = undefined

      const { props, styles } = def

      // 组件定义真正拿到后，才能知道哪些 props 需要 Number 强转。
      let numberProps
      if (props && !isArray(props)) {
        for (const key in props) {
          const opt = props[key]
          if (opt === Number || (opt && opt.type === Number)) {
            if (key in this._props) {
              this._props[key] = toNumber(this._props[key])
            }
            ;(numberProps || (numberProps = Object.create(null)))[
              camelize(key)
            ] = true
          }
        }
      }
      this._numberProps = numberProps
      // 只有拿到最终组件定义后，才能知道应该桥接哪些 prop 访问器。
      this._resolveProps(def)

      // 自定义元素默认在 shadowRoot 中注入组件样式。
      if (this.shadowRoot) {
        this._applyStyles(styles)
      } else if (__DEV__ && styles) {
        warn(
          'Custom element style injection is not supported when using ' +
            'shadowRoot: false',
        )
      }

      // 到这里定义、props、样式都准备好了，开始首次挂载。
      this._mount(def)
    }

    const asyncDef = (this._def as ComponentOptions).__asyncLoader
    if (asyncDef) {
      // 异步定义解析完成前，当前元素保持“已连接但未挂载”的等待态。
      this._pendingResolve = asyncDef().then((def: InnerComponentDef) => {
        def.configureApp = this._def.configureApp
        resolve((this._def = def), true)
      })
    } else {
      resolve(this._def)
    }
  }

  /**
   * 作用：创建 Vue app，并把组件真正挂载到自定义元素内部。
   */
  private _mount(def: InnerComponentDef) {
    if ((__DEV__ || __FEATURE_PROD_DEVTOOLS__) && !def.name) {
      // @ts-expect-error
      def.name = 'VueElement'
    }
    this._app = this._createApp(def)
    // inherit before configureApp to detect context overwrites
    // 先继承父级上下文，再允许用户配置 app，更符合“子级基于父级扩展”的顺序。
    this._inheritParentContext()
    if (def.configureApp) {
      def.configureApp(this._app)
    }
    this._app._ceVNode = this._createVNode()
    // 真正渲染仍走标准 app.mount，只是容器变成了 shadowRoot 或宿主元素自身。
    this._app.mount(this._root)

    // 组件 `expose()` 暴露出的成员，会在挂载后转成自定义元素实例上的只读属性。
    const exposed = this._instance && this._instance.exposed
    if (!exposed) return
    for (const key in exposed) {
      if (!hasOwn(this, key)) {
        // exposed properties are readonly
        Object.defineProperty(this, key, {
          // unwrap ref to be consistent with public instance behavior
          get: () => unref(exposed[key]),
        })
      } else if (__DEV__) {
        warn(`Exposed property "${key}" already exists on custom element.`)
      }
    }
  }

  /**
   * 作用：解析组件声明的 props，并把它们桥接到自定义元素实例属性上。
   */
  private _resolveProps(def: InnerComponentDef) {
    const { props } = def
    const declaredPropKeys = isArray(props) ? props : Object.keys(props || {})

    // 处理“浏览器先创建元素实例，后升级定义”时，用户提前直接写到实例上的属性。
    for (const key of Object.keys(this)) {
      if (key[0] !== '_' && declaredPropKeys.includes(key)) {
        // 定义升级前直接写到元素实例上的值，要回收进 Vue 的 props 容器，避免升级后丢失。
        this._setProp(key, this[key as keyof this])
      }
    }

    // 给每个声明的 prop 建立实例级 getter/setter，后续直接走 `_setProp`。
    for (const key of declaredPropKeys.map(camelize)) {
      Object.defineProperty(this, key, {
        get(this: VueElement) {
          return this._getProp(key)
        },
        set(this: VueElement, val) {
          // 外部直接 `el.foo = ...` 最终仍统一收口到 Vue props 更新链，而不是绕过组件实例。
          this._setProp(key, val, true, !this._patching)
        },
      })
    }
  }

  protected _setAttr(key: string): void {
    // scopeId 类属性属于 Vue 内部样式标记，不应该再反向映射回组件 props。
    if (key.startsWith('data-v-')) return
    const has = this.hasAttribute(key)
    let value = has ? this.getAttribute(key) : REMOVAL
    const camelKey = camelize(key)
    // 数字型 props 从 attribute 读取回来时默认是字符串，这里按声明恢复成 number。
    if (has && this._numberProps && this._numberProps[camelKey]) {
      value = toNumber(value)
    }
    this._setProp(camelKey, value, false, true)
  }

  /**
   * @internal
   */
  protected _getProp(key: string): any {
    return this._props[key]
  }

  /**
   * @internal
   */
  _setProp(
    key: string,
    val: any,
    shouldReflect = true,
    shouldUpdate = false,
  ): void {
    if (val !== this._props[key]) {
      // 只要 props 发生变化，就先记脏；patch 过程结束后若仍为脏，会再补一轮更新。
      this._dirty = true
      if (val === REMOVAL) {
        delete this._props[key]
      } else {
        this._props[key] = val
        // support set key on ceVNode
        if (key === 'key' && this._app) {
          this._app._ceVNode!.key = val
        }
      }
      if (shouldUpdate && this._instance) {
        // 实例已存在时，某些 setter / attribute 回写需要立刻触发组件重新 render。
        this._update()
      }
      // 按需把 prop 变化反射回 attribute，保持浏览器 Custom Element 语义一致。
      if (shouldReflect) {
        const ob = this._ob
        if (ob) {
          this._processMutations(ob.takeRecords())
          ob.disconnect()
        }
        if (val === true) {
          this.setAttribute(hyphenate(key), '')
        } else if (typeof val === 'string' || typeof val === 'number') {
          this.setAttribute(hyphenate(key), val + '')
        } else if (!val) {
          this.removeAttribute(hyphenate(key))
        }
        ob && ob.observe(this, { attributes: true })
      }
    }
  }

  /**
   * 作用：基于当前 props 重新创建 vnode，并把它重新 render 到根容器。
   */
  private _update() {
    // Custom Element 的更新本质上还是“重新创建根 vnode，再交给标准 renderer patch”。
    const vnode = this._createVNode()
    if (this._app) vnode.appContext = this._app._context
    render(vnode, this._root)
  }

  /**
   * 作用：创建当前自定义元素对应的根 vnode，并把实例回调、emit 拦截等桥接进去。
   */
  private _createVNode(): VNode<any, any> {
    const baseProps: VNodeProps = {}
    if (!this.shadowRoot) {
      baseProps.onVnodeMounted = baseProps.onVnodeUpdated =
        this._renderSlots.bind(this)
    }
    const vnode = createVNode(this._def, extend(baseProps, this._props))
    if (!this._instance) {
      vnode.ce = instance => {
        this._instance = instance
        instance.ce = this
        instance.isCE = true // for vue-i18n backwards compat
        // HMR
        if (__DEV__) {
          instance.ceReload = newStyles => {
            // always reset styles
            if (this._styles) {
              this._styles.forEach(s => this._root.removeChild(s))
              this._styles.length = 0
            }
            this._styleAnchors.delete(this._def)
            this._applyStyles(newStyles)
            this._instance = null
            this._update()
          }
        }

        const dispatch = (event: string, args: any[]) => {
          this.dispatchEvent(
            new CustomEvent(
              event,
              isPlainObject(args[0])
                ? extend({ detail: args }, args[0])
                : { detail: args },
            ),
          )
        }

        // 组件内部 `emit()` 会被桥接成浏览器 CustomEvent。
        instance.emit = (event: string, ...args: any[]) => {
          // 同时派发原事件名和 kebab-case 事件名，和普通 Vue 模板监听体验保持一致。
          dispatch(event, args)
          if (hyphenate(event) !== event) {
            dispatch(hyphenate(event), args)
          }
        }

        this._setParent()
      }
    }
    return vnode
  }

  private _applyStyles(
    styles: string[] | undefined,
    owner?: ConcreteComponent,
    parentComp?: ConcreteComponent,
  ) {
    if (!styles) return
    if (owner) {
      // 同一个子组件样式只应注入一次；否则嵌套更新/HMR 时会不断重复插入。
      if (owner === this._def || this._styleChildren.has(owner)) {
        return
      }
      this._styleChildren.add(owner)
    }

    const nonce = this._nonce
    const root = this.shadowRoot!
    // `insertionAnchor` 用来保证父子组件样式在 shadowRoot 中仍保持稳定插入顺序。
    const insertionAnchor = parentComp
      ? this._getStyleAnchor(parentComp) || this._getStyleAnchor(this._def)
      : this._getRootStyleInsertionAnchor(root)
    let last: HTMLStyleElement | null = null
    for (let i = styles.length - 1; i >= 0; i--) {
      const s = document.createElement('style')
      if (nonce) s.setAttribute('nonce', nonce)
      s.textContent = styles[i]

      root.insertBefore(s, last || insertionAnchor)
      last = s
      if (i === 0) {
        if (!parentComp) this._styleAnchors.set(this._def, s)
        if (owner) this._styleAnchors.set(owner, s)
      }

      // 开发环境额外记录 style 节点，给 HMR 回收和重建使用。
      if (__DEV__) {
        if (owner) {
          if (owner.__hmrId) {
            if (!this._childStyles) this._childStyles = new Map()
            let entry = this._childStyles.get(owner.__hmrId)
            if (!entry) {
              this._childStyles.set(owner.__hmrId, (entry = []))
            }
            entry.push(s)
          }
        } else {
          ;(this._styles || (this._styles = [])).push(s)
        }
      }
    }
  }

  private _getStyleAnchor(comp?: ConcreteComponent): HTMLStyleElement | null {
    // 样式锚点失效时要顺手清缓存，避免后续插入位置继续依赖脏引用。
    if (!comp) {
      return null
    }
    const anchor = this._styleAnchors.get(comp)
    if (anchor && anchor.parentNode === this.shadowRoot) {
      return anchor
    }
    if (anchor) {
      this._styleAnchors.delete(comp)
    }
    return null
  }

  private _getRootStyleInsertionAnchor(root: ShadowRoot): ChildNode | null {
    // 根组件样式默认插到 shadowRoot 中“第一段非 style 节点”之前，保证样式整体前置。
    for (let i = 0; i < root.childNodes.length; i++) {
      const node = root.childNodes[i]
      if (!(node instanceof HTMLStyleElement)) {
        return node
      }
    }
    return null
  }

  /**
   * Only called when shadowRoot is false
   */
  private _parseSlots() {
    // 非 shadow 模式下，需要手动把 light DOM 内容按 slot 名分组缓存起来。
    const slots: VueElement['_slots'] = (this._slots = {})
    let n
    while ((n = this.firstChild)) {
      const slotName =
        (n.nodeType === 1 && (n as Element).getAttribute('slot')) || 'default'
      ;(slots[slotName] || (slots[slotName] = [])).push(n)
      this.removeChild(n)
    }
  }

  /**
   * Only called when shadowRoot is false
   */
  private _renderSlots() {
    // 把缓存的 light DOM 内容重新分发到组件渲染出来的 `<slot>` 出口中。
    const outlets = this._getSlots()
    const scopeId = this._instance!.type.__scopeId
    for (let i = 0; i < outlets.length; i++) {
      const o = outlets[i] as HTMLSlotElement
      const slotName = o.getAttribute('name') || 'default'
      const content = this._slots![slotName]
      const parent = o.parentNode!
      if (content) {
        for (const n of content) {
          // for :slotted css
          if (scopeId && n.nodeType === 1) {
            // 非 shadow 模式下没有浏览器原生 slot 隔离，`:slotted` 相关作用域标记要手动补到整棵子树。
            const id = scopeId + '-s'
            const walker = document.createTreeWalker(n, 1)
            ;(n as Element).setAttribute(id, '')
            let child
            while ((child = walker.nextNode())) {
              ;(child as Element).setAttribute(id, '')
            }
          }
          parent.insertBefore(n, o)
        }
      } else {
        while (o.firstChild) parent.insertBefore(o.firstChild, o)
      }
      parent.removeChild(o)
    }
  }

  /**
   * @internal
   */
  private _getSlots(): HTMLSlotElement[] {
    const roots: Element[] = [this]
    if (this._teleportTargets) {
      // Teleport 传送出去的节点里也可能出现 slot 出口，要一并扫描。
      roots.push(...this._teleportTargets)
    }

    const slots = new Set<HTMLSlotElement>()
    for (const root of roots) {
      const found = root.querySelectorAll<HTMLSlotElement>('slot')
      for (let i = 0; i < found.length; i++) {
        slots.add(found[i])
      }
    }

    return Array.from(slots)
  }

  /**
   * @internal
   */
  _injectChildStyle(
    comp: ConcreteComponent & CustomElementOptions,
    parentComp?: ConcreteComponent,
  ): void {
    // 子组件在 custom element 内部也要把自己的样式注入到同一个 shadowRoot。
    this._applyStyles(comp.styles, comp, parentComp)
  }

  /**
   * @internal
   */
  _beginPatch(): void {
    // patch 期间先标记，避免 prop 反射和外部 setter 形成递归更新。
    this._patching = true
    this._dirty = false
  }

  /**
   * @internal
   */
  _endPatch(): void {
    this._patching = false
    if (this._dirty && this._instance) {
      // patch 过程中如果又积累了新的 prop 变化，结束后补一次统一更新。
      this._update()
    }
  }

  /**
   * @internal
   */
  _hasShadowRoot(): boolean {
    // `shadowRoot: false` 时，组件内容直接渲染在宿主元素 light DOM 中。
    return this._def.shadowRoot !== false
  }

  /**
   * @internal
   */
  _removeChildStyle(comp: ConcreteComponent): void {
    if (__DEV__) {
      this._styleChildren.delete(comp)
      this._styleAnchors.delete(comp)
      if (this._childStyles && comp.__hmrId) {
        // HMR 下子组件样式会被重建，旧样式节点要先从 shadowRoot 清掉。
        const oldStyles = this._childStyles.get(comp.__hmrId)
        if (oldStyles) {
          oldStyles.forEach(s => this._root.removeChild(s))
          oldStyles.length = 0
        }
      }
    }
  }
}

/**
 * 作用：在 `defineCustomElement` 组件内部拿到当前自定义元素宿主实例。
 */
export function useHost(caller?: string): VueElement | null {
  const instance = getCurrentInstance()
  const el = instance && (instance.ce as VueElement)
  if (el) {
    return el
  } else if (__DEV__) {
    if (!instance) {
      warn(
        `${caller || 'useHost'} called without an active component instance.`,
      )
    } else {
      warn(
        `${caller || 'useHost'} can only be used in components defined via ` +
          `defineCustomElement.`,
      )
    }
  }
  return null
}

/**
 * 作用：拿到当前自定义元素的 shadowRoot。
 */
export function useShadowRoot(): ShadowRoot | null {
  const el = __DEV__ ? useHost('useShadowRoot') : useHost()
  return el && el.shadowRoot
}
