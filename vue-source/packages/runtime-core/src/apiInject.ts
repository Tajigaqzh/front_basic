/**
 * 文件作用：实现依赖注入 API。
 *
 * 这份文件负责 `provide` / `inject`，让祖先组件或应用实例可以向后代传递数据，
 * 避免层层 props 透传。
 */

import { isFunction } from '@vue-source/shared'
import { currentInstance, getCurrentInstance } from './component'
import { currentApp } from './apiCreateApp'

interface InjectionConstraint<T> {}

export type InjectionKey<T> = symbol & InjectionConstraint<T>

/**
 * 作用：把值挂到当前组件实例的 `provides` 上，供后代 `inject` 获取。
 */
export function provide<T, K = InjectionKey<T> | string | number>(
  key: K,
  value: K extends InjectionKey<infer V> ? V : T,
): void {
  if (currentInstance) {
    // `provides` 默认直接继承父组件，只有真正 provide 时才分裂出自己的对象。
    let provides = currentInstance.provides
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    provides[key as string] = value
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false,
): T
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true,
): T
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false,
) {
  // `getCurrentInstance()` 内部会兼容函数式组件渲染阶段的读取场景。
  const instance = getCurrentInstance()

  if (instance || currentApp) {
    // `provides` 指向本次查找的起点，它可能来自应用上下文，也可能来自父组件。
    let provides = currentApp
      ? currentApp._context.provides
      : instance
        ? instance.parent == null || instance.ce
          ? instance.vnode.appContext && instance.vnode.appContext.provides
          : instance.parent.provides
        : undefined

    if (provides && (key as string | symbol) in provides) {
      return provides[key as string]
    } else if (arguments.length > 1) {
      // 默认值既可以是字面量，也可以是延迟执行的工厂函数。
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance && instance.proxy)
        : defaultValue
    }
  }
}

/**
 * 作用：判断当前上下文里是否允许安全地调用 `inject()`。
 */
export function hasInjectionContext(): boolean {
  return !!(getCurrentInstance() || currentApp)
}
