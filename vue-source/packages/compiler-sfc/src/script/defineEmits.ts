import type { VariableDeclarator } from '@babel/types'
import type { ScriptCompileContext } from './context'
import { isCallOf, isRuntimeLiteralExpression, sliceNode } from './utils'

export function processDefineEmits(
  decl: VariableDeclarator,
  source: string,
  ctx: ScriptCompileContext,
): boolean {
  if (!isCallOf(decl.init, 'defineEmits')) {
    return false
  }
  ctx.setup.hasDefineEmitsCall = true
  // defineEmits 的核心信息就是“运行时 emits 声明长什么样”，
  // 所以这里直接切原始字面量代码片段保存。
  ctx.emitsDecl = getRuntimeDeclFromMacroCall(decl.init, source)
  return true
}

export function genRuntimeEmits(
  emitsDecl: string | null,
  modelNames: string[],
): string | null {
  // defineModel 会隐式引入 `update:xxx` 事件，这里要和普通 emits 声明合并。
  const modelEmits =
    modelNames.length > 0
      ? `[${modelNames.map(name => `'update:${name}'`).join(', ')}]`
      : null

  if (emitsDecl && modelEmits) {
    return `mergeModels(${emitsDecl}, ${modelEmits})`
  }
  return emitsDecl || modelEmits
}

export function extractRuntimeEmits(
  ctx: ScriptCompileContext,
): string | null {
  return genRuntimeEmits(
    ctx.emitsDecl,
    ctx.modelsDecl.map(model => model.name),
  )
}

function getRuntimeDeclFromMacroCall(call: VariableDeclarator['init'], source: string): string | null {
  if (!call || call.type !== 'CallExpression') return null
  const arg = call.arguments[0]
  if (!isRuntimeLiteralExpression(arg)) {
    return null
  }
  return sliceNode(source, arg)
}
