import type { ArrayExpression, CallExpression, Expression, Node, ObjectExpression } from '@babel/types'

export function isCallOf(node: Node | null | undefined, name: string): node is CallExpression {
  return !!node && node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === name
}

export function isRuntimeLiteralExpression(
  node: Node | null | undefined,
): node is ObjectExpression | ArrayExpression {
  return !!node && (node.type === 'ObjectExpression' || node.type === 'ArrayExpression')
}

export function isExpressionNode(node: Node | null | undefined): node is Expression {
  return !!node && node.type !== 'SpreadElement' && node.type !== 'ArgumentPlaceholder'
}

export function sliceNode(source: string, node: Node | null | undefined): string | null {
  if (!node || node.start == null || node.end == null) {
    return null
  }
  return source.slice(node.start, node.end)
}
