import {
  // 代码生成结果类型。
  type CodegenResult,
  // 对外暴露的编译选项。
  type CompilerOptions,
  // 指令转换函数类型。
  type DirectiveTransform,
  // AST 节点转换函数类型。
  type NodeTransform,
  // 解析阶段配置类型。
  type ParserOptions,
  // 编译器根节点类型。
  type RootNode,
  // compiler-core 提供的通用编译入口。
  baseCompile,
  // compiler-core 提供的通用解析入口。
  baseParse,
  // 什么都不做的指令转换，用于如 v-cloak 这类仅保留语义的指令。
  noopDirectiveTransform,
} from '@vue-source/compiler-core'
// DOM 平台专属的解析配置。
import { parserOptions } from './parserOptions'
// 把静态 style 属性转成动态 style 表达式。
import { transformStyle } from './transforms/transformStyle'
// 处理 v-html。
import { transformVHtml } from './transforms/vHtml'
// 处理 v-text。
import { transformVText } from './transforms/vText'
// DOM 平台专用 v-model 转换，会覆盖 core 默认实现。
import { transformModel } from './transforms/vModel'
// DOM 平台专用 v-on 转换，会覆盖 core 默认实现。
import { transformOn } from './transforms/vOn'
// 处理 v-show。
import { transformShow } from './transforms/vShow'
// Transition 组件相关校验和补充处理。
import { transformTransition } from './transforms/Transition'
// 非浏览器构建下，把静态内容尽量字符串化提升性能。
import { stringifyStatic } from './transforms/stringifyStatic'
// 编译时忽略 script / style 这类带副作用标签。
import { ignoreSideEffectTags } from './transforms/ignoreSideEffectTags'
// 开发环境下校验 HTML 嵌套是否合法。
import { validateHtmlNesting } from './transforms/validateHtmlNesting'
// 浅合并工具，用来拼接平台默认配置和用户配置。
import { extend } from '@vue-source/shared'

// 对外导出 DOM 解析配置，供外部直接复用。
export { parserOptions }

// DOM 平台默认节点转换器列表。
export const DOMNodeTransforms: NodeTransform[] = [
  // 把 style="a:b" 预处理成 :style="{ a: 'b' }"。
  transformStyle,
  // 开发环境下才保留这些额外校验，避免生产环境增加体积。
  ...(__DEV__ ? [transformTransition, validateHtmlNesting] : []),
]

// DOM 平台默认指令转换表。
export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  // v-cloak 不参与代码生成，只保留空转换占位。
  cloak: noopDirectiveTransform,
  // v-html -> innerHTML。
  html: transformVHtml,
  // v-text -> textContent。
  text: transformVText,
  // 覆盖 core 的通用 v-model，改用 DOM 特化逻辑。
  model: transformModel, // override compiler-core
  // 覆盖 core 的通用 v-on，处理事件修饰符等 DOM 语义。
  on: transformOn, // override compiler-core
  // v-show 需要运行时指令配合。
  show: transformShow,
}

// compiler-dom 的总编译入口。
export function compile(
  // 可以传模板字符串，也可以直接传已经构造好的根 AST。
  src: string | RootNode,
  // 用户自定义选项，默认空对象。
  options: CompilerOptions = {},
): CodegenResult {
  // 在 compiler-core 的基础编译流程上，注入 DOM 平台配置。
  return baseCompile(
    src,
    extend({}, parserOptions, options, {
      // compiler-dom 的本质不是重写整条编译链，而是在 compiler-core 默认流程前后
      // 补一层“浏览器平台特化配置”。
      // 组装节点转换器执行顺序。
      nodeTransforms: [
        // ignore <script> and <tag>
        // this is not put inside DOMNodeTransforms because that list is used
        // by compiler-ssr to generate vnode fallback branches
        // 先移除有副作用的标签，避免后续 transform 继续处理它们。
        ignoreSideEffectTags,
        // 再执行 DOM 默认节点转换。
        ...DOMNodeTransforms,
        // 最后拼接用户自定义节点转换器，让用户有机会扩展行为。
        ...(options.nodeTransforms || []),
      ],
      // 指令转换表同样采用“默认 + 用户覆盖”的合并方式。
      directiveTransforms: extend(
        {},
        DOMDirectiveTransforms,
        options.directiveTransforms || {},
      ),
      // 静态节点字符串化是偏 SSR / 非浏览器构建的优化；
      // 浏览器端保留普通 vnode 生成路径即可。
      // 浏览器构建不做静态字符串提升，非浏览器环境下再启用。
      transformHoist: __BROWSER__ ? null : stringifyStatic,
    }),
  )
}

// 仅执行模板解析，不进入 transform / codegen。
export function parse(template: string, options: ParserOptions = {}): RootNode {
  // 解析时同样自动带上 DOM 平台的 parserOptions。
  return baseParse(template, extend({}, parserOptions, options))
}

// 导出 DOM 运行时 helper 符号映射。
export * from './runtimeHelpers'
// 单独导出 style transform，方便外部按需复用。
export { transformStyle } from './transforms/transformStyle'
// 导出 DOM 编译错误定义。
export {
  createDOMCompilerError,
  DOMErrorCodes,
  DOMErrorMessages,
} from './errors'
// 透传 compiler-core 的其他能力，方便使用方统一从 compiler-dom 引入。
export * from '@vue-source/compiler-core'
