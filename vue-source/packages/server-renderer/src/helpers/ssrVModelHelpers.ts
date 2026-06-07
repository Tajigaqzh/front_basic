import { isArray, looseEqual, looseIndexOf } from '@vue-source/shared'
import { ssrRenderAttr } from './ssrRenderAttrs'

export const ssrLooseEqual = looseEqual as (a: unknown, b: unknown) => boolean

export function ssrLooseContain(arr: unknown[], value: unknown): boolean {
  return looseIndexOf(arr, value) > -1
}

// `v-model` 在服务端并不会建立双向绑定，
// 它做的事只是根据当前 model 值推导出首屏 HTML 上应该带什么属性。
export function ssrRenderDynamicModel(
  type: unknown,
  model: unknown,
  value: unknown,
): string {
  switch (type) {
    case 'radio':
      return looseEqual(model, value) ? ' checked' : ''
    case 'checkbox':
      return (isArray(model) ? ssrLooseContain(model, value) : model)
        ? ' checked'
        : ''
    default:
      return ssrRenderAttr('value', model)
  }
}

// 这个版本用于 `v-bind="obj"` 和 `v-model` 合并时，返回一个待 merge 的 props 片段。
export function ssrGetDynamicModelProps(
  existingProps: any = {},
  model: unknown,
): { checked: true } | { value: any } | null {
  const { type, value } = existingProps
  switch (type) {
    case 'radio':
      return looseEqual(model, value) ? { checked: true } : null
    case 'checkbox':
      return (isArray(model) ? ssrLooseContain(model, value) : model)
        ? { checked: true }
        : null
    default:
      return { value: model }
  }
}
