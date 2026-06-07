// 只需要指令转换类型。
import type { DirectiveTransform } from '@vue-source/compiler-core'
// DOM 错误定义。
import { DOMErrorCodes, createDOMCompilerError } from '../errors'
// v-show 对应的运行时 helper symbol。
import { V_SHOW } from '../runtimeHelpers'

// v-show 本身不生成 props，而是声明“此节点需要运行时指令”。
export const transformShow: DirectiveTransform = (dir, node, context) => {
  // 取出表达式和源码位置。
  const { exp, loc } = dir
  // v-show 没有表达式是非法的。
  if (!exp) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_SHOW_NO_EXPRESSION, loc),
    )
  }

  return {
    // 不直接转成某个静态 prop。
    props: [],
    // v-show 的显示/隐藏逻辑完全依赖运行时指令，
    // 编译期这里只负责声明“这个节点需要 vShow helper”。
    // 告诉 codegen 这里需要注入 vShow 运行时指令。
    needRuntime: context.helper(V_SHOW),
  }
}
