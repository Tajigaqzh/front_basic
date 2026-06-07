/**
 * 文件作用：实现运行时 `v-on` 修饰符包装逻辑。
 *
 * 这份文件不直接负责 DOM 事件绑定本身，
 * 而是负责把编译阶段产出的 `withModifiers / withKeys` 包装逻辑落到运行时，
 * 让事件回调在真正执行前先通过修饰符过滤。
 *
 * 典型场景：
 * - `@click.stop.prevent`
 * - `@keyup.enter`
 * - `@click.ctrl.exact`
 */

import {
  type ComponentInternalInstance,
  DeprecationTypes,
  type Directive,
  type LegacyConfig,
  compatUtils,
  getCurrentInstance,
} from '@vue-source/runtime-core'
import { hyphenate, isArray } from '@vue-source/shared'

// 这些是事件修饰符里会直接读取系统按键状态的那一组。
const systemModifiers = ['ctrl', 'shift', 'alt', 'meta'] as const
type SystemModifiers = (typeof systemModifiers)[number]
type CompatModifiers = keyof typeof keyNames

export type VOnModifiers = SystemModifiers | ModifierGuards | CompatModifiers
type KeyedEvent = KeyboardEvent | MouseEvent | TouchEvent

type ModifierGuards =
  | 'shift'
  | 'ctrl'
  | 'alt'
  | 'meta'
  | 'left'
  | 'right'
  | 'stop'
  | 'prevent'
  | 'self'
  | 'middle'
  | 'exact'
const modifierGuards: Record<
  ModifierGuards,
  | ((e: Event) => void | boolean)
  | ((e: Event, modifiers: string[]) => void | boolean)
> = {
  // 这些守卫函数的返回约定是：
  // - 返回 `true`：阻断后续执行
  // - 返回 `void`：说明只是做副作用处理，继续后面的守卫或用户回调
  stop: (e: Event) => e.stopPropagation(),
  prevent: (e: Event) => e.preventDefault(),
  self: (e: Event) => e.target !== e.currentTarget,
  ctrl: (e: Event) => !(e as KeyedEvent).ctrlKey,
  shift: (e: Event) => !(e as KeyedEvent).shiftKey,
  alt: (e: Event) => !(e as KeyedEvent).altKey,
  meta: (e: Event) => !(e as KeyedEvent).metaKey,
  left: (e: Event) => 'button' in e && (e as MouseEvent).button !== 0,
  middle: (e: Event) => 'button' in e && (e as MouseEvent).button !== 1,
  right: (e: Event) => 'button' in e && (e as MouseEvent).button !== 2,
  exact: (e, modifiers) =>
    systemModifiers.some(m => (e as any)[`${m}Key`] && !modifiers.includes(m)),
}
// `modifierGuards` 本质上是一张“修饰符 -> 运行时守卫逻辑”的查表。
// 编译产物只需把修饰符名称数组传进来，运行时就能按顺序执行这些守卫。

/**
 * 作用：为事件处理函数包上一层修饰符守卫。
 *
 * 参数说明：
 * - `fn`：原始事件回调。
 * - `modifiers`：编译阶段生成的修饰符列表。
 *
 * 返回值：
 * - 返回一个带缓存的包装函数，命中阻断条件时直接提前返回。
 */
export const withModifiers = <
  T extends (event: Event, ...args: unknown[]) => any,
>(
  fn: T & { _withMods?: { [key: string]: T } },
  modifiers: VOnModifiers[],
): T => {
  /**
   * 给事件处理函数包上一层“通用修饰符守卫”。
   *
   * 主要功能：
   * - 按顺序执行 `stop / prevent / self / ctrl / exact` 等修饰符判断
   * - 任意一个守卫要求中断时，直接提前返回
   * - 相同函数 + 相同修饰符组合会复用缓存包装结果
   *
   * 参数：
   * - `fn`：原始事件处理函数
   * - `modifiers`：编译阶段生成的修饰符列表
   */
  if (!fn) return fn
  // `_withMods` 缓存同一函数在不同修饰符组合下的包装结果。
  const cache = fn._withMods || (fn._withMods = {})
  const cacheKey = modifiers.join('.')
  return (
    cache[cacheKey] ||
    (cache[cacheKey] = ((event, ...args) => {
      for (let i = 0; i < modifiers.length; i++) {
        const guard = modifierGuards[modifiers[i] as ModifierGuards]
        // 只要某个守卫返回 true，说明当前事件不该继续传给用户回调，立即短路。
        if (guard && guard(event, modifiers)) return
      }
      return fn(event, ...args)
    }) as T)
  )
}

