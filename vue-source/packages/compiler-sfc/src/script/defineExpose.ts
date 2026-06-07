import type { VariableDeclarator } from '@babel/types'
import type { ScriptCompileContext } from './context'
import { isCallOf } from './utils'

export function processDefineExpose(
  decl: VariableDeclarator,
  ctx: ScriptCompileContext,
): boolean {
  if (!isCallOf(decl.init, 'defineExpose')) {
    return false
  }
  ctx.setup.hasDefineExposeCall = true
  // defineExpose 关心的核心信息就是“最终要向外暴露什么对象”，
  // 所以这里直接截取它的第一个参数源码片段保存。
  ctx.exposeDecl = ctx.slice(decl.init.arguments[0])
  return true
}
