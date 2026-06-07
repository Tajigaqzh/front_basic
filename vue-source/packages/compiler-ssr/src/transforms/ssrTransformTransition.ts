import {
  type ComponentNode,
  NodeTypes,
  type TransformContext,
  findProp,
} from '@vue-source/compiler-dom'
import {
  processChildren,
} from '../ssrTransformContext'
import type { SSRTransformContext } from '../ssrTransformTypes'

const wipMap = new WeakMap<ComponentNode, Boolean>()

export function ssrTransformTransition(
  node: ComponentNode,
  context: TransformContext,
) {
  return (): void => {
    // SSR 下 Transition 真正关心的是 `appear`：
    // 首屏服务端输出时是否要保留过渡包裹语义。
    const appear = findProp(node, 'appear', false, true)
    wipMap.set(node, !!appear)
  }
}

export function ssrProcessTransition(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  // #5351: filter out comment children inside transition
  // Transition 运行时会忽略注释子节点，SSR 输出也要提前保持一致，
  // 否则 hydration 时节点数容易对不上。
  node.children = node.children.filter(c => c.type !== NodeTypes.COMMENT)

  const appear = wipMap.get(node)
  if (appear) {
    // appear 场景下，会额外包一层 `<template>` 占位，
    // 保持和客户端过渡初始结构更接近。
    context.pushStringPart(`<template>`)
    processChildren(node, context, false, true)
    context.pushStringPart(`</template>`)
  } else {
    processChildren(node, context, false, true)
  }
}
