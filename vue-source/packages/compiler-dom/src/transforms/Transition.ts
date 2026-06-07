import {
  // 组件节点类型。
  type ComponentNode,
  // 标签类型枚举，用于区分普通元素和组件。
  ElementTypes,
  // v-if 分支节点类型。
  type IfBranchNode,
  // 节点转换器类型。
  type NodeTransform,
  // AST 节点类型枚举。
  NodeTypes,
  // 判断是否是注释或纯空白节点。
  isCommentOrWhitespace,
} from '@vue-source/compiler-core'
// Transition 内置组件标识。
import { TRANSITION } from '../runtimeHelpers'
// DOM 编译错误定义。
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

// 处理内置 Transition 组件的编译期约束。
export const transformTransition: NodeTransform = (node, context) => {
  // 只关心组件节点。
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT
  ) {
    // 判断当前组件是不是内置 Transition。
    const component = context.isBuiltInComponent(node.tag)
    if (component === TRANSITION) {
      // 之所以放在退出阶段做，是因为要等子节点都完成基础 transform 后，
      // 再判断“最终有效子节点”数量才更准确。
      // 返回退出阶段回调，等子节点都处理完后再校验结构最准确。
      return () => {
        // 空 Transition 不需要额外处理。
        if (!node.children.length) {
          return
        }

        // Transition 理论上只能包一个有效子节点。
        // warn multiple transition children
        if (hasMultipleChildren(node)) {
          context.onError(
            createDOMCompilerError(
              DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN,
              {
                start: node.children[0].loc.start,
                end: node.children[node.children.length - 1].loc.end,
                source: '',
              },
            ),
          )
        }

        // 如果唯一子节点上用了 v-show，需要给 Transition 自动补 persisted。
        // check if it's a single child w/ v-show
        // if yes, inject "persisted: true" to the transition props
        const child = node.children[0]
        if (child.type === NodeTypes.ELEMENT) {
          // 遍历子节点属性，看是否存在 v-show。
          for (const p of child.props) {
            if (p.type === NodeTypes.DIRECTIVE && p.name === 'show') {
              // Transition + v-show 不会真的卸载节点，只是切换显示状态，
              // 所以编译期要自动补上 persisted 语义。
              // persisted 表示元素不会真的卸载，只是切换显示状态。
              node.props.push({
                type: NodeTypes.ATTRIBUTE,
                name: 'persisted',
                nameLoc: node.loc,
                value: undefined,
                loc: node.loc,
              })
            }
          }
        }
      }
    }
  }
}

function hasMultipleChildren(node: ComponentNode | IfBranchNode): boolean {
  // 先过滤注释节点和纯空白文本，这些不应该算“有效子节点”。
  // filter out potential comment nodes (#1352) and whitespace (#4637)
  const children = (node.children = node.children.filter(
    c => !isCommentOrWhitespace(c),
  ))
  // 取第一个有效子节点做后续判断。
  const child = children[0]
  return (
    // 有效子节点数量不是 1，则不合法。
    children.length !== 1 ||
    // 单个 v-for 也等价于多个渲染结果，因此也不合法。
    child.type === NodeTypes.FOR ||
    // v-if 虽然表面只有一个节点，但每个分支都必须继续满足“单子节点”约束。
    // 单个 v-if 需要递归检查它的每个分支是否都只产生一个子节点。
    (child.type === NodeTypes.IF && child.branches.some(hasMultipleChildren))
  )
}
