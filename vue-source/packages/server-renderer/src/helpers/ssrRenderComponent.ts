import {
  type Component,
  type ComponentInternalInstance,
  type Slots,
  createVNode,
} from '@vue-source/runtime-dom'
import { type Props, type SSRBuffer } from '../buffer'
import { renderComponentVNode } from '../render'
import type { SSRSlots } from './ssrRenderSlot'

// 编译产物在 SSR 下渲染子组件时，最终都会落到这个辅助函数。
// 它只负责把参数整理成 VNode，真正的实例创建和子树渲染在 render.ts 中完成。
export function ssrRenderComponent(
  comp: Component,
  props: Props | null = null,
  children: Slots | SSRSlots | null = null,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  return renderComponentVNode(
    createVNode(comp, props, children),
    parentComponent,
    slotScopeId,
  )
}
