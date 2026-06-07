/**
 * 文件作用：处理自定义指令在运行时的挂载与执行。
 *
 * 这份文件负责把指令和 VNode 绑定起来，并在挂载、更新、卸载阶段调用对应钩子。
 */

import type { VNode } from './vnode'
import { EMPTY_OBJ, isBuiltInDirective, isFunction } from '@vue-source/shared'
import { warn } from './warning'
import {
  type ComponentInternalInstance,
  type Data,
  getComponentPublicInstance,
} from './component'
import { currentRenderingInstance } from './componentRenderContext'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import type { ComponentPublicInstance } from './componentPublicInstance'
import { mapCompatDirectiveHook } from './compat/customDirective'
import { pauseTracking, resetTracking, traverse } from '@vue-source/reactivity'

export interface DirectiveBinding<
  Value = any,
  Modifiers extends string = string,
  Arg = any,
> {
  // 当前指令所属的组件公开实例；供指令钩子在需要时访问组件上下文。
  instance: ComponentPublicInstance | Record<string, any> | null
  // 本次 patch 传给指令的当前值。
  value: Value
  // 更新阶段的旧值；首次挂载时通常为 null/undefined。
  oldValue: Value | null
  arg?: Arg
  // 形如 `v-demo.foo.bar` 中的 `{ foo: true, bar: true }`。
  modifiers: DirectiveModifiers<Modifiers>
  // 当前绑定最终归一化后的指令定义对象。
  dir: ObjectDirective<any, Value, Modifiers, Arg>
}

export type DirectiveHook<
  HostElement = any,
  Prev = VNode<any, HostElement> | null,
  Value = any,
  Modifiers extends string = string,
  Arg = any,
> = (
  el: HostElement,
  binding: DirectiveBinding<Value, Modifiers, Arg>,
  vnode: VNode<any, HostElement>,
  prevVNode: Prev,
) => void

export type SSRDirectiveHook<
  Value = any,
  Modifiers extends string = string,
  Arg = any,
> = (
  binding: DirectiveBinding<Value, Modifiers, Arg>,
  vnode: VNode,
) => Data | undefined

export interface ObjectDirective<
  HostElement = any,
  Value = any,
  Modifiers extends string = string,
  Arg = any,
> {
  /**
   * @internal without this, ts-expect-error in directives.test-d.ts somehow
   * fails when running tsc, but passes in IDE and when testing against built
   * dts. Could be a TS bug.
   */
  __mod?: Modifiers
  created?: DirectiveHook<HostElement, null, Value, Modifiers, Arg>
  beforeMount?: DirectiveHook<HostElement, null, Value, Modifiers, Arg>
  mounted?: DirectiveHook<HostElement, null, Value, Modifiers, Arg>
  beforeUpdate?: DirectiveHook<
    HostElement,
    VNode<any, HostElement>,
    Value,
    Modifiers,
    Arg
  >
  updated?: DirectiveHook<
    HostElement,
    VNode<any, HostElement>,
    Value,
    Modifiers,
    Arg
  >
  beforeUnmount?: DirectiveHook<HostElement, null, Value, Modifiers, Arg>
  unmounted?: DirectiveHook<HostElement, null, Value, Modifiers, Arg>
  getSSRProps?: SSRDirectiveHook<Value, Modifiers, Arg>
  deep?: boolean
}

export type FunctionDirective<
  HostElement = any,
  V = any,
  Modifiers extends string = string,
  Arg = any,
> = DirectiveHook<HostElement, any, V, Modifiers, Arg>

export type Directive<
  HostElement = any,
  Value = any,
  Modifiers extends string = string,
  Arg = any,
> =
  | ObjectDirective<HostElement, Value, Modifiers, Arg>
  | FunctionDirective<HostElement, Value, Modifiers, Arg>

export type DirectiveModifiers<K extends string = string> = Partial<
  Record<K, boolean>
>

/**
 * 作用：校验用户自定义指令名称是否与内置指令冲突。
 */
export function validateDirectiveName(name: string): void {
  // 内置指令 id 具有固定运行时语义，用户重名会造成编译/执行期歧义。
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}

// Directive, value, argument, modifiers
export type DirectiveArguments = Array<
  | [Directive | undefined]
  | [Directive | undefined, any]
  | [Directive | undefined, any, any]
  | [Directive | undefined, any, any, DirectiveModifiers]
>

/**
 * 作用：把运行时指令描述挂到 vnode.dirs 上，供 patch 阶段统一执行。
 *
 * 参数说明：
 * - `vnode`：当前要附加指令的 vnode。
 * - `directives`：编译产物整理好的指令参数数组。
 */
export function withDirectives<T extends VNode>(
  vnode: T,
  directives: DirectiveArguments,
): T {
  if (currentRenderingInstance === null) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return vnode
  }
  const instance = getComponentPublicInstance(currentRenderingInstance)
  // `bindings` 保存当前 vnode 上全部指令绑定信息，后续 patch 时会按阶段遍历。
  const bindings: DirectiveBinding[] = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i]
    if (dir) {
      if (isFunction(dir)) {
        // 函数式指令语法会被标准化成 mounted / updated 两个阶段复用。
        dir = {
          mounted: dir,
          updated: dir,
        } as ObjectDirective
      }
      if (dir.deep) {
        // 深度指令需要先递归访问值，确保内部响应式依赖被收集。
        traverse(value)
      }
      bindings.push({
        dir,
        instance,
        value,
        // 首次挂载还没有旧值，这里先留空，更新阶段再由 invokeDirectiveHook 回填。
        oldValue: void 0,
        arg,
        modifiers,
      })
    }
  }
  return vnode
}

/**
 * 作用：在挂载、更新、卸载阶段调用某一批指令的指定生命周期钩子。
 *
 * 参数说明：
 * - `vnode`：当前新 vnode。
 * - `prevVNode`：旧 vnode，更新阶段用于拿旧值。
 * - `instance`：所属组件实例。
 * - `name`：当前要调用的指令生命周期名。
 */
export function invokeDirectiveHook(
  vnode: VNode,
  prevVNode: VNode | null,
  instance: ComponentInternalInstance | null,
  name: keyof ObjectDirective,
): void {
  const bindings = vnode.dirs!
  // 更新阶段旧 vnode 上的 dirs 与新 vnode 位置一一对应，便于按索引回填 oldValue。
  const oldBindings = prevVNode && prevVNode.dirs!
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    if (oldBindings) {
      // 更新阶段把上一次的值补到 binding 上，供 beforeUpdate/updated 使用。
      binding.oldValue = oldBindings[i].value
    }
    let hook = binding.dir[name] as DirectiveHook | DirectiveHook[] | undefined
    if (__COMPAT__ && !hook) {
      // compat 模式下还要映射 Vue 2 的旧指令钩子命名。
      hook = mapCompatDirectiveHook(name, binding.dir, instance)
    }
    if (hook) {
      // 指令钩子可能运行在副作用中，先暂停依赖收集，避免把钩子内部访问误记为渲染依赖。
      pauseTracking()
      callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, [
        vnode.el,
        binding,
        vnode,
        prevVNode,
      ])
      resetTracking()
    }
  }
}
