import type {
  CallExpression,
  CompilerError,
  CompilerOptions,
  ComponentNode,
  IfNode,
  IfStatement,
  JSChildNode,
  PlainElementNode,
  RootNode,
  SlotOutletNode,
  TemplateChildNode,
  TemplateLiteral,
  ForNode,
} from '@vue-source/compiler-dom'

export interface Container {
  children: TemplateChildNode[]
}

export interface SSRProcessHandlers {
  processIf: (
    node: IfNode,
    context: SSRTransformContext,
    disableNestedFragments?: boolean,
    disableComment?: boolean,
  ) => void
  processFor: (
    node: ForNode,
    context: SSRTransformContext,
    disableNestedFragments?: boolean,
  ) => void
  processSlotOutlet: (
    node: SlotOutletNode,
    context: SSRTransformContext,
  ) => void
  processComponent: (
    node: ComponentNode,
    context: SSRTransformContext,
    parent: Container,
  ) => void
  processElement: (
    node: PlainElementNode,
    context: SSRTransformContext,
  ) => void
}

export interface SSRTransformContext {
  root: RootNode
  options: CompilerOptions
  body: (JSChildNode | IfStatement)[]
  helpers: Set<symbol>
  withSlotScopeId: boolean
  processors: SSRProcessHandlers
  onError: (error: CompilerError) => void
  helper<T extends symbol>(name: T): T
  pushStringPart(part: TemplateLiteral['elements'][0]): void
  pushStatement(statement: IfStatement | CallExpression): void
}