// 旧版按键别名兼容表，主要服务于 Vue 2 迁移路径。
const keyNames: Record<
  'esc' | 'space' | 'up' | 'left' | 'right' | 'down' | 'delete',
  string
> = {
  esc: 'escape',
  space: ' ',
  up: 'arrow-up',
  left: 'arrow-left',
  right: 'arrow-right',
  down: 'arrow-down',
  delete: 'backspace',
}

/**
 * 作用：为键盘事件处理函数增加按键过滤能力。
 *
 * 参数说明：
 * - `fn`：原始键盘事件回调。
 * - `modifiers`：允许触发回调的按键修饰符。
 */
export const withKeys = <T extends (event: KeyboardEvent) => any>(
  fn: T & { _withKeys?: { [k: string]: T } },
  modifiers: string[],
): T => {
  /**
   * 给键盘事件处理函数包上一层“按键过滤器”。
   *
   * 主要功能：
   * - 只在事件按键命中修饰符时执行原始回调
   * - 支持现代 `event.key`
   * - compat 模式下兼容 Vue 2 的 `keyCode / config.keyCodes`
   *
   * 参数：
   * - `fn`：原始键盘事件回调
   * - `modifiers`：允许触发的按键别名列表，如 `enter / esc / left`
   */
  let globalKeyCodes: LegacyConfig['keyCodes']
  let instance: ComponentInternalInstance | null = null
  if (__COMPAT__) {
    instance = getCurrentInstance()
    if (
      compatUtils.isCompatEnabled(DeprecationTypes.CONFIG_KEY_CODES, instance)
    ) {
      if (instance) {
        globalKeyCodes = (instance.appContext.config as LegacyConfig).keyCodes
      }
    }
    if (__DEV__ && modifiers.some(m => /^\d+$/.test(m))) {
      compatUtils.warnDeprecation(
        DeprecationTypes.V_ON_KEYCODE_MODIFIER,
        instance,
      )
    }
  }

  // `_withKeys` 缓存不同按键组合对应的包装函数。
  const cache: { [k: string]: T } = fn._withKeys || (fn._withKeys = {})
  const cacheKey = modifiers.join('.')

  return (
    cache[cacheKey] ||
    (cache[cacheKey] = (event => {
      if (!('key' in event)) {
        // 非键盘事件或极端宿主对象不参与按键过滤。
        return
      }

      // `eventKey` 统一转成短横线形式，便于和模板修饰符名称直接比较。
      const eventKey = hyphenate(event.key)
      if (
        modifiers.some(
          k =>
            k === eventKey ||
            keyNames[k as unknown as CompatModifiers] === eventKey,
        )
      ) {
        // 命中现代 `event.key` 语义时直接执行原始回调。
        return fn(event)
      }

      if (__COMPAT__) {
        // 兼容模式下还要支持 Vue 2 的 keyCode / config.keyCodes 逻辑。
        const keyCode = String(event.keyCode)
        if (
          compatUtils.isCompatEnabled(
            DeprecationTypes.V_ON_KEYCODE_MODIFIER,
            instance,
          ) &&
          modifiers.some(mod => mod == keyCode)
        ) {
          // 旧模板里直接写数字 keyCode 修饰符，compat 下仍允许命中。
          return fn(event)
        }
        if (globalKeyCodes) {
          for (const mod of modifiers) {
            const codes = globalKeyCodes[mod]
            if (codes) {
              const matches = isArray(codes)
                ? codes.some(code => String(code) === keyCode)
                : String(codes) === keyCode
              if (matches) {
                // `config.keyCodes` 允许用户自定义别名，这里按 Vue 2 语义继续兼容。
                return fn(event)
              }
            }
          }
        }
      }
    }) as T)
  )
}

export type VOnDirective = Directive<any, any, VOnModifiers>
