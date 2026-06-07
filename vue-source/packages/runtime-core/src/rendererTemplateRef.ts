/**
 * 文件作用：处理模板 ref 的挂载、更新和卸载。
 *
 * 这份文件位于渲染器的收尾阶段，负责把 vnode 上声明的 `ref`
 * 同步到组件实例的 `refs`、`setupState` 或用户传入的 `ref` 对象上。
 */

import type { SuspenseBoundary } from './components/Suspense'
import type {
  VNode,
  VNodeNormalizedRef,
  VNodeNormalizedRefAtom,
  VNodeRef,
} from './vnode'
import {
  EMPTY_OBJ,
  NO,
  ShapeFlags,
  hasOwn,
  isArray,
  isFunction,
  isString,
  remove,
} from '@vue-source/shared'
import { isAsyncWrapper } from './apiAsyncComponent'
import { warn } from './warning'
import { isRef, toRaw } from '@vue-source/reactivity'
import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { type SchedulerJob, SchedulerJobFlags } from './scheduler'
import { queuePostRenderEffect } from './renderer'
import { type ComponentOptions, getComponentPublicInstance } from './component'
import { isTemplateRefKey, knownTemplateRefs } from './helpers/useTemplateRef'

// 这个映射保存“尚未执行的 ref 赋值任务”，用于在同一个 ref 快速变化时取消旧任务。
const pendingSetRefMap = new WeakMap<VNodeNormalizedRef, SchedulerJob>()

/**
 * 作用：根据 vnode 上的 ref 描述，把真实节点或组件代理暴露给拥有者组件。
 */
