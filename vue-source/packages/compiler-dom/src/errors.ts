import {
  // 通用编译错误类型。
  type CompilerError,
  // core 侧错误码扩展起点。
  ErrorCodes,
  // 源码位置信息。
  type SourceLocation,
  // 创建通用编译错误。
  createCompilerError,
} from '@vue-source/compiler-core'

// DOM 编译器错误：本质上继承 core 错误，只是 code 缩小为 DOMErrorCodes。
export interface DOMCompilerError extends CompilerError {
  code: DOMErrorCodes
}

// 创建 DOM 平台专属编译错误。
export function createDOMCompilerError(
  // DOM 错误码。
  code: DOMErrorCodes,
  // 可选源码位置。
  loc?: SourceLocation,
) {
  return createCompilerError(
    code,
    loc,
    // 开发环境或非浏览器环境下注入可读错误消息；生产浏览器环境可省略以减小体积。
    __DEV__ || !__BROWSER__ ? DOMErrorMessages : undefined,
  ) as DOMCompilerError
}

// DOM 平台扩展出来的错误码枚举。
export enum DOMErrorCodes {
  // 从 compiler-core 预留的扩展点开始编号，避免和 core 错误码冲突。
  X_V_HTML_NO_EXPRESSION = 54 /* ErrorCodes.__EXTEND_POINT__ */,
  X_V_HTML_WITH_CHILDREN,
  X_V_TEXT_NO_EXPRESSION,
  X_V_TEXT_WITH_CHILDREN,
  X_V_MODEL_ON_INVALID_ELEMENT,
  X_V_MODEL_ARG_ON_ELEMENT,
  X_V_MODEL_ON_FILE_INPUT_ELEMENT,
  X_V_MODEL_UNNECESSARY_VALUE,
  X_V_SHOW_NO_EXPRESSION,
  X_TRANSITION_INVALID_CHILDREN,
  X_IGNORED_SIDE_EFFECT_TAG,
  __EXTEND_POINT__,
}

if (__TEST__) {
  // 测试环境下做一次自检，确保 DOM 错误码没有和 core 错误码范围撞车。
  // esbuild cannot infer enum increments if first value is from another
  // file, so we have to manually keep them in sync. this check ensures it
  // errors out if there are collisions.
  if (DOMErrorCodes.X_V_HTML_NO_EXPRESSION < ErrorCodes.__EXTEND_POINT__) {
    throw new Error(
      `DOMErrorCodes need to be updated to ${
        ErrorCodes.__EXTEND_POINT__
      } to match extension point from core ErrorCodes.`,
    )
  }
}

// 错误码到默认错误消息的映射表。
export const DOMErrorMessages: { [code: number]: string } = {
  [DOMErrorCodes.X_V_HTML_NO_EXPRESSION]: `v-html is missing expression.`,
  [DOMErrorCodes.X_V_HTML_WITH_CHILDREN]: `v-html will override element children.`,
  [DOMErrorCodes.X_V_TEXT_NO_EXPRESSION]: `v-text is missing expression.`,
  [DOMErrorCodes.X_V_TEXT_WITH_CHILDREN]: `v-text will override element children.`,
  [DOMErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT]: `v-model can only be used on <input>, <textarea> and <select> elements.`,
  [DOMErrorCodes.X_V_MODEL_ARG_ON_ELEMENT]: `v-model argument is not supported on plain elements.`,
  [DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT]: `v-model cannot be used on file inputs since they are read-only. Use a v-on:change listener instead.`,
  [DOMErrorCodes.X_V_MODEL_UNNECESSARY_VALUE]: `Unnecessary value binding used alongside v-model. It will interfere with v-model's behavior.`,
  [DOMErrorCodes.X_V_SHOW_NO_EXPRESSION]: `v-show is missing expression.`,
  [DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN]: `<Transition> expects exactly one child element or component.`,
  [DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG]: `Tags with side effect (<script> and <style>) are ignored in client component templates.`,
}
