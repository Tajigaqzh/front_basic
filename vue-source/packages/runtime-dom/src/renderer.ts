import {
  type App,
  type CreateAppFunction,
  type ElementNamespace,
  type HydrationRenderer,
  type Renderer,
  type RootHydrateFunction,
  type RootRenderFunction,
  DeprecationTypes,
  compatUtils,
  createHydrationRenderer,
  createRenderer,
  isRuntimeOnly,
  warn,
} from '@vue-source/runtime-core'
import { extend, isFunction, isMathMLTag, isString } from '@vue-source/shared'
import { isHTMLTag, isSVGTag } from '@vue-source/shared'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'

/**
 * 文件作用：组装浏览器环境下的 renderer / hydration renderer。
 *
 * 这份文件位于 runtime-core 和真实 DOM 宿主能力之间，负责：
 * - 把 `nodeOps + patchProp` 交给 `createRenderer`
 * - 导出浏览器版 `render / hydrate / createApp / createSSRApp`
 * - 在应用挂载时补齐容器归一化、命名空间判断、runtime-only 告警等平台细节
 *
 * 调用链可以概括为：
 * - 用户调用 `createApp(...).mount(...)`
 * - 这里先把挂载目标规范成真实容器
 * - 再进入 runtime-core renderer
 * - runtime-core 后续通过 `rendererOptions` 反向调用 DOM 宿主实现
 */

// `rendererOptions` 就是传给 runtime-core `createRenderer` 的宿主实现集合。
// 其中：
// - `nodeOps` 负责创建、插入、删除、查找真实 DOM 节点
// - `patchProp` 负责 class/style/attrs/events/DOM props 的更新分发
const rendererOptions = /*@__PURE__*/ extend({ patchProp }, nodeOps)

// 懒创建 renderer，只有真的调用 render/createApp 等 API 时才实例化。
// 这样如果用户只引入响应式 API，渲染器代码就有机会被 tree-shaking 掉。
let renderer: Renderer<Element | ShadowRoot> | HydrationRenderer

// 是否已经切换到 hydration renderer；一旦启用，后续要复用同一套带 hydrate 能力的 renderer。
let enabledHydration = false

/**
 * 按需创建普通浏览器 renderer。
 *
 * 这里只负责“首次装配”，真正的 patch / diff / 组件更新逻辑都在 runtime-core 内部。
 */
function ensureRenderer() {
  return (
    renderer ||
    (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  )
}

/**
 * 按需创建带 hydration 能力的 renderer。
 *
 * 一旦某次走过 SSR 激活路径，后续必须持续复用同一套 hydration renderer，
 * 避免普通 renderer 和 hydration renderer 的内部状态来源不一致。
 */
function ensureHydrationRenderer() {
  // 一旦切到 hydration renderer，后续必须持续复用它，避免普通 renderer / hydration renderer 混用。
  renderer = enabledHydration
    ? renderer
    : createHydrationRenderer(rendererOptions)
  enabledHydration = true
  return renderer as HydrationRenderer
}

// use explicit type casts here to avoid import() calls in rolled-up d.ts
export const render = ((...args) => {
  // 纯客户端渲染入口：确保拿到普通 renderer，再把调用转交给 runtime-core。
  ensureRenderer().render(...args)
}) as RootRenderFunction<Element | ShadowRoot>

export const hydrate = ((...args) => {
  // SSR 激活入口：必须走 hydration renderer，让现有 DOM 与 vnode 树建立对应关系。
  ensureHydrationRenderer().hydrate(...args)
}) as RootHydrateFunction

export const createApp = ((...args) => {
  // 浏览器默认应用入口走普通 renderer，而不是 hydration renderer。
  const app = ensureRenderer().createApp(...args)

  if (__DEV__) {
    injectNativeTagCheck(app)
    injectCompilerOptionsCheck(app)
  }

  const { mount } = app
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    // 允许用户传选择器字符串，因此先统一归一化成真实容器节点。
    const container = normalizeContainer(containerOrSelector)
    if (!container) return

    const component = app._component
    if (!isFunction(component) && !component.render && !component.template) {
      // 根组件既没 render 也没 template 时，浏览器运行时会退回到容器现有 HTML 作为模板来源。
      // __UNSAFE__
      // Reason: potential execution of JS expressions in in-DOM template.
      // The user must make sure the in-DOM template is trusted. If it's
      // rendered by the server, the template should not contain any user data.
      component.template = container.innerHTML
      if (__COMPAT__ && __DEV__ && container.nodeType === 1) {
        for (let i = 0; i < (container as Element).attributes.length; i++) {
          const attr = (container as Element).attributes[i]
          if (attr.name !== 'v-cloak' && /^(?:v-|:|@)/.test(attr.name)) {
            compatUtils.warnDeprecation(
              DeprecationTypes.GLOBAL_MOUNT_CONTAINER,
              null,
            )
            break
          }
        }
      }
    }

    if (container.nodeType === 1) {
      // 普通客户端挂载前先清空容器，避免旧 DOM 干扰首次 patch。
      container.textContent = ''
    }
    // 第三个参数是根命名空间，决定根节点从一开始按 html/svg/mathml 哪套宿主规则创建。
    const proxy = mount(container, false, resolveRootNamespace(container))
    if (container instanceof Element) {
      container.removeAttribute('v-cloak')
      container.setAttribute('data-v-app', '')
    }
    return proxy
  }

  return app
}) as CreateAppFunction<Element>

