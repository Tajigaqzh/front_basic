import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type RootNode,
  type TemplateChildNode,
  createSimpleExpression,
  findDir,
  locStub,
} from '@vue-source/compiler-dom'

export const ssrInjectCssVars: NodeTransform = (node, context) => {
  if (!context.ssrCssVars) {
    return
  }

  // _cssVars is initialized once per render function
  // the code is injected in ssrCodegenTransform when creating the
  // ssr transform context
  if (node.type === NodeTypes.ROOT) {
    // 先把 `_cssVars` 标成已知标识符，避免 transformExpression 再给它加 `_ctx.` 前缀。
    context.identifiers._cssVars = 1
  }

  const parent = context.parent
  if (!parent || parent.type !== NodeTypes.ROOT) {
    return
  }

  if (node.type === NodeTypes.IF_BRANCH) {
    for (const child of node.children) {
      injectCssVars(child)
    }
  } else {
    injectCssVars(node)
  }
}

function injectCssVars(node: RootNode | TemplateChildNode) {
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT) &&
    !findDir(node, 'for')
  ) {
    if (node.tag === 'suspense' || node.tag === 'Suspense') {
      // Suspense 自己不是最终实际 DOM 外壳，要继续把 css vars 往它的 slot 内容里注。
      for (const child of node.children) {
        if (
          child.type === NodeTypes.ELEMENT &&
          child.tagType === ElementTypes.TEMPLATE
        ) {
          // suspense slot
          child.children.forEach(injectCssVars)
        } else {
          injectCssVars(child)
        }
      }
    } else {
      // 实现方式很直接：在根级可落地元素/组件上额外挂一个 `v-bind="_cssVars"`，
      // 让后面的 props 构建流程自然把样式变量并进去。
      node.props.push({
        type: NodeTypes.DIRECTIVE,
        name: 'bind',
        arg: undefined,
        exp: createSimpleExpression(`_cssVars`, false),
        modifiers: [],
        loc: locStub,
      })
    }
  }
}
