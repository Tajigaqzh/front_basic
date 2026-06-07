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
  let ret: VNodeChild[]
  // `cached` 保存上一次同一位置生成的 vnode 列表，给编译优化路径做对位复用。
  const cached = (cache && cache[index!]) as VNode[] | undefined
  const sourceIsArray = isArray(source)

  if (sourceIsArray || isString(source)) {
    const sourceIsReactiveArray = sourceIsArray && isReactive(source)
    let needsWrap = false
    let isReadonlySource = false
    if (sourceIsReactiveArray) {
      // 响应式数组遍历时先转成浅只读快照，避免遍历过程中意外触发深层代理开销。
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
      ret = Array.from(source as Iterable<any>, (item, i) =>
        renderItem(item, i, undefined, cached && cached[i]),
      )
    } else {
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
