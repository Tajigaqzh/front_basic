// 引入命名空间枚举、AST 节点类型和解析器配置类型。
import { Namespaces, NodeTypes, type ParserOptions } from '@vue-source/compiler-core'
// 引入 HTML / SVG / MathML 标签判断工具。
import { isHTMLTag, isMathMLTag, isSVGTag, isVoidTag } from '@vue-source/shared'
// 引入内置组件对应的运行时 helper 标识。
import { TRANSITION, TRANSITION_GROUP } from './runtimeHelpers'
// 浏览器环境下用于解码 HTML 实体。
import { decodeHtmlBrowser } from './decodeHtmlBrowser'

// DOM 平台专用解析配置。
export const parserOptions: ParserOptions = {
  // 以 HTML 模式解析模板。
  parseMode: 'html',
  // 告诉解析器哪些标签是 void tag，例如 <img> / <br>。
  isVoidTag,
  // 原生标签判断：HTML、SVG、MathML 都算浏览器原生标签。
  isNativeTag: tag => isHTMLTag(tag) || isSVGTag(tag) || isMathMLTag(tag),
  // <pre> 会保留原始空白。
  isPreTag: tag => tag === 'pre',
  // 这些标签内首个换行需要被忽略，保持和浏览器解析行为一致。
  isIgnoreNewlineTag: tag => tag === 'pre' || tag === 'textarea',
  // 浏览器环境才直接使用 DOM 解码 HTML 实体；非浏览器可交给上层处理。
  decodeEntities: __BROWSER__ ? decodeHtmlBrowser : undefined,

  // 识别 DOM 编译器内置组件。
  isBuiltInComponent: tag => {
    // 兼容大小写不同的 Transition 写法。
    if (tag === 'Transition' || tag === 'transition') {
      return TRANSITION
    // 兼容 kebab-case 和 PascalCase 的 TransitionGroup。
    } else if (tag === 'TransitionGroup' || tag === 'transition-group') {
      return TRANSITION_GROUP
    }
  },

  // https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
  getNamespace(tag, parent, rootNamespace) {
    // 这里基本是在复刻浏览器 HTML/SVG/MathML 混合解析时的命名空间切换规则，
    // 让模板 AST 的 ns 信息尽量接近真实 DOM 解析结果。
    // 默认继承父节点命名空间；如果没有父节点，则继承根命名空间。
    let ns = parent ? parent.ns : rootNamespace
    // MathML 子树里的命名空间切换规则。
    if (parent && ns === Namespaces.MATH_ML) {
      // annotation-xml 是一个特殊节点，允许重新切到 SVG / HTML。
      if (parent.tag === 'annotation-xml') {
        // annotation-xml 里如果遇到 svg，切到 SVG 命名空间。
        if (tag === 'svg') {
          return Namespaces.SVG
        }
        // 某些 encoding 值表示其内容应该按 HTML 解析。
        if (
          parent.props.some(
            a =>
              a.type === NodeTypes.ATTRIBUTE &&
              a.name === 'encoding' &&
              a.value != null &&
              (a.value.content === 'text/html' ||
                a.value.content === 'application/xhtml+xml'),
          )
        ) {
          ns = Namespaces.HTML
        }
      // 某些 MathML 标签的子节点按 HTML 规则解析，除了两个例外标签。
      } else if (
        /^m(?:[ions]|text)$/.test(parent.tag) &&
        tag !== 'mglyph' &&
        tag !== 'malignmark'
      ) {
        ns = Namespaces.HTML
      }
    // SVG 子树里，部分标签内部重新回到 HTML 命名空间。
    } else if (parent && ns === Namespaces.SVG) {
      if (
        parent.tag === 'foreignObject' ||
        parent.tag === 'desc' ||
        parent.tag === 'title'
      ) {
        ns = Namespaces.HTML
      }
    }

    // 处于普通 HTML 命名空间时，遇到 svg / math 入口节点则切换命名空间。
    if (ns === Namespaces.HTML) {
      if (tag === 'svg') {
        return Namespaces.SVG
      }
      if (tag === 'math') {
        return Namespaces.MATH_ML
      }
    }
    // 默认返回当前推导出的命名空间。
    return ns
  },
}
