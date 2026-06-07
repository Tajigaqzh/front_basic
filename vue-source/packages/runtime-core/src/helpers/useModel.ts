/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 useModel.ts 负责在组件内部构造与 `v-model` 协议对齐的可读写 ref。
 *
 * 它把“父传 props + 子发 update 事件”这一套约定，
 * 折叠成 setup 内部可以直接读写的一个 ref，是 `defineModel` 和手写 `useModel` 的底层实现。
 */

import { type Ref, customRef, ref } from '@vue-source/reactivity'
import { EMPTY_OBJ, camelize, hasChanged, hyphenate } from '@vue-source/shared'
import type { DefineModelOptions, ModelRef } from '../apiSetupHelpers'
import { getCurrentInstance } from '../component'
import { warn } from '../warning'
import type { NormalizedProps } from '../componentProps'
import { watchSyncEffect } from '../apiWatch'

/**
 * 作用：在组件内部创建与 `v-model` 对应的可读写 ref。
 *
 * 它既能在父组件传入 `v-model` 时转发 `update:xxx` 事件，
 * 也能在没有外部绑定时退化成组件内部本地状态。
 */
export function useModel<
  M extends PropertyKey,
  T extends Record<string, any>,
  K extends keyof T,
  G = T[K],
  S = T[K],
>(
  props: T,
  name: K,
  options?: DefineModelOptions<T[K], G, S>,
): ModelRef<T[K], M, G, S>
export function useModel(
  props: Record<string, any>,
  name: string,
  options: DefineModelOptions = EMPTY_OBJ,
): Ref {
  /**
   * 在组件内部创建一个遵循 `v-model` 协议的可读写 ref。
   *
   * 主要功能：
   * - 读取时代理到当前 model prop
   * - 写入时发出 `update:xxx` 事件
   * - 没有父级 v-model 绑定时退化成组件内部本地状态
   * - 支持 get/set 转换器以及 model modifiers
   *
   * 参数：
   * - `props`：当前组件 props
   * - `name`：model 对应的 prop 名
   * - `options`：可选的 get/set 转换器配置
   */
  const i = getCurrentInstance()!
  if (__DEV__ && !i) {
    warn(`useModel() called without active instance.`)
    return ref() as any
  }

  // `camelizedName` / `hyphenatedName` 用来兼容模板侧不同命名风格的 model prop / 监听器。
  const camelizedName = camelize(name)
  if (__DEV__ && !(i.propsOptions[0] as NormalizedProps)[camelizedName]) {
    warn(`useModel() called with prop "${name}" which is not declared.`)
    return ref() as any
  }

  const hyphenatedName = hyphenate(name)
  // `modifiers` 保存父组件通过 `v-model.xxx` 传进来的修饰符配置。
  const modifiers = getModelModifiers(props, camelizedName)

  const res = customRef((track, trigger) => {
    // `localValue` 是当前 ref 暂存的值；当父组件没传 v-model 时，它就承担本地状态职责。
    let localValue: any
    // 这两个值用来判断“本地 setter 转换后是否还需要强制触发一次更新”。
    let prevSetValue: any = EMPTY_OBJ
    let prevEmittedValue: any

    watchSyncEffect(() => {
      const propValue = props[camelizedName]
      if (hasChanged(localValue, propValue)) {
        // 父组件一旦回推了新的 model prop，这个 ref 要立刻和外部值重新对齐。
        localValue = propValue
        trigger()
      }
    })

    return {
      get() {
        // 读取时仍要让自定义 ref 参与依赖收集，保证模板和 computed 能正确追踪它。
        track()
        return options.get ? options.get(localValue) : localValue
      },

      set(value) {
        // `emittedValue` 是真正通过 `update:xxx` 发给父组件的值，
        // 可能经过 `options.set` 转换。
        const emittedValue = options.set ? options.set(value) : value
        if (
          !hasChanged(emittedValue, localValue) &&
          !(prevSetValue !== EMPTY_OBJ && hasChanged(value, prevSetValue))
        ) {
          return
        }
        const rawProps = i.vnode!.props
        if (
          !(
            rawProps &&
            // check if parent has passed v-model
            (name in rawProps ||
              camelizedName in rawProps ||
              hyphenatedName in rawProps) &&
            (`onUpdate:${name}` in rawProps ||
              `onUpdate:${camelizedName}` in rawProps ||
              `onUpdate:${hyphenatedName}` in rawProps)
          )
        ) {
          // 没有外部 v-model 监听时，当前 ref 退化成单纯的本地可写状态。
          // 这让 `useModel` 即使在父组件未绑定时也仍然能像普通 ref 一样工作。
          localValue = value
          trigger()
        }

        i.emit(`update:${name}`, emittedValue)
        // setter 改写了值，但 emit 给父组件的值又没变化时，父组件不会回推 props，
        // 这里要自己补一次 trigger，避免本地输入态和显示态不同步。
        if (
          hasChanged(value, emittedValue) &&
          hasChanged(value, prevSetValue) &&
          !hasChanged(emittedValue, prevEmittedValue)
        ) {
          trigger()
        }
        prevSetValue = value
        prevEmittedValue = emittedValue
      },
    }
  })

  type RuntimeModelRef = ModelRef<any, any, any, any>

  // 这里实现了 `const [model, modifiers] = useModel(...)` 这种可迭代解构语法。
  ;(res as RuntimeModelRef)[Symbol.iterator] = () => {
    const values = [res as RuntimeModelRef, modifiers || EMPTY_OBJ]
    let index = 0
    const iterator: ArrayIterator<RuntimeModelRef | Record<any, true | undefined>> = {
      next(): IteratorResult<
        RuntimeModelRef | Record<any, true | undefined>,
        undefined
      > {
        if (index < values.length) {
          // 第一次返回 model ref，第二次返回 modifiers，模拟“二元组”解构体验。
          return { value: values[index++] as RuntimeModelRef | Record<any, true | undefined>, done: false }
        }
        return { value: undefined, done: true }
      },
      [Symbol.iterator]() {
        return iterator
      },
    }
    return iterator
  }

  return res as RuntimeModelRef
}

/**
 * 作用：按 `modelValue` / `fooModifiers` / `foo-modifiers` 这些约定读取 v-model 修饰符。
 */
export const getModelModifiers = (
  props: Record<string, any>,
  modelName: string,
): Record<string, boolean> | undefined => {
  /**
   * 读取某个 model 对应的修饰符对象。
   *
   * 支持读取：
   * - `modelModifiers`
   * - `fooModifiers`
   * - `foo-modifiers` 编译后对应的多种命名形式
   */
  return modelName === 'modelValue' || modelName === 'model-value'
    ? props.modelModifiers
    : props[`${modelName}Modifiers`] ||
        props[`${camelize(modelName)}Modifiers`] ||
        props[`${hyphenate(modelName)}Modifiers`]
}
