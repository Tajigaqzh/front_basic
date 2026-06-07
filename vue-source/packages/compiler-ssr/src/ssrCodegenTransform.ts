import {
  type CompilerOptions,
  type RootNode,
  createBlockStatement,
  createCompoundExpression,
  createRoot,
  createSimpleExpression,
  createTransformContext,
  isText,
  processExpression,
} from '@vue-source/compiler-dom'
import { ssrHelpers } from './runtimeHelpers'
import {
  createSSRTransformContext,
  processChildren,
} from './ssrTransformContext'
import { ssrProcessIf } from './transforms/ssrVIf'
import { ssrProcessFor } from './transforms/ssrVFor'
import { ssrProcessSlotOutlet } from './transforms/ssrTransformSlotOutlet'
import { ssrProcessComponent } from './transforms/ssrTransformComponent'
import { ssrProcessElement } from './transforms/ssrTransformElement'

// Because SSR codegen output is completely different from client-side output
// (e.g. multiple elements can be concatenated into a single template literal
// instead of each getting a corresponding call), we need to apply an extra
// transform pass to convert the template AST into a fresh JS AST before
// passing it to codegen.

export function ssrCodegenTransform(
  ast: RootNode,
  options: CompilerOptions,
): void {
  // 这里开始的是 SSR 第二阶段：
  // 不再产出 vnode 调用树，而是产出专门给 server-renderer 用的 JS AST。
  const context = createSSRTransformContext(
    ast,
    options,
    {
      processIf: ssrProcessIf,
      processFor: ssrProcessFor,
      processSlotOutlet: ssrProcessSlotOutlet,
      processComponent: ssrProcessComponent,
      processElement: ssrProcessElement,
    },
  )

  // inject SFC <style> CSS variables
  // we do this instead of inlining the expression to ensure the vars are
  // only resolved once per render
  if (options.ssrCssVars) {
    // SSR 下的 CSS vars 不直接内联到每个节点上，而是先提成一个局部变量，
    // 保证整次 render 里只求值一次。
    const cssContext = createTransformContext(createRoot([]), options)
    const varsExp = processExpression(
      createSimpleExpression(options.ssrCssVars, false),
      cssContext,
    )
    context.body.push(
      createCompoundExpression([`const _cssVars = { style: `, varsExp, `}`]),
    )
    Array.from(cssContext.helpers.keys()).forEach(helper => {
      ast.helpers.add(helper)
    })
  }

  const isFragment =
    ast.children.length > 1 && ast.children.some(c => !isText(c))
  // children 会被直接展开成一串 `_push("...")`、条件语句、循环语句等语句节点。
  processChildren(ast, context, isFragment)
  ast.codegenNode = createBlockStatement(context.body)

  // Finalize helpers.
  // We need to separate helpers imported from '@vue-source/runtime-dom'
  // vs. '@vue-source/server-renderer'
  ast.ssrHelpers = Array.from(
    new Set([
      ...Array.from(ast.helpers).filter(h => h in ssrHelpers),
      ...context.helpers,
    ]),
  )

  // 普通 helpers 和 ssrHelpers 最后要拆开：
  // 一个来自 runtime-dom，另一个来自 server-renderer。
  ast.helpers = new Set(Array.from(ast.helpers).filter(h => !(h in ssrHelpers)))
}
