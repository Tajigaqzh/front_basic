import type { VariableDeclarator } from '@babel/types'
import type { ScriptCompileContext } from './context'
import { isCallOf } from './utils'

export function processDefineSlots(
  decl: VariableDeclarator,
  ctx: ScriptCompileContext,
): boolean {
  if (!isCallOf(decl.init, 'defineSlots')) {
    return false
  }
  ctx.setup.hasDefineSlotsCall = true
  // defineSlots 更多是给编译期和类型系统提供 slot 形状信息，
  // 这里保留整段调用源码，后续如果需要还能继续分析。
  ctx.slotsDecl = ctx.slice(decl.init)
  return true
}
