import {
  escapeHtml,
  isArray,
  isObject,
  isRenderableAttrValue,
  isSVGTag,
  stringifyStyle,
} from '@vue-source/shared'
import {
  includeBooleanAttr,
  isBooleanAttr,
  isOn,
  isSSRSafeAttrName,
  isString,
  makeMap,
  normalizeClass,
  normalizeCssVarValue,
  normalizeStyle,
  propsToAttrMap,
} from '@vue-source/shared'

// 这些 key 要么只在运行时有意义，要么会走专门分支，不能直接落成普通 HTML 属性。
const shouldIgnoreProp = /*@__PURE__*/ makeMap(
  `,key,ref,innerHTML,textContent,ref_key,ref_for`,
)

// 把 VNode props 转成起始标签上的属性字符串。
// 这里的核心目标不是“尽量多输出”，而是“只输出 SSR 安全且语义正确的内容”。
export function ssrRenderAttrs(
  props: Record<string, unknown>,
  tag?: string,
): string {
  let ret = ''
  for (let key in props) {
    if (
      shouldIgnoreProp(key) ||
      isOn(key) ||
      (tag === 'textarea' && key === 'value') ||
      // `.` 前缀表示强制走 DOM property，这类信息在 SSR HTML 中不应该直接输出。
      key.startsWith('.')
    ) {
      continue
    }
    const value = props[key]

    // `^` 前缀表示强制按 attribute 输出，即使默认映射更像 DOM property。
    if (key.startsWith('^')) key = key.slice(1)

    if (key === 'class') {
      ret += ` class="${ssrRenderClass(value)}"`
    } else if (key === 'style') {
      ret += ` style="${ssrRenderStyle(value)}"`
    } else if (key === 'className') {
      // `className` 在 SSR 中要直接转字符串，不能走 `normalizeClass`，
      // 否则对象/数组语义会和显式传 `className` 的预期不一致。
      if (value != null) {
        ret += ` class="${escapeHtml(String(value))}"`
      }
    } else {
      ret += ssrRenderDynamicAttr(key, value, tag)
    }
  }
  return ret
}

// 处理运行时才知道 key 的 attribute。
// 这里既要做 DOM 语义归一化，也要拦住不安全的属性名。
export function ssrRenderDynamicAttr(
  key: string,
  value: unknown,
  tag?: string,
): string {
  if (!isRenderableAttrValue(value)) {
    return ``
  }
  const attrKey =
    tag && (tag.indexOf('-') > 0 || isSVGTag(tag))
      ? key
      : propsToAttrMap[key] || key.toLowerCase()

  if (isBooleanAttr(attrKey)) {
    return includeBooleanAttr(value) ? ` ${attrKey}` : ``
  } else if (isSSRSafeAttrName(attrKey)) {
    return value === '' ? ` ${attrKey}` : ` ${attrKey}="${escapeHtml(value)}"`
  } else {
    console.warn(
      `[@vue-source/server-renderer] Skipped rendering unsafe attribute name: ${attrKey}`,
    )
    return ``
  }
}

// 静态 key 的 `v-bind` 在编译期已经确定好属性名，
// 这里主要负责“值是否可渲染”和 HTML 转义。
export function ssrRenderAttr(key: string, value: unknown): string {
  if (!isRenderableAttrValue(value)) {
    return ``
  }
  return ` ${key}="${escapeHtml(value)}"`
}

export function ssrRenderClass(raw: unknown): string {
  return escapeHtml(normalizeClass(raw))
}

export function ssrRenderStyle(raw: unknown): string {
  if (!raw) {
    return ''
  }
  if (isString(raw)) {
    return escapeHtml(raw)
  }
  const styles = normalizeStyle(ssrResetCssVars(raw))
  return escapeHtml(stringifyStyle(styles))
}

// `ssrCssVars` 会先把 CSS 变量名编码成 `:--foo`，
// 这里在最终字符串化前把它们恢复成合法的 `--foo`。
function ssrResetCssVars(raw: unknown) {
  if (!isArray(raw) && isObject(raw)) {
    const res: Record<string, unknown> = {}
    for (const key in raw) {
      if (key.startsWith(':--')) {
        res[key.slice(1)] = normalizeCssVarValue(raw[key])
      } else {
        res[key] = raw[key]
      }
    }
    return res
  }
  return raw
}
