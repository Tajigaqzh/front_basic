/**
 * 文件作用：封装浏览器环境下的原子 DOM 操作。
 *
 * 这份文件负责创建、插入、删除、移动节点，以及插入静态内容，
 * 是 runtime-core 在 DOM 环境里真正操作节点时依赖的宿主实现。
 */

import { warn } from '@vue-source/runtime-core'
import type { RendererOptions } from '@vue-source/runtime-core'
import type {
  TrustedHTML,
  TrustedTypePolicy,
  TrustedTypesWindow,
} from 'trusted-types/lib'

/**
 * Trusted Types 策略对象。
 *
 * 作用：
 * - 把字符串包装成可用于 `innerHTML` 的受信任值
 * - 供静态内容插入等必须写 HTML 的路径复用
 */
let policy: Pick<TrustedTypePolicy, 'name' | 'createHTML'> | undefined =
  undefined

/**
 * 浏览器暴露的 trustedTypes 全局入口。
 */
const tt =
  typeof window !== 'undefined' &&
  (window as unknown as TrustedTypesWindow).trustedTypes

if (tt) {
  try {
    policy = /*@__PURE__*/ tt.createPolicy('vue', {
      createHTML: val => val,
    })
  } catch (e: unknown) {
    // 同名策略在某些 CSP 配置下不允许重复创建，这里只能降级继续运行。
    // `createPolicy` throws a TypeError if the name is a duplicate
    // and the CSP trusted-types directive is not using `allow-duplicates`.
    // So we have to catch that error.
    __DEV__ && warn(`Error creating trusted types policy: ${e}`)
  }
}

// __UNSAFE__
// Reason: potentially setting innerHTML.
// This function merely perform a type-level trusted type conversion
// for use in `innerHTML` assignment, etc.
// Be careful of whatever value passed to this function.
export const unsafeToTrustedHTML: (value: string) => TrustedHTML | string =
  policy ? val => policy.createHTML(val) : val => val

// SVG / MathML 需要走 namespace API 创建元素，否则浏览器会按普通 HTML 元素处理。
export const svgNS = 'http://www.w3.org/2000/svg'
export const mathmlNS = 'http://www.w3.org/1998/Math/MathML'

/**
 * 当前文档对象。
 */
const doc = (typeof document !== 'undefined' ? document : null) as Document

/**
 * 解析静态 HTML 片段时复用的模板容器。
 */
const templateContainer = doc && /*@__PURE__*/ doc.createElement('template')

/**
 * DOM 环境下的宿主操作集。
 *
 * runtime-core 会把这些能力当成 `hostInsert / hostRemove / hostCreateElement`
 * 等底层操作来调用。
 */
export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  insert: (child, parent, anchor) => {
    // 所有元素/文本/注释/片段最终都会落到这一个“插入宿主节点”原语上。
    // `anchor` 为空时等价于 appendChild；有值时表示插到指定锚点前。
    parent.insertBefore(child, anchor || null)
  },

  remove: child => {
    const parent = child.parentNode
    if (parent) {
      // 删除前先判 parent，兼容“节点已被别处移走”的场景。
      parent.removeChild(child)
    }
  },

  createElement: (tag, namespace, is, props): Element => {
    // 不同命名空间要走不同创建 API；`is` 仅用于原生 customized built-in element。
    const el =
      namespace === 'svg'
        ? doc.createElementNS(svgNS, tag)
        : namespace === 'mathml'
          ? doc.createElementNS(mathmlNS, tag)
          : is
            ? doc.createElement(tag, { is })
            : doc.createElement(tag)

    if (tag === 'select' && props && props.multiple != null) {
      // `multiple` 在某些浏览器里需要作为 attribute 明确存在，不能只依赖 props。
      ;(el as HTMLSelectElement).setAttribute('multiple', props.multiple)
    }

    return el
  },

  createText: text => doc.createTextNode(text),

  createComment: text => doc.createComment(text),

  setText: (node, text) => {
    // 文本 vnode 更新最终会落到这里。
    node.nodeValue = text
  },

  setElementText: (el, text) => {
    // 元素直接设置纯文本 children 时，走 `textContent` 比逐子节点 patch 更直接。
    el.textContent = text
  },

  parentNode: node => node.parentNode as Element | null,

  nextSibling: node => node.nextSibling,

  querySelector: selector => doc.querySelector(selector),

  setScopeId(el, id) {
    // scoped CSS 本质上就是给元素补一个形如 `data-v-xxx` 的属性。
    el.setAttribute(id, '')
  },

  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  /**
   * 批量插入静态内容。
   *
   * 作用：
   * - 对编译阶段提升出来的静态片段走更快路径
   * - 已有缓存边界时直接 clone
   * - 否则借助 template 一次性解析整段 HTML
   */
  insertStaticContent(content, parent, anchor, namespace, start, end) {
    // <parent> before | first ... last | anchor </parent>
    const before = anchor ? anchor.previousSibling : parent.lastChild
    // #5308 can only take cached path if:
    // - has a single root node
    // - nextSibling info is still available
    if (start && (start === end || start.nextSibling)) {
      // cached
      while (true) {
        // 命中缓存边界时直接 clone 现成节点，避免再次解析 HTML 字符串。
        parent.insertBefore(start!.cloneNode(true), anchor)
        if (start === end || !(start = start!.nextSibling)) break
      }
    } else {
      // fresh insert
      templateContainer.innerHTML = unsafeToTrustedHTML(
        namespace === 'svg'
          ? `<svg>${content}</svg>`
          : namespace === 'mathml'
            ? `<math>${content}</math>`
            : content,
      ) as string

      const template = templateContainer.content
      if (namespace === 'svg' || namespace === 'mathml') {
        // 外层包装标签只用于借浏览器正确解析命名空间，落真实节点时要去掉。
        // remove outer svg/math wrapper
        const wrapper = template.firstChild!
        while (wrapper.firstChild) {
          template.appendChild(wrapper.firstChild)
        }
        template.removeChild(wrapper)
      }
      parent.insertBefore(template, anchor)
    }
    return [
      // first：静态片段插入后的起始节点，供后续 block/fragment 复用缓存边界。
      before ? before.nextSibling! : parent.firstChild!,
      // last：静态片段插入后的结束节点。
      anchor ? anchor.previousSibling! : parent.lastChild!,
    ]
  },
}
