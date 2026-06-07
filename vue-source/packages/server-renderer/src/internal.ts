// 这些导出主要给 SSR 编译结果调用，不是面向普通业务代码的公开 API。
export { renderVNode as ssrRenderVNode } from './render'
export { ssrRenderComponent } from './helpers/ssrRenderComponent'
export { ssrRenderSlot, ssrRenderSlotInner } from './helpers/ssrRenderSlot'
export { ssrRenderTeleport } from './helpers/ssrRenderTeleport'
export {
  ssrRenderClass,
  ssrRenderStyle,
  ssrRenderAttrs,
  ssrRenderAttr,
  ssrRenderDynamicAttr,
} from './helpers/ssrRenderAttrs'
export { ssrInterpolate } from './helpers/ssrInterpolate'
export { ssrRenderList } from './helpers/ssrRenderList'
export { ssrRenderSuspense } from './helpers/ssrRenderSuspense'
export { ssrGetDirectiveProps } from './helpers/ssrGetDirectiveProps'
export { includeBooleanAttr as ssrIncludeBooleanAttr } from '@vue-source/shared'

// `v-model` 的 SSR 生成代码会依赖这些辅助函数推导 checked/value。
export {
  ssrLooseEqual,
  ssrLooseContain,
  ssrRenderDynamicModel,
  ssrGetDynamicModelProps,
} from './helpers/ssrVModelHelpers'
