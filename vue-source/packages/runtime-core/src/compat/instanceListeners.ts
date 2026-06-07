/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 instanceListeners.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import { isOn } from '@vue-source/shared'
import type { ComponentInternalInstance } from '../component'
import { DeprecationTypes, assertCompatEnabled } from './compatConfig'

export function getCompatListeners(
  instance: ComponentInternalInstance,
): Record<string, Function | Function[]> {
  assertCompatEnabled(DeprecationTypes.INSTANCE_LISTENERS, instance)

  const listeners: Record<string, Function | Function[]> = {}
  const rawProps = instance.vnode.props
  if (!rawProps) {
    return listeners
  }
  for (const key in rawProps) {
    if (isOn(key)) {
      listeners[key[2].toLowerCase() + key.slice(3)] = rawProps[key]
    }
  }
  return listeners
}
