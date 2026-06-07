/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 resolveAssets.ts 负责在渲染上下文中按名称解析组件、指令和 compat filter。
 *
 * 它主要服务于编译产物里的 `resolveComponent`、`resolveDirective`、`:is` 等调用，
 * 是“模板里的字符串名字”进入真实运行时定义的关键桥接层。
 */

import {
  type ComponentOptions,
  type ConcreteComponent,
  currentInstance,
  getComponentName,
} from '../component'
import { currentRenderingInstance } from '../componentRenderContext'
import type { Directive } from '../directives'
import { camelize, capitalize, isString } from '@vue-source/shared'
import { warn } from '../warning'
import type { VNodeTypes } from '../vnode'

export const COMPONENTS = 'components'
export const DIRECTIVES = 'directives'
export const FILTERS = 'filters'

export type AssetTypes = typeof COMPONENTS | typeof DIRECTIVES | typeof FILTERS

/**
 * 作用：在当前渲染上下文里按名字解析组件资源。
 *
 * 返回值：
 * - 找到就返回组件定义。
 * - 找不到时返回原始字符串，让后续 vnode 创建链自己决定如何处理。
 */
export function resolveComponent(
  name: string,
  maybeSelfReference?: boolean,
): ConcreteComponent | string {
  return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name
}

export const NULL_DYNAMIC_COMPONENT: unique symbol = Symbol.for('v-ndc')

/**
 * 作用：解析动态组件 `:is` 的值。
 *
 * 字符串会继续走组件注册表解析；
 * 非字符串则直接当成 vnode type 使用；
 * 空值则回退到内部的 `NULL_DYNAMIC_COMPONENT` 哨兵。
 */
export function resolveDynamicComponent(component: unknown): VNodeTypes {
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
  } else {
    // invalid types will fallthrough to createVNode and raise warning
    return (component || NULL_DYNAMIC_COMPONENT) as any
  }
}

/**
 * 作用：在当前渲染上下文里按名字解析指令资源。
 */
export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset(DIRECTIVES, name)
}

/**
 * 作用：兼容 Vue 2 的 filter 解析入口。
 */
export function resolveFilter(name: string): Function | undefined {
  return resolveAsset(FILTERS, name)
}

/**
 * @private
 * overload 1: components
 */
function resolveAsset(
  type: typeof COMPONENTS,
  name: string,
  warnMissing?: boolean,
  maybeSelfReference?: boolean,
): ConcreteComponent | undefined
// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string,
): Directive | undefined
// implementation
// overload 3: filters (compat only)
function resolveAsset(type: typeof FILTERS, name: string): Function | undefined
// implementation
function resolveAsset(
  type: AssetTypes,
  name: string,
  warnMissing = true,
  maybeSelfReference = false,
) {
  // 优先取“当前正在渲染的组件实例”，找不到再退到普通 currentInstance。
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    const Component = instance.type

    // 组件自引用优先级最高，避免局部/全局同名注册把自己覆盖掉。
    if (type === COMPONENTS) {
      const selfName = getComponentName(
        Component,
        false /* do not include inferred name to avoid breaking existing code */,
      )
      if (
        selfName &&
        (selfName === name ||
          selfName === camelize(name) ||
          selfName === capitalize(camelize(name)))
      ) {
        return Component
      }
    }

    const res =
      // Options API 解析过的局部注册优先。
      resolve(instance[type] || (Component as ComponentOptions)[type], name) ||
      // 找不到再回退到 appContext 全局注册表。
      resolve(instance.appContext[type], name)

    if (!res && maybeSelfReference) {
      // 某些编译产物会允许隐式自引用，这里作为最后兜底。
      return Component
    }

    if (__DEV__ && warnMissing && !res) {
      const extra =
        type === COMPONENTS
          ? `\nIf this is a native custom element, make sure to exclude it from ` +
            `component resolution via compilerOptions.isCustomElement.`
          : ``
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}${extra}`)
    }

    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`,
    )
  }
}

/**
 * 作用：在某个资源注册表里按原名、camelCase、PascalCase 三种形式做匹配。
 */
function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}
