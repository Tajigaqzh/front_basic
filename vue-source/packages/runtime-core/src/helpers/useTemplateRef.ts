/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 useTemplateRef.ts 负责在组合式 API 中创建“与模板 ref 同步联动”的响应式引用。
 *
 * 它处在组件 setup 链路和渲染器 `setRef` 链路之间：
 * - setup 阶段调用 `useTemplateRef('xxx')`
 * - 渲染阶段模板里的 `ref="xxx"` 最终会把真实值写回这里创建的 shallowRef
 */

import { type ShallowRef, readonly, shallowRef } from '@vue-source/reactivity'
import { type Data, getCurrentInstance } from '../component'
import { warn } from '../warning'
import { EMPTY_OBJ } from '@vue-source/shared'

// 用来记录哪些 ref 是由 `useTemplateRef()` 创建的，渲染器设置 template ref 时会跳过重复覆盖。
export const knownTemplateRefs: WeakSet<ShallowRef> = new WeakSet()

export type TemplateRef<T = unknown> = Readonly<ShallowRef<T | null>>

/**
 * 作用：在组合式 API 中按 key 创建一个与模板 ref 同步联动的只读 shallowRef。
 *
 * 参数说明：
 * - `key`：模板里 `ref="xxx"` 对应的名字。
 *
 * 依赖关系：
 * - 通过在实例 `refs` 上定义 getter/setter，与渲染器的 `setRef` 链路对接。
 */
export function useTemplateRef<T = unknown, Keys extends string = string>(
  key: Keys,
): TemplateRef<T> {
  const i = getCurrentInstance()
  // `r` 保存真正暴露给用户的 ref 值，初始为 null，挂载/更新后由渲染器回填。
  const r = shallowRef(null)
  if (i) {
    // `refs` 是组件实例对外和对内共享的模板 ref 容器。
    const refs = i.refs === EMPTY_OBJ ? (i.refs = {}) : i.refs
    if (__DEV__ && isTemplateRefKey(refs, key)) {
      warn(`useTemplateRef('${key}') already exists.`)
    } else {
      Object.defineProperty(refs, key, {
        enumerable: true,
        get: () => r.value,
        set: val => (r.value = val),
      })
    }
  } else if (__DEV__) {
    warn(
      `useTemplateRef() is called when there is no active component ` +
        `instance to be associated with.`,
    )
  }
  const ret = __DEV__ ? readonly(r) : r
  if (__DEV__) {
    // 开发环境记录下来，渲染器在设置字符串 ref 时可以识别“这是 useTemplateRef 自己的 key”。
    knownTemplateRefs.add(ret)
  }
  return ret
}

/**
 * 作用：判断某个 refs key 是否已经被 `useTemplateRef()` 占用。
 */
export function isTemplateRefKey(refs: Data, key: string): boolean {
  // `useTemplateRef()` 定义出来的属性会被设成不可配置，
  // 这里据此区分“用户普通 refs 字段”与“模板 ref 绑定入口”。
  let desc: PropertyDescriptor | undefined
  return !!(
    (desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable
  )
}
