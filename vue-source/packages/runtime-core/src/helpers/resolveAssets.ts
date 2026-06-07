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

// 三个常量直接对应组件实例 / appContext 上的资源注册表字段名。
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

// 动态组件传入空值时的内部哨兵，后续 createVNode 会把它当成“渲染空节点”处理。
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
    // 非字符串场景说明用户直接传入了组件对象 / 函数 / 特殊 vnode type。
    // 空值则回退成内部哨兵，后续 createVNode 会把它转成注释占位。
    return (component || NULL_DYNAMIC_COMPONENT) as any
  }
}

/**
 * 作用：在当前渲染上下文里按名字解析指令资源。
 */
export function resolveDirective(name: string): Directive | undefined {
  // 指令不存在“字符串兜底继续渲染”的语义，找不到就直接返回 undefined。
  return resolveAsset(DIRECTIVES, name)
}

/**
 * 作用：兼容 Vue 2 的 filter 解析入口。
 */
export function resolveFilter(name: string): Function | undefined {
  // filter 仅存在于 compat 模式，仍复用统一资源解析入口。
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
  /**
   * 按名称解析运行时资源。
   *
   * 主要功能：
   * - 优先解析组件自引用
   * - 再查局部注册
   * - 再查应用级全局注册
   * - 必要时对组件场景兜底自引用
   *
   * 参数：
   * - `type`：要解析的资源类型，如组件/指令/filter
   * - `name`：模板里写下的资源名
   * - `warnMissing`：找不到时是否给出告警
   * - `maybeSelfReference`：是否允许把当前组件本身作为最后兜底结果
   */
  // 优先取“当前正在渲染的组件实例”，找不到再退到普通 currentInstance。
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    // `Component` 表示当前实例对应的组件定义，也是自引用兜底时要返回的目标。
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

    // `res` 表示本次最终命中的运行时资源定义。
    const res =
      // Options API 解析过的局部注册优先。
      resolve(instance[type] || (Component as ComponentOptions)[type], name) ||
      // 找不到再回退到 appContext 全局注册表。
      resolve(instance.appContext[type], name)

    if (!res && maybeSelfReference) {
      // 某些编译产物会允许隐式自引用，这里作为最后兜底。
      // 例如组件模板里直接写自己的名字，而没有显式在 components 里再次注册自己。
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
  /**
   * 在单个资源注册表里按多种命名风格尝试匹配。
   *
   * 匹配顺序：
   * - 原始名字
   * - camelCase
   * - PascalCase
   *
   * 这样模板里写 `foo-bar`、`fooBar`、`FooBar` 都有机会命中同一资源定义。
   */
  return (
    registry &&
    // 三种命名风格都尝试一次，兼容模板命名与 JS 注册名风格不完全一致的情况。
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}
