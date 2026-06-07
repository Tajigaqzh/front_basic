import type { CallExpression, Node, VariableDeclarator } from '@babel/types'
import type { ModelDecl } from '../compileScript'
import type { ScriptCompileContext } from './context'
import { isCallOf, isExpressionNode, sliceNode } from './utils'

export function processDefineModel(
  decl: VariableDeclarator,
  source: string,
  ctx: ScriptCompileContext,
): boolean {
  if (!isCallOf(decl.init, 'defineModel')) {
    return false
  }
  ctx.setup.hasDefineModelCall = true
  // defineModel 不会立刻生成最终代码，而是先提取成一条 ModelDecl 记录，
  // 后面再统一汇总为运行时 props / emits。
  ctx.modelsDecl.push(extractModelDecl(decl, source))
  return true
}

export function genRuntimeModelProps(modelsDecl: ModelDecl[]): string | null {
  if (modelsDecl.length === 0) {
    return null
  }

  // 每个 model 不只会生成一个 props 字段，还会额外生成 modifiers 字段，
  // 以承接 v-model 修饰符语义。
  const entries = modelsDecl.flatMap(model => {
    const base = normalizeObjectLiteral(model.options)
    const modifierKey =
      model.name === 'modelValue' ? 'modelModifiers' : `${model.name}Modifiers`
    return [
      `${JSON.stringify(model.name)}: ${base || '{}'}`,
      `${JSON.stringify(modifierKey)}: {}`,
    ]
  })

  return `{ ${entries.join(', ')} }`
}

function extractModelDecl(
  decl: VariableDeclarator,
  source: string,
): ModelDecl {
  const call = decl.init as CallExpression
  const args = call.arguments
  let name = 'modelValue'
  let options: Node | null = null

  if (args[0]?.type === 'StringLiteral') {
    // defineModel('value', options) 这种写法显式指定了 model 名字。
    name = args[0].value
    options = isExpressionNode(args[1]) ? args[1] : null
  } else {
    // 没传字符串名时，默认走 `modelValue`。
    options = isExpressionNode(args[0]) ? args[0] : null
  }

  return {
    name,
    local: getLocalName(decl.id),
    options: sliceNode(source, options),
  }
}

function getLocalName(id: Node): string | null {
  // defineModel 返回值既可能直接赋给单个变量，也可能是数组解构拿第一项。
  if (id.type === 'Identifier') {
    return id.name
  }
  if (id.type === 'ArrayPattern') {
    const first = id.elements[0]
    return first && first.type === 'Identifier' ? first.name : null
  }
  return null
}

function normalizeObjectLiteral(value: string | null): string {
  // 这里保留一个统一入口，后续如果要对对象字面量做更严格规范化，
  // 可以集中收敛在这个函数里。
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed : trimmed
}
