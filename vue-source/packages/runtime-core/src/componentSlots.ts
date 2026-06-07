/**
 * 文件作用：处理组件 slots 的初始化、规范化和更新。
 *
 * 这份文件把父组件传入的插槽内容整理成统一的 slots 结构，
 * 供组件 render 阶段按名字和参数调用。
 *
 * 它位于“父组件生成 children -> 子组件消费 slots”之间，
 * 负责把各种原始 children 形态统一折叠成运行时标准插槽函数。
 */

import { type ComponentInternalInstance, currentInstance } from './component'
import {
  type VNode,
  type VNodeChild,
  type VNodeNormalizedChildren,
  normalizeVNode,
} from './vnode'
import {
  EMPTY_OBJ,
  type IfAny,
  type Prettify,
  ShapeFlags,
  SlotFlags,
  def,
  isArray,
  isFunction,
} from '@vue-source/shared'
import { warn } from './warning'
import { isKeepAlive } from './components/KeepAlive'
import {
  type ContextualRenderFn,
  currentRenderingInstance,
  withCtx,
} from './componentRenderContext'
import { isHmrUpdating } from './hmr'
import { DeprecationTypes, isCompatEnabled } from './compat/compatConfig'
import { TriggerOpTypes, trigger } from '@vue-source/reactivity'
import { createInternalObject } from './internalObject'

export type Slot<T extends any = any> = (
  ...args: IfAny<T, any[], [T] | (T extends undefined ? [] : never)>
) => VNode[]

// `InternalSlots` 是组件实例内部真正保存的 slots 容器结构：插槽名 -> 插槽函数。
export type InternalSlots = {
  [name: string]: Slot | undefined
}

export type Slots = Readonly<InternalSlots>

declare const SlotSymbol: unique symbol
export type SlotsType<T extends Record<string, any> = Record<string, any>> = {
  [SlotSymbol]?: T
}

export type StrictUnwrapSlotsType<
  S extends SlotsType,
  T = NonNullable<S[typeof SlotSymbol]>,
> = [keyof S] extends [never] ? Slots : Readonly<T> & T

export type UnwrapSlotsType<
  S extends SlotsType,
  T = NonNullable<S[typeof SlotSymbol]>,
> = [keyof S] extends [never]
  ? Slots
  : Readonly<
      Prettify<{
        [K in keyof T]: NonNullable<T[K]> extends (...args: any[]) => any
          ? T[K]
          : Slot<T[K]>
      }>
    >

export type RawSlots = {
  [name: string]: unknown
  // 手写 render 函数场景下的稳定性提示，告诉运行时可跳过某些强制子更新。
  $stable?: boolean
  /**
   * for tracking slot owner instance. This is attached during
   * normalizeChildren when the component vnode is created.
   * @internal
   */
  _ctx?: ComponentInternalInstance | null
  /**
   * 表示这份 slots 是否来自编译器，以及具备怎样的稳定性标记。
   * 之所以挂在 slots 对象本身上，而不是 vnode patchFlag 上，
   * 是因为手写 render 时 slots 对象可能被直接层层透传，提示信息必须跟着对象走。
   * @internal
   */
  _?: SlotFlags
}

/**
 * 判断一个 key 是否属于 slots 内部保留字段。
 *
 * 这些字段不是用户真正定义的插槽名，而是运行时 / 编译器附加的元信息。
 */
const isInternalKey = (key: string) =>
  key === '_' || key === '_ctx' || key === '$stable'

/**
 * 统一把插槽返回值转换成 VNode 数组。
 *
 * 作用：
 * - 如果用户返回的是数组，则逐项做 `normalizeVNode`
 * - 如果用户返回的是单个值，则包装成长度为 1 的数组
 *
 * 这样后续 `renderSlot` 和 patch 阶段就都能按统一结构消费。
 */
const normalizeSlotValue = (value: unknown): VNode[] =>
  isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value as VNodeChild)]

/**
 * 规范化单个函数插槽。
 *
 * 主要功能：
 * - 用 `withCtx` 包装原始插槽函数，绑定正确的渲染上下文
 * - 确保插槽执行结果一定是规范化后的 VNode 数组
 *
 * 参数：
 * - `key`：插槽名
 * - `rawSlot`：父组件传下来的原始插槽函数
 * - `ctx`：插槽归属的组件实例上下文
 *
 * 返回值：
 * - 返回运行时可直接调用的标准 `Slot`
 */
const normalizeSlot = (
  key: string,
  rawSlot: Function,
  ctx: ComponentInternalInstance | null | undefined,
): Slot => {
  if ((rawSlot as any)._n) {
    // already normalized - #5353
    return rawSlot as Slot
  }
  const normalized = withCtx((...args: any[]) => {
    if (
      __DEV__ &&
      currentInstance &&
      !(ctx === null && currentRenderingInstance) &&
      !(ctx && ctx.root !== currentInstance.root)
    ) {
      warn(
        `Slot "${key}" invoked outside of the render function: ` +
          `this will not track dependencies used in the slot. ` +
          `Invoke the slot function inside the render function instead.`,
      )
    }
    return normalizeSlotValue(rawSlot(...args))
  }, ctx) as Slot
  // NOT a compiled slot
  ;(normalized as ContextualRenderFn)._c = false
  return normalized
}

/**
 * 把对象形式的 slots 规范化到组件实例上。
 *
 * 典型输入：
 * - 编译产物传下来的命名插槽对象
 * - 手写 render 函数里传下来的插槽对象
 *
 * 主要功能：
 * - 跳过内部保留字段
 * - 如果值是函数，则走 `normalizeSlot`
 * - 如果值不是函数，则包装成返回固定 VNode 数组的函数
 */
