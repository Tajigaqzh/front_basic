import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type ParentNode,
  type RootNode,
  type TemplateChildNode,
  createSimpleExpression,
  findDir,
  isCommentOrWhitespace,
  locStub,
} from '@vue-source/compiler-dom'

const filterChild = (node: ParentNode) =>
  node.children.filter(n => !isCommentOrWhitespace(n))

const hasSingleChild = (node: ParentNode): boolean =>
  filterChild(node).length === 1

export const ssrInjectFallthroughAttrs: NodeTransform = (node, context) => {
  // _attrs is provided as a function argument.
  // mark it as a known identifier so that it doesn't get prefixed by
  // transformExpression.
  if (node.type === NodeTypes.ROOT) {
    // 和 `_cssVars` 类似，`_attrs` 也是 SSR render 函数参数，
    // 这里先登记成“已知变量”。
    context.identifiers._attrs = 1
  }

  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT &&
    (node.tag === 'transition' ||
      node.tag === 'Transition' ||
      node.tag === 'KeepAlive' ||
      node.tag === 'keep-alive')
  ) {
    const rootChildren = filterChild(context.root)
    if (rootChildren.length === 1 && rootChildren[0] === node) {
      if (hasSingleChild(node)) {
        // Transition / KeepAlive 自己并不真正消费 fallthrough attrs，
        // 需要把 `_attrs` 继续注到它唯一的实际子节点上。
        injectFallthroughAttrs(node.children[0])
      }
      return
    }
  }

  const parent = context.parent
  if (!parent || parent.type !== NodeTypes.ROOT) {
    return
  }

  if (node.type === NodeTypes.IF_BRANCH && hasSingleChild(node)) {
    // 根节点是 v-if / v-else-if / v-else 链时，也要把 fallthrough attrs
    // 注到真正会落成根元素的那个分支子节点里。
    // detect cases where the parent v-if is not the only root level node
    let hasEncounteredIf = false
    for (const c of filterChild(parent)) {
      if (
        c.type === NodeTypes.IF ||
        (c.type === NodeTypes.ELEMENT && findDir(c, 'if'))
      ) {
        // multiple root v-if
        if (hasEncounteredIf) return
        hasEncounteredIf = true
      } else if (
        // node before v-if
        !hasEncounteredIf ||
        // non else nodes
        !(c.type === NodeTypes.ELEMENT && findDir(c, /else/, true))
      ) {
        return
      }
    }
    injectFallthroughAttrs(node.children[0])
  } else if (hasSingleChild(parent)) {
    // 普通单根场景下，直接把 `_attrs` 注到这个唯一根节点上。
    injectFallthroughAttrs(node)
  }
}

function injectFallthroughAttrs(node: RootNode | TemplateChildNode) {
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT) &&
    !findDir(node, 'for')
  ) {
    // 这里通过补一个无参数 `v-bind="_attrs"`，复用现有 props 合并链路，
    // 不需要专门在每个 transform 里硬编码 fallthrough 逻辑。
    node.props.push({
      type: NodeTypes.DIRECTIVE,
      name: 'bind',
      arg: undefined,
      exp: createSimpleExpression(`_attrs`, false),
      modifiers: [],
      loc: locStub,
    })
  }
}
