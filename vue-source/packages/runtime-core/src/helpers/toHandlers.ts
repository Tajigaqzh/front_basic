/**
 * 文件作用：runtime-core 的辅助函数模块。
 *
 * 当前文件 toHandlers.ts 负责把对象形式事件声明转换成标准 `onXxx` props。
 *
 * 它直接服务于编译产物里的 `v-on="obj"` 场景，
 * 让渲染器后续可以把这些键当作普通事件 props 分发到 `patchProp`。
 */

import { isObject, toHandlerKey } from '@vue-source/shared'
import { warn } from '../warning'

/**
 * 作用：把 `v-on="obj"` 这类对象监听写法转换成标准 `onXxx` props 结构。
 *
 * 参数说明：
 * - `obj`：事件名到处理函数的映射对象。
 * - `preserveCaseIfNecessary`：是否在遇到大写事件名时保留原大小写。
 */
export function toHandlers(
  obj: Record<string, any>,
  preserveCaseIfNecessary?: boolean,
): Record<string, any> {
  const ret: Record<string, any> = {}
  if (__DEV__ && !isObject(obj)) {
    warn(`v-on with no argument expects an object value.`)
    return ret
  }
  for (const key in obj) {
    // 编译产物有时需要保留大小写精确事件名，此时走 `on:fooBar` 形式。
    ret[
      preserveCaseIfNecessary && /[A-Z]/.test(key)
        ? `on:${key}`
        : toHandlerKey(key)
    ] = obj[key]
  }
  return ret
}
