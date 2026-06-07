/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 component.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import { isFunction, isObject } from '@vue-source/shared'
import type { Component, ComponentInternalInstance } from '../component'
import {
  DeprecationTypes,
  checkCompatEnabled,
  softAssertCompatEnabled,
} from './compatConfig'
import { convertLegacyAsyncComponent } from './componentAsync'
import { convertLegacyFunctionalComponent } from './componentFunctional'

/**
 * 作用：把 Vue 2 风格组件定义转换成 Vue 3 运行时可直接消费的组件对象。
 *
 * 参数说明：
 * - `comp`：原始组件定义，可能是 2.x 构造器、异步工厂函数、functional 组件对象等。
 * - `instance`：当前解析上下文中的组件实例，用于 compat 配置判断。
 *
 * 依赖关系：
 * - 异步组件会转给 `convertLegacyAsyncComponent`。
 * - functional 组件会转给 `convertLegacyFunctionalComponent`。
 */
export function convertLegacyComponent(
  comp: any,
  instance: ComponentInternalInstance | null,
): Component {
  if (comp.__isBuiltIn) {
    return comp
  }

  // Vue 2 `Vue.extend()` 返回的是构造器函数，这里先还原成 options 对象。
  if (isFunction(comp) && comp.cid) {
    // #7766
    if (comp.render) {
      // only necessary when compiled from SFC
      comp.options.render = comp.render
    }
    // copy over internal properties set by the SFC compiler
    comp.options.__file = comp.__file
    comp.options.__hmrId = comp.__hmrId
    comp.options.__scopeId = comp.__scopeId
    comp = comp.options
  }

  // Vue 2 异步组件工厂函数在 compat 下转成 Vue 3 `defineAsyncComponent` 结果。
  if (
    isFunction(comp) &&
    checkCompatEnabled(DeprecationTypes.COMPONENT_ASYNC, instance, comp)
  ) {
    // since after disabling this, plain functions are still valid usage, do not
    // use softAssert here.
    return convertLegacyAsyncComponent(comp)
  }

  // Vue 2 `functional: true` 组件对象在 compat 下转成 Vue 3 函数组件。
  if (
    isObject(comp) &&
    comp.functional &&
    softAssertCompatEnabled(
      DeprecationTypes.COMPONENT_FUNCTIONAL,
      instance,
      comp,
    )
  ) {
    return convertLegacyFunctionalComponent(comp)
  }

  return comp
}
