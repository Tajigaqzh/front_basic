// compiler-core 对外主入口：导出 parse / transform / codegen 三段能力。
export { baseCompile } from './compile'

// Also expose lower level APIs & types
export {
  // 编译、解析、转换、生成阶段的核心配置类型。
  type CompilerOptions,
  type ParserOptions,
  type TransformOptions,
  type CodegenOptions,
  type HoistTransform,
  type BindingMetadata,
  BindingTypes,
} from './options'
// 基础模板解析入口。
export { baseParse } from './parser'
export {
  // transform 主流程和上下文相关导出。
  transform,
  type TransformContext,
  createTransformContext,
  traverseNode,
  createStructuralDirectiveTransform,
  type NodeTransform,
  type StructuralDirectiveTransform,
  type DirectiveTransform,
  type DirectiveTransformResult,
} from './transform'
export {
  // codegen 主流程和结果类型。
  generate,
  type CodegenContext,
  type CodegenResult,
  type CodegenSourceMapGenerator,
  type RawSourceMap,
} from './codegen'
export {
  // 通用编译错误定义。
  ErrorCodes,
  errorMessages,
  createCompilerError,
  type CoreCompilerError,
  type CompilerError,
} from './errors'

// AST、工具函数、Babel 工具和运行时 helper 定义全部透传。
export * from './ast'
export * from './utils'
export * from './babelUtils'
export * from './runtimeHelpers'

// 导出默认 transform 预设和常用 transform，供上层平台编译器复用或覆盖。
export { getBaseTransformPreset, type TransformPreset } from './compile'
export { transformModel } from './transforms/vModel'
export { transformOn } from './transforms/vOn'
export { transformBind } from './transforms/vBind'
export { noopDirectiveTransform } from './transforms/noopDirectiveTransform'
export { processIf } from './transforms/vIf'
export { processFor, createForLoopParams } from './transforms/vFor'
export {
  transformExpression,
  processExpression,
  stringifyExpression,
} from './transforms/transformExpression'
export {
  buildSlots,
  type SlotFnBuilder,
  trackVForSlotScopes,
  trackSlotScopes,
} from './transforms/vSlot'
export {
  transformElement,
  resolveComponentType,
  buildProps,
  buildDirectiveArgs,
  type PropsExpression,
} from './transforms/transformElement'
export { transformVBindShorthand } from './transforms/transformVBindShorthand'
export { processSlotOutlet } from './transforms/transformSlotOutlet'
export { getConstantType } from './transforms/cacheStatic'
export { generateCodeFrame } from '@vue-source/shared'

// v2 compat only
export {
  // 兼容模式相关能力仅供 Vue 2 兼容构建使用。
  checkCompatEnabled,
  warnDeprecation,
  CompilerDeprecationTypes,
} from './compat/compatConfig'
