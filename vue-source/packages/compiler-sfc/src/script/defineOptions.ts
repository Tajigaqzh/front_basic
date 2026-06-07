import type { VariableDeclarator } from '@babel/types'
import type { ScriptCompileContext } from './context'
import { isCallOf } from './utils'

export function processDefineOptions(
  decl: VariableDeclarator,
  ctx: ScriptCompileContext,
): boolean {
  if (!isCallOf(decl.init, 'defineOptions')) {
    return false
  }
  ctx.setup.hasDefineOptionsCall = true
  // defineOptions 本质上是在 `<script setup>` 里补一段组件 options，
  // 所以这里只提取它传入的对象参数。
  ctx.optionsDecl = ctx.slice(decl.init.arguments[0])
  return true
}
