import { escapeHtml, toDisplayString } from '@vue-source/shared'

// SSR 插值和客户端模板插值语义一致：
// 先按 Vue 规则转成展示字符串，再做 HTML 转义，避免注入原始标签。
export function ssrInterpolate(value: unknown): string {
  return escapeHtml(toDisplayString(value))
}
