import type {
  Node,
  TSInterfaceDeclaration,
  TSMethodSignature,
  TSPropertySignature,
  TSType,
  TSTypeElement,
  TSTypeLiteral,
} from '@babel/types'
import type { ScriptCompileContext } from './context'

export interface ResolvedTypeElements {
  props: Record<string, TSPropertySignature | TSMethodSignature>
  calls?: TSMethodSignature[]
}

export function resolveTypeElements(
  _ctx: ScriptCompileContext,
  node: Node,
): ResolvedTypeElements {
  // 先把不同外形的 TS 类型声明统一规整成“成员表”，
  // 后面生成运行时 props 时就能按 key 直接查。
  if (node.type === 'TSTypeLiteral') {
    return typeElementsToMap(node)
  }
  if (node.type === 'TSInterfaceDeclaration') {
    return typeElementsToMap(node.body)
  }
  if (node.type === 'TSTypeAnnotation') {
    return resolveTypeElements(_ctx, node.typeAnnotation)
  }
  return { props: {} }
}

export function inferRuntimeType(
  _ctx: ScriptCompileContext,
  node: TSType | undefined,
): string[] {
  if (!node) return ['null']

  // 这里做的是“TS 类型 -> 运行时构造器类别”的近似映射，
  // 目标是生成 props.type 可用的结果，而不是完整保留 TS 语义。
  switch (node.type) {
    case 'TSStringKeyword':
      return ['String']
    case 'TSNumberKeyword':
      return ['Number']
    case 'TSBooleanKeyword':
      return ['Boolean']
    case 'TSObjectKeyword':
      return ['Object']
    case 'TSFunctionType':
      return ['Function']
    case 'TSArrayType':
    case 'TSTupleType':
      return ['Array']
    case 'TSLiteralType':
      if (node.literal.type === 'StringLiteral') return ['String']
      if (node.literal.type === 'NumericLiteral') return ['Number']
      if (node.literal.type === 'BooleanLiteral') return ['Boolean']
      return ['null']
    case 'TSUnionType':
      // 联合类型把每个分支的运行时类型都收集起来，再去重。
      return unique(node.types.flatMap(type => inferRuntimeType(_ctx, type)))
    case 'TSTypeLiteral':
      return ['Object']
    case 'TSTypeReference':
      if (node.typeName.type === 'Identifier') {
        const name = node.typeName.name
        if (name === 'Array') return ['Array']
        if (name === 'Function') return ['Function']
        if (name === 'Object') return ['Object']
        if (name === 'String') return ['String']
        if (name === 'Number') return ['Number']
        if (name === 'Boolean') return ['Boolean']
      }
      return ['Object']
    default:
      return ['null']
  }
}

function typeElementsToMap(
  node: TSTypeLiteral | TSInterfaceDeclaration['body'],
): ResolvedTypeElements {
  const props: Record<string, TSPropertySignature | TSMethodSignature> = {}
  const calls: TSMethodSignature[] = []
  const members = node.type === 'TSTypeLiteral' ? node.members : node.body

  for (const member of members) {
    const key = getTypeElementName(member)
    if (!key) continue
    if (member.type === 'TSPropertySignature' || member.type === 'TSMethodSignature') {
      // 保存“成员名 -> 类型节点”的映射，方便后续逐项生成
      // `{ type, required }` 这样的运行时 props 描述。
      props[key] = member
      if (member.type === 'TSMethodSignature') {
        calls.push(member)
      }
    }
  }

  return calls.length ? { props, calls } : { props }
}

function getTypeElementName(
  node: TSTypeElement,
): string | null {
  // 这里只接受静态可解析的 key，拿不到确定名字的成员会直接跳过。
  if (!('key' in node) || !node.key) {
    return null
  }
  const key = node.key
  if (key.type === 'Identifier') return key.name
  if (key.type === 'StringLiteral') return key.value
  if (key.type === 'NumericLiteral') return String(key.value)
  return null
}

function unique(values: string[]): string[] {
  // 例如 `string | 'x'` 这种场景会推导出重复的 String，需要合并。
  return [...new Set(values)]
}
