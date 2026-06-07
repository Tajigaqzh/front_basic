import {
  type ComponentPublicInstance,
  type Directive,
  ssrUtils,
} from '@vue-source/runtime-dom'

// 指令想参与 SSR，唯一入口就是实现 `getSSRProps`。
// 返回值会被合并到当前节点 props 上，进而影响最终 HTML。
export function ssrGetDirectiveProps(
  instance: ComponentPublicInstance,
  dir: Directive,
  value?: any,
  arg?: string,
  modifiers: Record<string, boolean> = {},
): Record<string, any> {
  if (typeof dir !== 'function' && dir.getSSRProps) {
    return (
      dir.getSSRProps(
        {
          dir,
          instance: ssrUtils.getComponentPublicInstance(instance.$),
          value,
          oldValue: undefined,
          arg,
          modifiers,
        },
        null as any,
      ) || {}
    )
  }
  return {}
}
