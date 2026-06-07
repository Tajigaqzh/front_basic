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
  /**
   * 在当前组件实例上提供一个可被后代注入的值。
   *
   * 主要功能：
   * - 把 `key -> value` 挂到当前实例的 `provides`
   * - 首次 provide 时从父级 `provides` 分裂出一层新对象
   * - 让后代组件后续可通过 `inject(key)` 读取
   *
   * 参数：
   * - `key`：注入 key，可以是字符串或 symbol
   * - `value`：要向后代暴露的值
   */
  if (currentInstance) {
    // `provides` 默认直接继承父组件，只有真正 provide 时才分裂出自己的对象。
    let provides = currentInstance.provides
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      // 首次 provide 时才从父级 provides 派生出自己的对象，节省没有 provide 组件的额外对象开销。
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
  /**
   * 从最近的祖先 provide 链或应用级 provide 中读取注入值。
   *
   * 主要功能：
   * - 以当前组件或当前应用为起点查找 `provides`
   * - 找到时直接返回对应值
   * - 找不到但提供了默认值时，返回默认值或默认值工厂结果
   *
   * 参数：
   * - `key`：要查找的注入 key
   * - `defaultValue`：可选默认值
   * - `treatDefaultAsFactory`：默认值是否按工厂函数执行
   */
  // `getCurrentInstance()` 内部会兼容函数式组件渲染阶段的读取场景。
  const instance = getCurrentInstance()

  if (instance || currentApp) {
    // `provides` 指向本次查找的起点，它可能来自应用上下文，也可能来自父组件。
    // `provides` 表示本次注入查找的起点容器：
    // - `app.provide()` 场景来自应用上下文
    // - 组件场景来自最近祖先组件
    let provides = currentApp
      ? currentApp._context.provides
      : instance
        ? instance.parent == null || instance.ce
          ? instance.vnode.appContext && instance.vnode.appContext.provides
          : instance.parent.provides
        : undefined
    // 根组件或自定义元素实例要从 appContext.provides 起步；
    // 普通组件则直接沿最近父组件 provides 原型链向上查找。

    if (provides && (key as string | symbol) in provides) {
      // 使用 `in` 而不是 `hasOwn`，这样可以自然沿着 provides 的原型链命中祖先 provide。
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
  /**
   * 判断当前上下文里是否允许安全调用 `inject()`。
   *
   * 返回 true 的两种场景：
   * - 当前存在活跃组件实例
   * - 当前存在活跃应用上下文
   */
  return !!(getCurrentInstance() || currentApp)
}
