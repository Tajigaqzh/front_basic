/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 data.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import { isPlainObject } from '@vue-source/shared'
import { DeprecationTypes, warnDeprecation } from './compatConfig'

export function deepMergeData(to: any, from: any): any {
  for (const key in from) {
    const toVal = to[key]
    const fromVal = from[key]
    if (key in to && isPlainObject(toVal) && isPlainObject(fromVal)) {
      __DEV__ && warnDeprecation(DeprecationTypes.OPTIONS_DATA_MERGE, null, key)
      deepMergeData(toVal, fromVal)
    } else {
      to[key] = fromVal
    }
  }
  return to
}
