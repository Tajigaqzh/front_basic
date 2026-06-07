import type { AwaitExpression } from '@babel/types'
import type { ScriptCompileContext } from './context'

export function processAwait(
  ctx: ScriptCompileContext,
  node: AwaitExpression,
  needSemi: boolean,
  isStatement: boolean,
): string {
  const argument = ctx.slice(node.argument) || ''
  // 如果 await 参数内部还嵌着 await，包装函数自身也必须是 async，
  // 否则新的包裹层和原表达式的求值语义会对不上。
  const containsNestedAwait = /\bawait\b/.test(argument)
  // 这里生成的是一段带 withAsyncContext 的包装代码：
  // 先捕获当前组件上下文，await 完成后再恢复，避免顶层 await 打断 setup 上下文。
  return `${needSemi ? ';' : ''}(\n  ([__temp,__restore] = ${ctx.helper(
    'withAsyncContext',
  )}(${containsNestedAwait ? 'async ' : ''}() => ${argument})),\n  ${
    isStatement ? '' : '__temp = '
  }await __temp,\n  __restore()${isStatement ? '' : ',\n  __temp'}\n)`
}