const normalizeObjectSlots = (
  rawSlots: RawSlots,
  slots: InternalSlots,
  instance: ComponentInternalInstance,
) => {
  const ctx = rawSlots._ctx
  for (const key in rawSlots) {
    if (isInternalKey(key)) continue
    const value = rawSlots[key]
    if (isFunction(value)) {
      slots[key] = normalizeSlot(key, value, ctx)
    } else if (value != null) {
      if (
        __DEV__ &&
        !(
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance)
        )
      ) {
        warn(
          `Non-function value encountered for slot "${key}". ` +
            `Prefer function slots for better performance.`,
        )
      }
      const normalized = normalizeSlotValue(value)
      slots[key] = () => normalized
    }
  }
}

/**
 * 把“直接 children”形式转成默认插槽。
 *
 * 作用：
 * - 当组件 children 不是 slots 对象，而是普通 VNode / 文本 / 数组时
 * - 统一挂到 `instance.slots.default`
 */
const normalizeVNodeSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
) => {
  if (
    __DEV__ &&
    !isKeepAlive(instance.vnode) &&
    !(__COMPAT__ && isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance))
  ) {
    warn(
      `Non-function value encountered for default slot. ` +
        `Prefer function slots for better performance.`,
    )
  }
  const normalized = normalizeSlotValue(children)
  instance.slots.default = () => normalized
}

/**
 * 把新 slots 合并到现有 `slots` 容器。
 *
 * 参数：
 * - `slots`：组件实例当前 slots 容器
 * - `children`：新传入的 slots
 * - `optimized`：是否为编译优化路径
 *
 * 作用：
 * - 普通情况下复制所有对外可见插槽
 * - 优化路径下可以带上编译器标记 `_`
 */
const assignSlots = (
  slots: InternalSlots,
  children: Slots,
  optimized: boolean,
) => {
  for (const key in children) {
    // #2893
    // when rendering the optimized slots by manually written render function,
    // do not copy the `slots._` compiler flag so that `renderSlot` creates
    // slot Fragment with BAIL patchFlag to force full updates
    if (optimized || !isInternalKey(key)) {
      slots[key] = children[key]
    }
  }
}

/**
 * 初始化组件 slots。
 *
 * 主要功能：
 * - 根据 vnode 的 `shapeFlag` 判断 children 是“插槽对象”还是“普通 children”
 * - 分别走对象插槽规范化或默认插槽规范化
 *
 * 参数：
 * - `instance`：当前组件实例
 * - `children`：组件 vnode 上的 children
 * - `optimized`：是否走编译优化路径
 */
export const initSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
  optimized: boolean,
): void => {
  const slots = (instance.slots = createInternalObject())
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      assignSlots(slots, children as Slots, optimized)
      // make compiler marker non-enumerable
      if (optimized) {
        def(slots, '_', type, true)
      }
    } else {
      normalizeObjectSlots(children as RawSlots, slots, instance)
    }
  } else if (children) {
    normalizeVNodeSlots(instance, children)
  }
}

/**
 * 更新组件 slots。
 *
 * 主要功能：
 * - 在父组件更新导致 children 变化时，重新同步 slots
 * - 对稳定插槽跳过不必要更新
 * - 删除已经失效的旧插槽项
 *
 * 参数：
 * - `instance`：当前组件实例
 * - `children`：新的 children
 * - `optimized`：是否走编译优化路径
 */
export const updateSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
  optimized: boolean,
): void => {
  const { vnode, slots } = instance
  // `needDeletionCheck` 控制本轮更新后是否还要扫一遍旧 slots 并删除失效项。
  let needDeletionCheck = true
  // `deletionComparisonTarget` 保存“哪些 slot 名在新输入里仍然存在”，供最后清理旧槽位时比对。
  let deletionComparisonTarget = EMPTY_OBJ
  if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      // compiled slots.
      if (__DEV__ && isHmrUpdating) {
        // Parent was HMR updated so slot content may have changed.
        // force update slots and mark instance for hmr as well
        assignSlots(slots, children as Slots, optimized)
        trigger(instance, TriggerOpTypes.SET, '$slots')
      } else if (optimized && type === SlotFlags.STABLE) {
        // compiled AND stable.
        // no need to update, and skip stale slots removal.
        // 编译器已经保证这组 slots 结构稳定，父组件普通更新不会让插槽名集合发生变化。
        needDeletionCheck = false
      } else {
        // compiled but dynamic (v-if/v-for on slots) - update slots, but skip
        // normalization.
        // 这类 slots 的“函数形态”已经由编译器保证正确，直接覆盖即可，不必再次规范化。
        assignSlots(slots, children as Slots, optimized)
      }
    } else {
      // 手写 slots 对象或运行时生成对象仍可能增删 slot 名，因此既要规范化也要后续删除检查。
      needDeletionCheck = !(children as RawSlots).$stable
      normalizeObjectSlots(children as RawSlots, slots, instance)
    }
    deletionComparisonTarget = children as RawSlots
  } else if (children) {
    // non slot object children (direct value) passed to a component
    // 非对象 children 会被视为默认插槽，因此清理旧槽位时只保留 `default`。
    normalizeVNodeSlots(instance, children)
    deletionComparisonTarget = { default: 1 }
  }

  // delete stale slots
  if (needDeletionCheck) {
    for (const key in slots) {
      if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
        // 新一轮 children 里已经不存在这个插槽名，必须从实例 slots 上删除，避免读到陈旧内容。
        delete slots[key]
      }
    }
  }
}
