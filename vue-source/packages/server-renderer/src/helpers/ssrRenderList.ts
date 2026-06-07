import { isArray, isObject, isString } from '@vue-source/shared'
import { warn } from '@vue-source/runtime-core'

// `v-for` 的 SSR 辅助函数需要兼容数组、字符串、数字区间、对象和可迭代对象，
// 保证编译后的服务端遍历语义与客户端保持一致。
export function ssrRenderList(
  source: unknown,
  renderItem: (value: unknown, key: string | number, index?: number) => void,
): void {
  if (isArray(source) || isString(source)) {
    for (let i = 0, l = source.length; i < l; i++) {
      renderItem(source[i], i)
    }
  } else if (typeof source === 'number') {
    if (__DEV__ && (!Number.isInteger(source) || source < 0)) {
      warn(
        `The v-for range expects a positive integer value but got ${source}.`,
      )
      return
    }
    for (let i = 0; i < source; i++) {
      renderItem(i + 1, i)
    }
  } else if (isObject(source)) {
    // 优先走迭代器分支，避免把 Set/Map 这类对象错误地按普通键值对象展开。
    if (source[Symbol.iterator as any]) {
      let i = 0
      for (const item of source as Iterable<any>) {
        renderItem(item, i++)
      }
    } else {
      const keys = Object.keys(source)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        renderItem(source[key], key, i)
      }
    }
  }
}
