import type { CallExpression, VariableDeclarator } from '@babel/types'
import type { ScriptCompileContext } from './context'
import { processPropsDestructure } from './definePropsDestructure'
import { inferRuntimeType, resolveTypeElements } from './resolveType'
import { isCallOf, isRuntimeLiteralExpression, sliceNode } from './utils'

export const DEFINE_PROPS = 'defineProps'
export const WITH_DEFAULTS = 'withDefaults'

export function processDefineProps(
  decl: VariableDeclarator,
  source: string,
  ctx: ScriptCompileContext,
): boolean {
  const init = decl.init
  if (isCallOf(init, WITH_DEFAULTS)) {
    // withDefaults 本质上还是包了一层 defineProps，
    // 所以先走专门分支把两层关系拆开。
    return processWithDefaults(decl, source, ctx)
  }
  if (!isCallOf(init, DEFINE_PROPS)) {
    return false
  }
  const propsCall = init as CallExpression
  ctx.setup.hasDefinePropsCall = true
  // 如果是运行时字面量写法，例如 defineProps({ foo: String })，
  // 这里直接把原始对象代码片段切出来保存。
  ctx.propsDecl = getRuntimeDeclFromMacroCall(propsCall, source)
  if (propsCall.typeParameters?.params[0]) {
    const typeDecl = propsCall.typeParameters.params[0]
    ctx.propsTypeDecl = typeDecl as any
    if (!ctx.propsDecl) {
      // 纯类型写法时，再从 TS 类型反推运行时 props 结构。
      ctx.propsDecl = extractRuntimePropsFromType(ctx, typeDecl as any)
    }
  }
  if (decl.id.type === 'ObjectPattern') {
    // 解构场景需要额外记录本地变量和真实 props key 的映射关系。
    processPropsDestructure(ctx, decl.id)
  }
  return true
}

function processWithDefaults(
  decl: VariableDeclarator,
  source: string,
  ctx: ScriptCompileContext,
): boolean {
  const call = decl.init
  if (!call || call.type !== 'CallExpression') {
    return false
  }
  const first = call.arguments[0]
  if (!first || first.type !== 'CallExpression') {
    return false
  }
  if (!isCallOf(first, DEFINE_PROPS)) {
    return false
  }

  const normalizedDecl: VariableDeclarator = {
    ...decl,
    init: first,
  }
  // 先把里面那层 defineProps 当成普通 props 宏处理，
  // 然后再补记 defaults 对象。
  const matched = processDefineProps(normalizedDecl, source, ctx)
  if (!matched) {
    return false
  }

  const defaults = call.arguments[1]
  ctx.propsRuntimeDefaults = defaults ? sliceNode(source, defaults) : null
  return true
}

export function genRuntimeProps(ctx: ScriptCompileContext): string | null {
  let propsDecl = ctx.propsDecl

  if (propsDecl && ctx.propsDestructureDecl) {
    // 解构默认值例如 `const { foo = 1 } = defineProps()` 也要回灌到
    // 运行时 props 默认值里。
    const defaults = genDestructuredDefaults(ctx)
    if (defaults.length) {
      propsDecl = `mergeDefaults(${propsDecl}, { ${defaults.join(', ')} })`
    }
  }

  if (propsDecl && ctx.propsRuntimeDefaults) {
    // withDefaults 提供的是第二路默认值来源，最后统一 merge 进去。
    propsDecl = `mergeDefaults(${propsDecl}, ${ctx.propsRuntimeDefaults})`
  }

  return propsDecl
}

export function extractRuntimeProps(
  ctx: ScriptCompileContext,
): string | null {
  return genRuntimeProps(ctx)
}

function getRuntimeDeclFromMacroCall(call: VariableDeclarator['init'], source: string): string | null {
  if (!call || call.type !== 'CallExpression') return null
  const arg = call.arguments[0]
  if (!isRuntimeLiteralExpression(arg)) {
    // 不是运行时字面量时，说明不能直接切片成 props 声明，交给类型分支处理。
    return null
  }
  return sliceNode(source, arg)
}

function extractRuntimePropsFromType(
  ctx: ScriptCompileContext,
  node: any,
): string | null {
  // 这里把 TS 类型成员表逐项转换成 `{ type, required }` 结构，
  // 供运行时 props 选项直接使用。
  const resolved = resolveTypeElements(ctx, node)
  const entries = Object.entries(resolved.props)
  if (!entries.length) {
    return null
  }

  const props = entries.map(([key, value]) => {
    const runtimeTypes =
      value.type === 'TSPropertySignature' && value.typeAnnotation
        ? inferRuntimeType(ctx, value.typeAnnotation.typeAnnotation)
        : ['null']
    const required =
      value.type === 'TSPropertySignature' ? !value.optional : false
    const typeCode =
      runtimeTypes.length === 1
        ? runtimeTypes[0]
        : `[${runtimeTypes.join(', ')}]`
    return `${JSON.stringify(key)}: { type: ${typeCode}, required: ${required} }`
  })

  return `{ ${props.join(', ')} }`
}

function genDestructuredDefaults(ctx: ScriptCompileContext): string[] {
  const defaults: string[] = []

  for (const [key, binding] of Object.entries(ctx.propsDestructuredBindings)) {
    if (!binding.default) continue
    const value = ctx.slice(binding.default)
    if (!value) continue
    defaults.push(`${JSON.stringify(key)}: ${value}`)
  }

  return defaults
}
