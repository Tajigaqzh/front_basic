import {
  type CodegenResult,
  type CompilerOptions,
  type RootNode,
  baseParse,
  generate,
  noopDirectiveTransform,
  parserOptions,
  trackSlotScopes,
  trackVForSlotScopes,
  transform,
  transformBind,
  transformExpression,
  transformOn,
  transformStyle,
  transformVBindShorthand,
} from '@vue-source/compiler-dom'
import { ssrCodegenTransform } from './ssrCodegenTransform'
import { ssrTransformElement } from './transforms/ssrTransformElement'
import {
  rawOptionsMap,
  ssrTransformComponent,
} from './transforms/ssrTransformComponent'
import { ssrTransformSlotOutlet } from './transforms/ssrTransformSlotOutlet'
import { ssrTransformIf } from './transforms/ssrVIf'
import { ssrTransformFor } from './transforms/ssrVFor'
import { ssrTransformModel } from './transforms/ssrVModel'
import { ssrTransformShow } from './transforms/ssrVShow'
import { ssrInjectFallthroughAttrs } from './transforms/ssrInjectFallthroughAttrs'
import { ssrInjectCssVars } from './transforms/ssrInjectCssVars'

export function compile(
  source: string | RootNode,
  options: CompilerOptions = {},
): CodegenResult {
  // SSR 编译不是一套完全独立的 parser，它先尽量复用 compiler-dom/compiler-core
  // 的解析与第一轮 transform，只是在选项层面强制切到 SSR 模式。
  options = {
    ...options,
    ...parserOptions,
    ssr: true,
    inSSR: true,
    scopeId: options.mode === 'function' ? null : options.scopeId,
    // always prefix since compiler-ssr doesn't have size concern
    prefixIdentifiers: true,
    // disable optimizations that are unnecessary for ssr
    cacheHandlers: false,
    hoistStatic: false,
  }

  const ast = typeof source === 'string' ? baseParse(source, options) : source

  // Save raw options for AST. This is needed when performing sub-transforms
  // on slot vnode branches.
  // 某些子流程（例如组件 slot 的 vnode fallback 分支）后面还要重新做一遍
  // vnode 风格 transform，所以先把原始选项挂到 ast 上备用。
  rawOptionsMap.set(ast, options)

  transform(ast, {
    ...options,
    hoistStatic: false,
    nodeTransforms: [
      transformVBindShorthand,
      ssrTransformIf,
      ssrTransformFor,
      trackVForSlotScopes,
      transformExpression,
      ssrTransformSlotOutlet,
      ssrInjectFallthroughAttrs,
      ssrInjectCssVars,
      ssrTransformElement,
      ssrTransformComponent,
      trackSlotScopes,
      transformStyle,
      // 用户自定义 transform 仍插在第一轮模板 transform 里，
      // 这样它们看到的还是接近普通 template AST 的结构。
      ...(options.nodeTransforms || []), // user transforms
    ],
    directiveTransforms: {
      // reusing core v-bind
      bind: transformBind,
      on: transformOn,
      // model and show have dedicated SSR handling
      model: ssrTransformModel,
      show: ssrTransformShow,
      // the following are ignored during SSR
      // on: noopDirectiveTransform,
      cloak: noopDirectiveTransform,
      once: noopDirectiveTransform,
      memo: noopDirectiveTransform,
      ...(options.directiveTransforms || {}), // user transforms
    },
  })

  // traverse the template AST and convert into SSR codegen AST
  // by replacing ast.codegenNode.
  // 第一轮 transform 结束后，AST 里仍然主要是“模板语义节点”。
  // 第二轮 ssrCodegenTransform 才会把它们改造成 `_push(...)` 风格的 JS AST。
  ssrCodegenTransform(ast, options)

  return generate(ast, options)
}
