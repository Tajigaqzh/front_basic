/**
 * 文件作用：处理组件事件派发与 emits 选项。
 *
 * 这份文件负责 `emit()` 运行时行为、事件名规范化、参数校验路径和事件是否声明等能力。
 */

import {
  EMPTY_OBJ,
  type OverloadParameters,
  type UnionToIntersection,
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isObject,
  isOn,
  isString,
  looseToNumber,
  toHandlerKey,
} from '@vue-source/shared'
import {
  type ComponentInternalInstance,
  type ComponentOptions,
  type ConcreteComponent,
  formatComponentName,
} from './component'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import { warn } from './warning'
import { devtoolsComponentEmit } from './devtools'
import type { AppContext } from './apiCreateApp'
import { emit as compatInstanceEmit } from './compat/instanceEventEmitter'
import {
  compatModelEmit,
  compatModelEventPrefix,
} from './compat/componentVModel'
import type { ComponentTypeEmits } from './apiSetupHelpers'
import { getModelModifiers } from './helpers/useModel'
import type { ComponentPublicInstance } from './componentPublicInstance'

export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null
>
// 对象写法的 emits 值要么是校验函数，要么是 null：
// - 函数表示“声明事件 + 校验参数”
// - null 表示“只声明事件名，不做参数校验”

export type EmitsOptions = ObjectEmitsOptions | string[]

export type EmitsToProps<T extends EmitsOptions | ComponentTypeEmits> =
  T extends string[]
    ? {
        [K in `on${Capitalize<T[number]>}`]?: (...args: any[]) => any
      }
    : T extends ObjectEmitsOptions
      ? {
          [K in string & keyof T as `on${Capitalize<K>}`]?: (
            ...args: T[K] extends (...args: infer P) => any
              ? P
              : T[K] extends null
                ? any[]
                : never
          ) => any
        }
      : {}

export type TypeEmitsToOptions<T extends ComponentTypeEmits> = {
  [K in keyof T & string]: T[K] extends [...args: infer Args]
    ? (...args: Args) => any
    : () => any
} & (T extends (...args: any[]) => any
  ? ParametersToFns<OverloadParameters<T>>
  : {})

type ParametersToFns<T extends any[]> = {
  [K in T[0]]: IsStringLiteral<K> extends true
    ? (
        ...args: T extends [e: infer E, ...args: infer P]
          ? K extends E
            ? P
            : never
          : never
      ) => any
    : never
}

type IsStringLiteral<T> = T extends string
  ? string extends T
    ? false
    : true
  : false

export type ShortEmitsToObject<E> =
  E extends Record<string, any[]>
    ? {
        [K in keyof E]: (...args: E[K]) => any
      }
    : E

export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options,
> =
  Options extends Array<infer V>
    ? (event: V, ...args: any[]) => void
    : {} extends Options // if the emit is empty object (usually the default value for emit) should be converted to function
      ? (event: string, ...args: any[]) => void
      : UnionToIntersection<
          {
            [key in Event]: Options[key] extends (...args: infer Args) => any
              ? (event: key, ...args: Args) => void
              : Options[key] extends any[]
                ? (event: key, ...args: Options[key]) => void
                : (event: key, ...args: any[]) => void
          }[Event]
        >

/**
 * 作用：触发组件自定义事件，并分发到父组件传入的监听函数。
 *
 * 参数说明：
 * - `instance`：事件来源组件实例。
 * - `event`：事件名。
 * - `rawArgs`：事件参数列表。
 *
 * 依赖关系：
 * - 会校验 `emits` 声明。
 * - 会处理 `v-model` 修饰符、`Once` 监听器和兼容模式事件链路。
 */