export const createSSRApp = ((...args) => {
  // SSR 应用默认要拿到 hydration renderer，后续 mount 才会“激活已有 DOM”而不是重建 DOM。
  const app = ensureHydrationRenderer().createApp(...args)

  if (__DEV__) {
    injectNativeTagCheck(app)
    injectCompilerOptionsCheck(app)
  }

  const { mount } = app
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    const container = normalizeContainer(containerOrSelector)
    if (container) {
      // 第二个参数传 `true`，明确告诉 runtime-core 这次走 hydration。
      return mount(container, true, resolveRootNamespace(container))
    }
  }

  return app
}) as CreateAppFunction<Element>

function resolveRootNamespace(
  container: Element | ShadowRoot,
): ElementNamespace {
  // 根容器若本身处于 SVG / MathML 命名空间，整棵子树默认都应沿用对应宿主规则。
  if (container instanceof SVGElement) {
    return 'svg'
  }
  if (
    typeof MathMLElement === 'function' &&
    container instanceof MathMLElement
  ) {
    return 'mathml'
  }
}

/**
 * 给 `app.config` 注入浏览器原生标签判断能力。
 *
 * 这主要服务于开发期组件名校验，避免把 `div/svg/math` 这类原生标签误判成组件。
 */
function injectNativeTagCheck(app: App) {
  Object.defineProperty(app.config, 'isNativeTag', {
    value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag) || isMathMLTag(tag),
    writable: false,
  })
}

/**
 * 在 runtime-only 构建里拦截不应于运行时生效的编译器配置。
 *
 * 原因是：
 * - 这类构建不携带模板编译器
 * - 因此 `compilerOptions` / 老的 `isCustomElement` 入口不会真正参与编译
 * - 开发期需要尽早给出明确告警，避免用户误以为配置已经生效
 */
function injectCompilerOptionsCheck(app: App) {
  if (isRuntimeOnly()) {
    const isCustomElement = app.config.isCustomElement
    Object.defineProperty(app.config, 'isCustomElement', {
      get() {
        return isCustomElement
      },
      set() {
        warn(
          `The \`isCustomElement\` config option is deprecated. Use ` +
            `\`compilerOptions.isCustomElement\` instead.`,
        )
      },
    })

    const compilerOptions = app.config.compilerOptions
    const msg =
      `The \`compilerOptions\` config option is only respected when using ` +
      `a build of Vue.js that includes the runtime compiler (aka "full build"). ` +
      `Since you are using the runtime-only build, \`compilerOptions\` ` +
      `must be passed to \`@vue-source/compiler-dom\` in the build setup instead.\n` +
      `- For vue-loader: pass it via vue-loader's \`compilerOptions\` loader option.\n` +
      `- For vue-cli: see https://cli.vuejs.org/guide/webpack.html#modifying-options-of-a-loader\n` +
      `- For vite: pass it via @vitejs/plugin-vue options. See https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue#example-for-passing-options-to-vuecompiler-sfc`

    Object.defineProperty(app.config, 'compilerOptions', {
      get() {
        warn(msg)
        return compilerOptions
      },
      set() {
        warn(msg)
      },
    })
  }
}

/**
 * 把用户传入的挂载目标归一化成真实容器。
 *
 * 支持输入：
 * - CSS 选择器字符串
 * - `Element`
 * - `ShadowRoot`
 */
function normalizeContainer(
  container: Element | ShadowRoot | string,
): Element | ShadowRoot | null {
  if (isString(container)) {
    const res = document.querySelector(container)
    if (__DEV__ && !res) {
      warn(
        `Failed to mount app: mount target selector "${container}" returned null.`,
      )
    }
    return res
  }
  if (
    __DEV__ &&
    window.ShadowRoot &&
    container instanceof window.ShadowRoot &&
    container.mode === 'closed'
  ) {
    warn(
      `mounting on a ShadowRoot with \`{mode: "closed"}\` may lead to unpredictable bugs`,
    )
  }
  return container as any
}
