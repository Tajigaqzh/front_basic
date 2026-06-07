/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 attrsFallthrough.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import { isOn } from '@vue-source/shared'
import type { ComponentInternalInstance } from '../component'
import { DeprecationTypes, isCompatEnabled } from './compatConfig'

export function shouldSkipAttr(
  key: string,
  instance: ComponentInternalInstance,
): boolean {
  if (key === 'is') {
    return true
  }
  if (
    (key === 'class' || key === 'style') &&
    isCompatEnabled(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE, instance)
  ) {
    return true
  }
  if (
    isOn(key) &&
    isCompatEnabled(DeprecationTypes.INSTANCE_LISTENERS, instance)
  ) {
    return true
  }
  // vue-router
  if (key.startsWith('routerView') || key === 'registerRouteInstance') {
    return true
  }
  return false
}
