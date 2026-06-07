import type { DirectiveTransform } from '../transform'
import {
  type ExpressionNode,
  NodeTypes,
  createObjectProperty,
  createSimpleExpression,
} from '../ast'
import { ErrorCodes, createCompilerError } from '../errors'
import { camelize } from '@vue-source/shared'
import { CAMELIZE } from '../runtimeHelpers'

// v-bind without arg is handled directly in ./transformElement.ts due to its affecting
// codegen for the entire props object. This transform here is only for v-bind
// *with* args.
export const transformBind: DirectiveTransform = (dir, _node, context) => {
  const { modifiers, loc } = dir
  const arg = dir.arg!

  let { exp } = dir

  // handle empty expression
  if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim()) {
    if (!__BROWSER__) {
      // #10280 only error against empty expression in non-browser build
      // because :foo in in-DOM templates will be parsed into :foo="" by the
      // browser
      context.onError(
        createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
      )
      return {
        props: [
          createObjectProperty(arg, createSimpleExpression('', true, loc)),
        ],
      }
    } else {
      exp = undefined
    }
  }

  if (arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
    // 动态参数要兜底成非空字符串，避免运行时出现非法 key。
    arg.children.unshift(`(`)
    arg.children.push(`) || ""`)
  } else if (!arg.isStatic) {
    arg.content = arg.content ? `${arg.content} || ""` : `""`
  }

  // .sync is replaced by v-model:arg
  if (modifiers.some(mod => mod.content === 'camel')) {
    // `.camel` 会把参数名转成驼峰，例如 `foo-bar` -> `fooBar`。
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
      if (arg.isStatic) {
        arg.content = camelize(arg.content)
      } else {
        arg.content = `${context.helperString(CAMELIZE)}(${arg.content})`
      }
    } else {
      arg.children.unshift(`${context.helperString(CAMELIZE)}(`)
      arg.children.push(`)`)
    }
  }

  if (!context.inSSR) {
    if (modifiers.some(mod => mod.content === 'prop')) {
      // `.prop` 用前缀标记，提示运行时按 DOM property 而不是 attribute 处理。
      injectPrefix(arg, '.')
    }
    if (modifiers.some(mod => mod.content === 'attr')) {
      // `.attr` 则强制按 attribute 语义处理。
      injectPrefix(arg, '^')
    }
  }

  return {
    props: [createObjectProperty(arg, exp!)],
  }
}

const injectPrefix = (arg: ExpressionNode, prefix: string) => {
  // 这里不是直接改运行时逻辑，而是把前缀编码进 key，交给后续 patch 流程识别。
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (arg.isStatic) {
      arg.content = prefix + arg.content
    } else {
      arg.content = `\`${prefix}\${${arg.content}}\``
    }
  } else {
    arg.children.unshift(`'${prefix}' + (`)
    arg.children.push(`)`)
  }
}
