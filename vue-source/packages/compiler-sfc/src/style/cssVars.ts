import type { SFCDescriptor } from '../parse'

export function genCssVarsFromList(
  vars: string[],
  id: string,
  _isProd = false,
  isSSR = false,
): string {
  // 把收集到的变量名生成为“作用域化 CSS 自定义属性 -> JS 表达式”的映射。
  // SSR 与 DOM 在 key 前缀上略有区别，所以这里通过 isSSR 分支区分。
  return `{\n  ${vars
    .map(key => `"${isSSR ? ':--' : '--'}${id}-${key}": (${key})`)
    .join(',\n  ')}\n}`
}

export function parseCssVars(source: string | SFCDescriptor): string[] {
  // 既支持单段 CSS 字符串，也支持整个 SFC descriptor。
  // descriptor 场景下会把多个 `<style>` block 拼接后统一扫描。
  const content =
    typeof source === 'string'
      ? source
      : source.styles.map(style => style.content).join('\n')
  // 这份教学实现先保留最关键的依赖收集逻辑：找到所有 `v-bind(...)`
  // 里声明的表达式名字，供 style 与 SSR template 编译阶段复用。
  const matches = content.match(/v-bind\s*\(([^)]+)\)/g) || []
  return matches
    .map(item => item.replace(/^v-bind\s*\(/, '').replace(/\)$/, '').trim())
    .filter(Boolean)
}