export function setRef(
  rawRef: VNodeNormalizedRef,
  oldRawRef: VNodeNormalizedRef | null,
  parentSuspense: SuspenseBoundary | null,
  vnode: VNode,
  isUnmount = false,
): void {
  /**
   * 同步模板 ref。
   *
   * 主要功能：
   * - 挂载时把元素或组件公开实例写到目标 ref
   * - 更新时处理动态 ref 切换
   * - 卸载时把旧 ref 清空
   * - `ref_for` 场景下维护 ref 数组
   *
   * 参数：
   * - `rawRef`：当前 vnode 上的新 ref 描述
   * - `oldRawRef`：旧 vnode 上的 ref 描述
   * - `parentSuspense`：所属 Suspense 边界，post render 阶段调度时需要它
   * - `vnode`：当前 vnode
   * - `isUnmount`：是否处于卸载阶段
   *
   * 所在链路：
   * - `renderer.ts` 在 mount / patch / unmount 收尾阶段都会调用这里
   */
  if (isArray(rawRef)) {
    // 一个 vnode 可以声明多个 ref，逐个递归处理即可。
    rawRef.forEach((r, i) =>
      setRef(
        r,
        oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
        parentSuspense,
        vnode,
        isUnmount,
      ),
    )
    return
  }

  if (isAsyncWrapper(vnode) && !isUnmount) {
    // 异步组件真正暴露给用户的是解析后的内部组件实例，而不是包装层。
    if (
      vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE &&
      (vnode.type as ComponentOptions).__asyncResolved &&
      vnode.component!.subTree.component
    ) {
      setRef(rawRef, oldRawRef, parentSuspense, vnode.component!.subTree)
    }

    return
  }

  // 组件 ref 暴露组件公开实例，元素 ref 暴露真实 DOM 节点。
  // 元素节点暴露真实 DOM，组件节点暴露组件公开实例。
  const refValue =
    vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
      ? getComponentPublicInstance(vnode.component!)
      : vnode.el
  const value = isUnmount ? null : refValue

  const { i: owner, r: ref } = rawRef
  if (__DEV__ && !owner) {
    warn(
      `Missing ref owner context. ref cannot be used on hoisted vnodes. ` +
        `A vnode with ref must be created inside the render function.`,
    )
    return
  }
  const oldRef = oldRawRef && (oldRawRef as VNodeNormalizedRefAtom).r
  // `refs` 是组件实例对外暴露的模板 ref 容器。
  const refs = owner.refs === EMPTY_OBJ ? (owner.refs = {}) : owner.refs
  const setupState = owner.setupState
  const rawSetupState = toRaw(setupState)
  const canSetSetupRef =
    setupState === EMPTY_OBJ
      ? NO
      : (key: string) => {
          if (__DEV__) {
            if (hasOwn(rawSetupState, key) && !isRef(rawSetupState[key])) {
              warn(
                `Template ref "${key}" used on a non-ref value. ` +
                  `It will not work in the production build.`,
              )
            }

            if (knownTemplateRefs.has(rawSetupState[key] as any)) {
              return false
            }
          }

          // `useTemplateRef` 自己维护对应 key，渲染器这里不再重复写入。
          if (isTemplateRefKey(refs, key)) {
            return false
          }

          return hasOwn(rawSetupState, key)
        }

  const canSetRef = (ref: VNodeRef, key?: string) => {
    // 已经由 useTemplateRef 管理的目标，不再让渲染器重复覆盖。
    if (__DEV__ && knownTemplateRefs.has(ref as any)) {
      return false
    }
    if (key && isTemplateRefKey(refs, key)) {
      return false
    }
    return true
  }

  // 动态 ref 发生切换时，先把旧 ref 清空，避免旧引用残留。
  if (oldRef != null && oldRef !== ref) {
    invalidatePendingSetRef(oldRawRef!)
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (canSetSetupRef(oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      // this type assertion is valid since `oldRef` has already been asserted to be non-null
      const oldRawRefAtom = oldRawRef as VNodeNormalizedRefAtom
      if (canSetRef(oldRef, oldRawRefAtom.k)) {
        oldRef.value = null
      }
      if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null
    }
  }

  if (isFunction(ref)) {
    // 函数 ref 直接回调给用户，由用户自己决定如何保存。
    callWithErrorHandling(ref, owner, ErrorCodes.FUNCTION_REF, [value, refs])
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)

    if (_isString || _isRef) {
      // `doSet` 聚合了字符串 ref、ref 对象 ref、多 ref 三种写入路径。
      // `doSet` 统一承接所有 ref 目标写入逻辑，外层只决定是立即执行还是延后到 post render。
      const doSet = () => {
        if (rawRef.f) {
          // `f` 表示这是 `ref_for` 场景，同一个 ref key 对应一个数组。
          // `existing` 表示 ref_for 当前已经收集到的值，可能是 setupState 上的，也可能是 refs 容器里的。
          const existing = _isString
            ? canSetSetupRef(ref)
              ? setupState[ref]
              : refs[ref]
            : canSetRef(ref) || !rawRef.k
              ? ref.value
              : refs[rawRef.k]
          if (isUnmount) {
            // 卸载时把当前节点/实例从 ref 数组里移除即可。
            isArray(existing) && remove(existing, refValue)
          } else {
            if (!isArray(existing)) {
              if (_isString) {
                refs[ref] = [refValue]
                if (canSetSetupRef(ref)) {
                  setupState[ref] = refs[ref]
                }
              } else {
                // ref 对象在 `ref_for` 场景下也要改成数组。
                const newVal = [refValue]
                if (canSetRef(ref, rawRef.k)) {
                  ref.value = newVal
                }
                if (rawRef.k) refs[rawRef.k] = newVal
              }
            } else if (!existing.includes(refValue)) {
              // 同一个 ref_for 数组里避免重复收集同一真实节点/实例。
              existing.push(refValue)
            }
          }
        } else if (_isString) {
          // 普通字符串 ref 同步到实例的 `refs`，必要时也同步到 setupState。
          refs[ref] = value
          if (canSetSetupRef(ref)) {
            setupState[ref] = value
          }
        } else if (_isRef) {
          // 组合式 API 中直接传入的 ref 对象，写到它的 `.value` 上。
          if (canSetRef(ref, rawRef.k)) {
            ref.value = value
          }
          if (rawRef.k) refs[rawRef.k] = value
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      if (value) {
        // 非空 ref 要等本轮渲染提交后再赋值，保证拿到的是最终 DOM / 子组件实例。
        // 模板 ref 必须等本轮 DOM / 子组件实例真正提交后再写入，
        // 否则用户在 mounted / updated 里拿到的可能还是旧节点。
        const job: SchedulerJob = () => {
          doSet()
          pendingSetRefMap.delete(rawRef)
        }
        job.id = -1
        pendingSetRefMap.set(rawRef, job)
        queuePostRenderEffect(job, parentSuspense)
      } else {
        invalidatePendingSetRef(rawRef)
        doSet()
      }
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
}

/**
 * 作用：取消某个 ref 尚未执行的延迟赋值任务。
 */
function invalidatePendingSetRef(rawRef: VNodeNormalizedRef) {
  const pendingSetRef = pendingSetRefMap.get(rawRef)
  if (pendingSetRef) {
    pendingSetRef.flags! |= SchedulerJobFlags.DISPOSED
    pendingSetRefMap.delete(rawRef)
  }
}
