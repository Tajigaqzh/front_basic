import { escapeHtml, toDisplayString } from '@vue-source/shared'

export function ssrInterpolate(value: unknown): string {
  return escapeHtml(toDisplayString(value))
}
