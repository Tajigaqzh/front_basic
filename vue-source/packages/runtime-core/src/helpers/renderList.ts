/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 renderList.ts 负责承接编译产物 `v-for` 的运行时列表展开逻辑。
 *
 * 它位于 render 函数执行期间，
 * 把 string / number / array / iterable / object 等不同来源统一转换成一组待 patch 的子节点结果。
 */

import type { VNode, VNodeChild } from '../vnode'
import {
  isReactive,
  isReadonly,
  isShallow,
  shallowReadArray,
  toReactive,
  toReadonly,
} from '@vue-source/reactivity'
import { isArray, isObject, isString } from '@vue-source/shared'
import { warn } from '../warning'

/**
 * v-for string
 * @private
 */
export function renderList(
  source: string,
  renderItem: (value: string, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for number
 */
export function renderList(
  source: number,
  renderItem: (value: number, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for array
 */
export function renderList<T>(
  source: T[],
  renderItem: (value: T, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for iterable
 */
export function renderList<T>(
  source: Iterable<T>,
  renderItem: (value: T, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for object
 */
export function renderList<T>(
  source: T,
  renderItem: <K extends keyof T>(
    value: T[K],
    key: string,
    index: number,
  ) => VNodeChild,
): VNodeChild[]

/**
 * 作用：运行时实现 `v-for` 列表渲染。
 *
 * 支持的数据源类型：
 * - string
 * - number 范围
 * - array
 * - iterable
 * - plain object
 *
 * 参数说明：
 * - `source`：被遍历的数据源。
 * - `renderItem`：对每一项生成 vnode 的回调。
 * - `cache` / `index`：编译优化场景下复用旧 vnode 列表的缓存入口。
 */
export function renderList(
  source: any,
  renderItem: (...args: any[]) => VNodeChild,
  cache?: any[],
  index?: number,
): VNodeChild[] {
  /**
   * 运行时展开 `v-for` 数据源。
   *
   * 主要功能：
   * - 统一处理数组、字符串、数字区间、可迭代对象、普通对象
   * - 在编译优化场景下把旧结果按位置传给 `renderItem`
   * - 最终返回一组可直接参与 patch 的子节点结果
   */
  let ret: VNodeChild[]
  // `cached` 保存上一次同一位置生成的 vnode 列表，给编译优化路径做对位复用。
  const cached = (cache && cache[index!]) as VNode[] | undefined
  const sourceIsArray = isArray(source)
  // `cache/index` 主要服务于编译优化路径，让同一位置的旧 vnode 能传进 `renderItem` 做对位复用。

  if (sourceIsArray || isString(source)) {
    // 数组和字符串都可以直接按 length 顺序遍历。
    const sourceIsReactiveArray = sourceIsArray && isReactive(source)
    let needsWrap = false
    let isReadonlySource = false
    if (sourceIsReactiveArray) {
      // 响应式数组遍历时先转成浅只读快照，避免遍历过程中意外触发深层代理开销。
      // 这样既能保留依赖追踪，又避免 render 阶段为了每一项都做不必要的深层代理包装。
      needsWrap = !isShallow(source)
      isReadonlySource = isReadonly(source)
      source = shallowReadArray(source)
    }
    ret = new Array(source.length)
    for (let i = 0, l = source.length; i < l; i++) {
      ret[i] = renderItem(
        needsWrap
          ? isReadonlySource
            ? toReadonly(toReactive(source[i]))
            : toReactive(source[i])
          : source[i],
        i,
        undefined,
        cached && cached[i],
      )
    }
  } else if (typeof source === 'number') {
    // number 场景对应模板里的 `n in 10` 这种范围遍历，运行时生成 1..n。
    if (__DEV__ && (!Number.isInteger(source) || source < 0)) {
      warn(
        `The v-for range expects a positive integer value but got ${source}.`,
      )
      ret = []
    } else {
      ret = new Array(source)
      for (let i = 0; i < source; i++) {
        ret[i] = renderItem(i + 1, i, undefined, cached && cached[i])
      }
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      // Set/Map 等 iterable 统一走 `Array.from` 收口。
      // 这样下面的渲染路径仍然可以维持“有序下标 + cached[i] 对位”的统一处理方式。
      ret = Array.from(source as Iterable<any>, (item, i) =>
        renderItem(item, i, undefined, cached && cached[i]),
      )
    } else {
      // 普通对象遍历时，第二个参数传 key，第三个参数传顺序下标。
      const keys = Object.keys(source)
      ret = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        ret[i] = renderItem(source[key], key, i, cached && cached[i])
      }
    }
  } else {
    ret = []
  }

  if (cache) {
    // 把本轮结果回写到编译缓存，后续 patch 时可以拿来做位置对齐。
    cache[index!] = ret
  }
  return ret
}
