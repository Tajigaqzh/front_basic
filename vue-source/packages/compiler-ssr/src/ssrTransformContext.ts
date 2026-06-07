import {
  type BlockStatement,
  type CallExpression,
  type CompilerOptions,
  ElementTypes,
  type IfStatement,
  NodeTypes,
  type RootNode,
  type TemplateLiteral,
  createBlockStatement,
  createCallExpression,
  createTemplateLiteral,
} from '@vue-source/compiler-dom'
import { escapeHtml, isString } from '@vue-source/shared'
import { SSR_INTERPOLATE } from './runtimeHelpers'
import { SSRErrorCodes, createSSRCompilerError } from './errors'
import type {
  Container,
  SSRProcessHandlers,
  SSRTransformContext,
} from './ssrTransformTypes'

export function createSSRTransformContext(
  root: RootNode,
  options: CompilerOptions,
  processors: SSRProcessHandlers,
  helpers: Set<symbol> = new Set(),
  withSlotScopeId = false,
): SSRTransformContext {
  const body: BlockStatement['body'] = []
  let currentString: TemplateLiteral | null = null

  return {
    root,
    options,
    body,
    helpers,
    withSlotScopeId,
    processors,
    onError:
      options.onError ||
      (e => {
        throw e
      }),
    helper<T extends symbol>(name: T): T {
      helpers.add(name)
      return name
    },
    pushStringPart(part) {
      if (!currentString) {
        const currentCall = createCallExpression(`_push`)
        body.push(currentCall)
        currentString = createTemplateLiteral([])
        currentCall.arguments.push(currentString)
      }
      const bufferedElements = currentString.elements
      const lastItem = bufferedElements[bufferedElements.length - 1]
      if (isString(part) && isString(lastItem)) {
        bufferedElements[bufferedElements.length - 1] += part
      } else {
        bufferedElements.push(part)
      }
    },
    pushStatement(statement) {
      currentString = null
      body.push(statement)
    },
  }
}

function createChildContext(
  parent: SSRTransformContext,
  withSlotScopeId = parent.withSlotScopeId,
): SSRTransformContext {
  return createSSRTransformContext(
    parent.root,
    parent.options,
    parent.processors,
    parent.helpers,
    withSlotScopeId,
  )
}

export function processChildren(
  parent: Container,
  context: SSRTransformContext,
  asFragment = false,
  disableNestedFragments = false,
  disableComment = false,
): void {
  if (asFragment) {
    context.pushStringPart(`<!--[-->`)
  }
  const { children } = parent
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    switch (child.type) {
      case NodeTypes.ELEMENT:
        switch (child.tagType) {
          case ElementTypes.ELEMENT:
            context.processors.processElement(child, context)
            break
          case ElementTypes.COMPONENT:
            context.processors.processComponent(child, context, parent)
            break
          case ElementTypes.SLOT:
            context.processors.processSlotOutlet(child, context)
            break
          case ElementTypes.TEMPLATE:
            break
          default:
            context.onError(
              createSSRCompilerError(
                SSRErrorCodes.X_SSR_INVALID_AST_NODE,
                (child as any).loc,
              ),
            )
            const exhaustiveCheck: never = child
            return exhaustiveCheck
        }
        break
      case NodeTypes.TEXT:
        context.pushStringPart(escapeHtml(child.content))
        break
      case NodeTypes.COMMENT:
        if (!disableComment) {
          context.pushStringPart(`<!--${child.content}-->`)
        }
        break
      case NodeTypes.INTERPOLATION:
        context.pushStringPart(
          createCallExpression(context.helper(SSR_INTERPOLATE), [
            child.content,
          ]),
        )
        break
      case NodeTypes.IF:
        context.processors.processIf(
          child,
          context,
          disableNestedFragments,
          disableComment,
        )
        break
      case NodeTypes.FOR:
        context.processors.processFor(child, context, disableNestedFragments)
        break
      case NodeTypes.IF_BRANCH:
        break
      case NodeTypes.TEXT_CALL:
      case NodeTypes.COMPOUND_EXPRESSION:
        break
      default:
        context.onError(
          createSSRCompilerError(
            SSRErrorCodes.X_SSR_INVALID_AST_NODE,
            (child as any).loc,
          ),
        )
        const exhaustiveCheck: never = child
        return exhaustiveCheck
    }
  }
  if (asFragment) {
    context.pushStringPart(`<!--]-->`)
  }
}

export function processChildrenAsStatement(
  parent: Container,
  parentContext: SSRTransformContext,
  asFragment = false,
  withSlotScopeId: boolean = parentContext.withSlotScopeId,
): BlockStatement {
  const childContext = createChildContext(parentContext, withSlotScopeId)
  processChildren(parent, childContext, asFragment)
  return createBlockStatement(childContext.body)
}
