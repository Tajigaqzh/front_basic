/**
 * 文件作用：处理某一类 DOM 属性写入。
 *
 * 当前文件 style.ts 专门负责一类浏览器属性更新策略，
 * 让 patchProp 可以把总分发继续下沉到更细的实现里。
 */

import { capitalize, hyphenate, isArray, isString } from '@vue-source/shared'
import { camelize, warn } from '@vue-source/runtime-core'
import {
  type VShowElement,
  vShowHidden,
  vShowOriginalDisplay,
} from '../directives/vShow'
import { CSS_VAR_TEXT } from '../helpers/useCssVars'

type Style = string | Record<string, string | string[]> | null

// 用来判断整段 style 字符串里是否直接控制了 `display`，这样才能和 `v-show` 协同。
const displayRE = /(?:^|;)\s*display\s*:/

/**
 * 作用：对比前后 `style`，把 vnode 上的样式同步到真实 DOM。
 *
 * 参数说明：
 * - `el`：目标元素。
 * - `prev`：更新前的样式值，可能是对象、字符串或空。
 * - `next`：更新后的样式值，可能是对象、字符串或空。
 *
 * 依赖关系：
 * - 由 `patchProp` 在 key 为 `style` 时调用。
 * - 内部依赖 `setStyle`、`autoPrefix` 和 `v-show` 指令留下的标记字段。
 *
 * 链路位置：
 * - `renderer.ts -> hostPatchProp -> patchProp -> patchStyle`
 */
export function patchStyle(el: Element, prev: Style, next: Style): void {
  const style = (el as HTMLElement).style
  const isCssString = isString(next)
  // 这个标记用于记录用户传入的样式里是否显式控制 `display`。
  let hasControlledDisplay = false
  if (next && !isCssString) {
    if (prev) {
      if (!isString(prev)) {
        // 对象样式更新时，先把旧对象里已不存在的字段清掉。
        for (const key in prev) {
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      } else {
        // 上一次是字符串样式时，需要先把旧字符串拆开做差异清理。
        for (const prevStyle of prev.split(';')) {
          const key = prevStyle.slice(0, prevStyle.indexOf(':')).trim()
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      }
    }
    for (const key in next) {
      if (key === 'display') {
        hasControlledDisplay = true
      }
      const value = next[key]
      if (value != null) {
        // textarea 原生拖拽尺寸时，某些 width/height 需要保留浏览器实际结果。
        if (
          !shouldPreserveTextareaResizeStyle(
            el,
            key,
            !isString(prev) && prev ? prev[key] : undefined,
            value,
          )
        ) {
          setStyle(style, key, value)
        }
      } else {
        setStyle(style, key, '')
      }
    }
  } else {
    if (isCssString) {
      if (prev !== next) {
        // CSS 变量文本由 `useCssVars` 维护，这里要拼回去避免被整段覆盖掉。
        const cssVarText = (style as any)[CSS_VAR_TEXT]
        if (cssVarText) {
          ;(next as string) += ';' + cssVarText
        }
        style.cssText = next as string
        hasControlledDisplay = displayRE.test(next)
      }
    } else if (prev) {
      el.removeAttribute('style')
    }
  }
  // 元素上存在这个标记，表示当前节点还受 `v-show` 控制。
  if (vShowOriginalDisplay in el) {
    // 当节点重新显示时，`v-show` 需要恢复这里记录下来的 display。
    el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : ''
    // 如果当前仍处于隐藏态，`v-show` 的结果优先级高于普通样式绑定。
    if ((el as VShowElement)[vShowHidden]) {
      style.display = 'none'
    }
  }
}

const semicolonRE = /[^\\];\s*$/
const importantRE = /\s*!important$/

/**
 * 作用：把单个样式声明写入 `style` 对象。
 *
 * 参数说明：
 * - `style`：真实 DOM 的 `CSSStyleDeclaration`。
 * - `name`：样式名，可能是短横线形式，也可能是 CSS 变量。
 * - `val`：样式值，支持字符串和回退数组。
 *
 * 依赖关系：
 * - 由 `patchStyle` 在遍历样式差异时调用。
 * - 内部会继续使用 `autoPrefix` 处理浏览器前缀。
 */
function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[],
) {
  if (isArray(val)) {
    val.forEach(v => setStyle(style, name, v))
  } else {
    if (val == null) val = ''
    if (__DEV__) {
      if (semicolonRE.test(val)) {
        warn(
          `Unexpected semicolon at the end of '${name}' style value: '${val}'`,
        )
      }
    }
    if (name.startsWith('--')) {
      // 自定义 CSS 变量必须通过 `setProperty` 写入。
      style.setProperty(name, val)
    } else {
      const prefixed = autoPrefix(style, name)
      if (importantRE.test(val)) {
        // `!important` 不能直接赋值，只能走 `setProperty` 第三个参数。
        style.setProperty(
          hyphenate(prefixed),
          val.replace(importantRE, ''),
          'important',
        )
      } else {
        style[prefixed as any] = val
      }
    }
  }
}

const prefixes = ['Webkit', 'Moz', 'ms']
// 前缀缓存避免每次样式更新都重复探测浏览器支持的字段名。
const prefixCache: Record<string, string> = {}

/**
 * 作用：为运行时样式名找到浏览器可识别的最终字段名。
 */
function autoPrefix(style: CSSStyleDeclaration, rawName: string): string {
  const cached = prefixCache[rawName]
  if (cached) {
    return cached
  }
  let name = camelize(rawName)
  if (name !== 'filter' && name in style) {
    return (prefixCache[rawName] = name)
  }
  name = capitalize(name)
  for (let i = 0; i < prefixes.length; i++) {
    const prefixed = prefixes[i] + name
    if (prefixed in style) {
      return (prefixCache[rawName] = prefixed)
    }
  }
  return rawName
}

/**
 * 作用：判断 textarea 在原生 resize 后，当前样式项是否应该保留浏览器刚刚产生的尺寸。
 */
function shouldPreserveTextareaResizeStyle(
  el: Element,
  key: string,
  prev: string | string[] | undefined,
  next: string | string[],
): boolean {
  return (
    el.tagName === 'TEXTAREA' &&
    (key === 'width' || key === 'height') &&
    isString(next) &&
    prev === next
  )
}
