/**
 * 文件作用：runtime-dom 的总入口。
 *
 * 这份文件负责把 `nodeOps` 和 `patchProp` 组合成浏览器版 renderer，
 * 并导出 `render`、`hydrate`、`createApp`、`createSSRApp`。
 *
 * 可以把它理解成“runtime-core 渲染器 + 浏览器 DOM 宿主能力”的装配层。
 */

import {
  type DefineComponent,
  type Directive,
} from '@vue-source/runtime-core'
export { nodeOps } from './nodeOps'
export { patchProp } from './patchProp'
import { NOOP } from '@vue-source/shared'
import type { TransitionProps } from './components/Transition'
import type { TransitionGroupProps } from './components/TransitionGroup'
import type { vShow } from './directives/vShow'
import type { VOnDirective } from './directives/vOn'
import type { VModelDirective } from './directives/vModel'
import type { ClassValue, StyleValue } from './jsx'

/**
 * This is a stub implementation to prevent the need to use dom types.
 *
 * To enable proper types, add `"dom"` to `"lib"` in your `tsconfig.json`.
 */
type DomType<T> = typeof globalThis extends { window: unknown } ? T : never

declare module '@vue-source/reactivity' {
  export interface RefUnwrapBailTypes {
    runtimeDOMBailTypes: DomType<Node | Window>
  }
}

declare module '@vue-source/runtime-core' {
  interface AllowedAttrs {
    class?: ClassValue
    style?: StyleValue
  }

  interface GlobalComponents {
    Transition: DefineComponent<TransitionProps>
    TransitionGroup: DefineComponent<TransitionGroupProps>
  }

  interface GlobalDirectives {
    vShow: typeof vShow
    vOn: VOnDirective
    vBind: VModelDirective
    vIf: Directive<any, boolean>
    vOnce: Directive
    vSlot: Directive
  }
}

export { createApp, createSSRApp, hydrate, render } from './renderer'

// Custom element support
export {
  defineCustomElement,
  defineSSRCustomElement,
  useShadowRoot,
  useHost,
  VueElement,
  type VueElementConstructor,
  type CustomElementOptions,
} from './apiCustomElement'

// SFC CSS utilities
export { useCssModule } from './helpers/useCssModule'
export { useCssVars } from './helpers/useCssVars'

// DOM-only components
export { Transition, type TransitionProps } from './components/Transition'
export {
  TransitionGroup,
  type TransitionGroupProps,
} from './components/TransitionGroup'

// 这里导出的 helper / 指令，正好对应 compiler-dom/runtimeHelpers.ts 里注册的名称：
// - `vModelText` / `vModelCheckbox` / ...
// - `withModifiers` / `withKeys`
// - `vShow`
// - `Transition` / `TransitionGroup`
//
// 也就是说，编译阶段产出的 helper 名，最终都会在这里找到运行时落点。
// **Internal** DOM-only runtime directive helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic,
} from './directives/vModel'
export { withModifiers, withKeys } from './directives/vOn'
export { vShow } from './directives/vShow'

import { initVModelForSSR } from './directives/vModel'
import { initVShowForSSR } from './directives/vShow'

let ssrDirectiveInitialized = false

/**
 * @internal
 */
export const initDirectivesForSSR: () => void = __SSR__
  ? () => {
      if (!ssrDirectiveInitialized) {
        // SSR 指令辅助只需初始化一次，避免重复改写同一批共享逻辑。
        // 这些初始化主要是给服务端渲染补 getSSRProps 等分支。
        ssrDirectiveInitialized = true
        initVModelForSSR()
        initVShowForSSR()
      }
    }
  : NOOP

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue-source/runtime-core'

export * from './jsx'
