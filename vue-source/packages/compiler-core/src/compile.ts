import type { CompilerOptions } from './options'
// 基础解析器入口。
import { baseParse } from './parser'
import {
  // 指令/节点转换类型和 transform 主流程。
  type DirectiveTransform,
  type NodeTransform,
  transform,
} from './transform'
// codegen 入口。
import { type CodegenResult, generate } from './codegen'
// 根 AST 类型。
import type { RootNode } from './ast'
// 工具函数：对象合并、字符串判断。
import { extend, isString } from '@vue-source/shared'
// 以下是 compiler-core 默认提供的节点转换器。
import { transformIf } from './transforms/vIf'
import { transformFor } from './transforms/vFor'
import { transformExpression } from './transforms/transformExpression'
import { transformSlotOutlet } from './transforms/transformSlotOutlet'
import { transformElement } from './transforms/transformElement'
import { transformOn } from './transforms/vOn'
import { transformBind } from './transforms/vBind'
import { trackSlotScopes, trackVForSlotScopes } from './transforms/vSlot'
import { transformText } from './transforms/transformText'
import { transformOnce } from './transforms/vOnce'
import { transformModel } from './transforms/vModel'
import { transformFilter } from './compat/transformFilter'
import { ErrorCodes, createCompilerError, defaultOnError } from './errors'
import { transformMemo } from './transforms/vMemo'
import { transformVBindShorthand } from './transforms/transformVBindShorthand'

// 预设 transform 由“节点转换器数组 + 指令转换表”组成。
export type TransformPreset = [
  NodeTransform[],
  Record<string, DirectiveTransform>,
]

export function getBaseTransformPreset(
  prefixIdentifiers?: boolean,
): TransformPreset {
  // compiler-core 默认的转换管线。
  // 顺序不能随便改，前面的转换会为后面的转换准备 AST 结构和作用域信息。
  return [
    [
      // 把 :foo 简写等语法糖先还原。
      transformVBindShorthand,
      // v-once / v-if / v-memo / v-for 会改写节点结构，必须尽早处理。
      transformOnce,
      transformIf,
      transformMemo,
      transformFor,
      ...(__COMPAT__ ? [transformFilter] : []),
      ...(!__BROWSER__ && prefixIdentifiers
        ? [
            // order is important
            // 先跟踪 v-for / slot 作用域，再处理表达式里的标识符前缀。
            trackVForSlotScopes,
            transformExpression,
          ]
        : __BROWSER__ && __DEV__
          // 浏览器开发环境下也做表达式处理，主要为错误提示和开发校验。
          ? [transformExpression]
          : []),
      // 处理 <slot/>、普通元素、slot 作用域和相邻文本合并。
      transformSlotOutlet,
      transformElement,
      trackSlotScopes,
      transformText,
    ],
    {
      // 指令级转换：把模板指令翻译成 VNode props / runtime helper 调用。
      on: transformOn,
      bind: transformBind,
      model: transformModel,
    },
  ]
}

// we name it `baseCompile` so that higher order compilers like
// @vue-source/compiler-dom can export `compile` while re-exporting everything else.
export function baseCompile(
  // 可以是模板源码，也可以是上游已经准备好的 AST。
  source: string | RootNode,
  // 编译选项，平台编译器通常会在这里注入自己的 transform。
  options: CompilerOptions = {},
): CodegenResult {
  // 编译总入口：parse -> transform -> generate。
  const onError = options.onError || defaultOnError
  const isModuleMode = options.mode === 'module'
  /* v8 ignore start */
  if (__BROWSER__) {
    if (options.prefixIdentifiers === true) {
      onError(createCompilerError(ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED))
    } else if (isModuleMode) {
      onError(createCompilerError(ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED))
    }
  }
  /* v8 ignore stop */

  const prefixIdentifiers =
    !__BROWSER__ && (options.prefixIdentifiers === true || isModuleMode)
  if (!prefixIdentifiers && options.cacheHandlers) {
    onError(createCompilerError(ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED))
  }
  if (options.scopeId && !isModuleMode) {
    onError(createCompilerError(ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED))
  }

  // 合并用户选项和编译器推导出的选项。
  const resolvedOptions = extend({}, options, {
    // prefixIdentifiers 可能由 mode 推导出来，因此统一写回最终选项。
    prefixIdentifiers,
  })
  // 输入既可能是模板字符串，也可能是上游已经构造好的 AST。
  const ast = isString(source) ? baseParse(source, resolvedOptions) : source
  // 取出默认节点转换器和指令转换器。
  const [nodeTransforms, directiveTransforms] =
    getBaseTransformPreset(prefixIdentifiers)

  if (!__BROWSER__ && options.isTS) {
    const { expressionPlugins } = options
    // 模板表达式最终仍交给 Babel 解析，所以 TS 模式要补上 typescript 插件。
    if (!expressionPlugins || !expressionPlugins.includes('typescript')) {
      options.expressionPlugins = [...(expressionPlugins || []), 'typescript']
    }
  }

  // transform 会原地改写 AST，并生成 codegen 所需的辅助信息。
  transform(
    ast,
    extend({}, resolvedOptions, {
      // 默认节点转换器在前，用户自定义转换器在后。
      nodeTransforms: [
        ...nodeTransforms,
        ...(options.nodeTransforms || []), // user transforms
      ],
      // 指令转换允许平台层或用户层按名称覆盖默认实现。
      directiveTransforms: extend(
        {},
        directiveTransforms,
        options.directiveTransforms || {}, // user transforms
      ),
    }),
  )

  // generate 读取 transform 产物，输出 render 函数字符串。
  return generate(ast, resolvedOptions)
}