export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
): ComponentPublicInstance | null | undefined {
  /**
   * 触发组件自定义事件。
   *
   * 主要功能：
   * - 校验事件是否在 `emits` 中声明
   * - 处理 `update:xxx` 对应的 v-model 修饰符
   * - 从组件 vnode props 中找到父组件传入的监听函数并执行
   * - 支持 `Once` 监听器和兼容模式事件链路
   *
   * 参数：
   * - `instance`：事件来源组件实例
   * - `event`：事件名
   * - `rawArgs`：事件参数
   */
  if (instance.isUnmounted) return
  const props = instance.vnode.props || EMPTY_OBJ

  if (__DEV__) {
    const {
      emitsOptions,
      propsOptions: [propsOptions],
    } = instance
    if (emitsOptions) {
      if (
        !(event in emitsOptions) &&
        !(
          __COMPAT__ &&
          (event.startsWith('hook:') ||
            event.startsWith(compatModelEventPrefix))
        )
      ) {
        if (!propsOptions || !(toHandlerKey(camelize(event)) in propsOptions)) {
          // 如果既没在 emits 声明，也没声明成 onXxx prop，说明父子事件契约很可能写错了。
          warn(
            `Component emitted event "${event}" but it is neither declared in ` +
              `the emits option nor as an "${toHandlerKey(camelize(event))}" prop.`,
          )
        }
      } else {
        const validator = emitsOptions[event]
        if (isFunction(validator)) {
          // emits 对象里的函数不是监听器，而是“开发期参数校验器”。
          const isValid = validator(...rawArgs)
          if (!isValid) {
            warn(
              `Invalid event arguments: event validation failed for event "${event}".`,
            )
          }
        }
      }
    }
  }

  // `args` 是最终真正传给父组件监听器的参数。
  // 对于 v-model，它可能会先被 trim / number 修饰符改写。
  let args = rawArgs
  const isCompatModelListener =
    __COMPAT__ && compatModelEventPrefix + event in props
  // `update:xxx` 事件需要识别出对应的 v-model 修饰符。
  const isModelListener = isCompatModelListener || event.startsWith('update:')
  const modifiers = isCompatModelListener
    ? props.modelModifiers
    : isModelListener && getModelModifiers(props, event.slice(7))

  // v-model 的 trim / number 修饰符在事件触发前先作用到参数上。
  if (modifiers) {
    if (modifiers.trim) {
      args = rawArgs.map(a => (isString(a) ? a.trim() : a))
    }
    if (modifiers.number) {
      args = rawArgs.map(looseToNumber)
    }
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentEmit(instance, event, args)
  }

  if (__DEV__) {
    const lowerCaseEvent = event.toLowerCase()
    if (lowerCaseEvent !== event && props[toHandlerKey(lowerCaseEvent)]) {
      warn(
        `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(
            instance,
            instance.type,
          )} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(
            event,
          )}" instead of "${event}".`,
      )
    }
  }

  // `handlerName` 记录本次命中的 props 监听键，例如 `onClick`。
  let handlerName
  let handler =
    props[(handlerName = toHandlerKey(event))] ||
    // 再尝试一次 camelCase 形式，兼容不同模板来源。
    props[(handlerName = toHandlerKey(camelize(event)))]
  // `v-model` 事件还要兼容 kebab-case 形式的监听键。
  if (!handler && isModelListener) {
    handler = props[(handlerName = toHandlerKey(hyphenate(event)))]
  }

  if (handler) {
    // 普通监听器先执行一次；这里的 handler 可能来自原名、camelCase 或 kebab-case 的匹配结果。
    callWithAsyncErrorHandling(
      handler,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }

  const onceHandler = props[handlerName + `Once`]
  if (onceHandler) {
    if (!instance.emitted) {
      // `emitted` 记录 Once 监听器是否已经触发过，避免重复执行。
      instance.emitted = {}
    } else if (instance.emitted[handlerName]) {
      return
    }
    instance.emitted[handlerName] = true
    callWithAsyncErrorHandling(
      onceHandler,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }

  if (__COMPAT__) {
    // compat 下还要桥接 Vue 2 的 v-model 事件与实例事件系统。
    compatModelEmit(instance, event, args)
    return compatInstanceEmit(instance, event, args)
  }
}

// 这个缓存保存某个组件类型归一化后的 emits 结果，避免重复解析 mixin / extends。
const mixinEmitsCache = new WeakMap<ConcreteComponent, ObjectEmitsOptions>()

/**
 * 作用：把组件上声明的 `emits` 选项归一化成对象格式，并做缓存。
 */
export function normalizeEmitsOptions(
  comp: ConcreteComponent,
  appContext: AppContext,
  asMixin = false,
): ObjectEmitsOptions | null {
  /**
   * 归一化组件 `emits` 选项。
   *
   * 主要功能：
   * - 把数组写法转成对象写法
   * - 合并全局 mixins / extends / 本地 mixins 带来的 emits
   * - 缓存归一化结果，避免重复解析
   *
   * 参数：
   * - `comp`：组件类型
   * - `appContext`：当前应用上下文，里面保存 emits 归一化缓存
   * - `asMixin`：当前是否在 mixin 合并链路里
   */
  const cache =
    __FEATURE_OPTIONS_API__ && asMixin ? mixinEmitsCache : appContext.emitsCache
  // mixin 合并链与正常组件实例化链分开缓存，避免不同语义阶段互相污染。
  const cached = cache.get(comp)
  if (cached !== undefined) {
    return cached
  }

  const raw = comp.emits
  let normalized: ObjectEmitsOptions = {}

  // apply mixin/extends props
  let hasExtends = false
  if (__FEATURE_OPTIONS_API__ && !isFunction(comp)) {
    const extendEmits = (raw: ComponentOptions) => {
      // mixin / extends 也可能继续嵌套 extends，因此直接递归复用 normalize 流程。
      const normalizedFromExtend = normalizeEmitsOptions(raw, appContext, true)
      if (normalizedFromExtend) {
        hasExtends = true
        extend(normalized, normalizedFromExtend)
      }
    }
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendEmits)
    }
    if (comp.extends) {
      extendEmits(comp.extends)
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendEmits)
    }
  }

  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      // 明确缓存 null，表示这个组件确实没有 emits，后续可直接跳过解析。
      cache.set(comp, null)
    }
    return null
  }

  if (isArray(raw)) {
    // 数组写法只表达“声明了这些事件”，统一归一化成 `{ eventName: null }` 结构。
    raw.forEach(key => (normalized[key] = null))
  } else {
    extend(normalized, raw)
  }

  if (isObject(comp)) {
    // 只给对象组件缓存；函数组件/其他情况可能没有稳定对象可作为 WeakMap key。
    cache.set(comp, normalized)
  }
  return normalized
}

// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.
export function isEmitListener(
  options: ObjectEmitsOptions | null,
  key: string,
): boolean {
  /**
   * 判断一个 prop key 是否其实是“组件事件监听器”。
   *
   * 典型例子：
   * - `onClick`
   * - `onUpdate:modelValue`
   * - `onSubmitOnce`
   *
   * 这个判断会被 props 解析和更新逻辑复用，
   * 用来避免把监听器错误地当成普通 props / attrs。
   */
  if (!options || !isOn(key)) {
    return false
  }

  if (__COMPAT__ && key.startsWith(compatModelEventPrefix)) {
    return true
  }

  key = key.slice(2).replace(/Once$/, '')
  // 同一个监听器要兼容三种可能的命名形式：
  // - 原样
  // - 首字母小写
  // - kebab-case
  return (
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) ||
    hasOwn(options, hyphenate(key)) ||
    hasOwn(options, key)
  )
}
