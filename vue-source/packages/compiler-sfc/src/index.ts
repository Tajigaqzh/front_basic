export const version: string = __VERSION__

export { createCache } from './cache'
export { parse } from './parse'
export { compileTemplate } from './compileTemplate'
export { compileStyle, compileStyleAsync } from './compileStyle'
export { compileScript } from './compileScript'
export { rewriteDefault, rewriteDefaultAST } from './rewriteDefault'
export { resolveTypeElements, inferRuntimeType } from './script/resolveType'

import { type SFCParseResult, parseCache as _parseCache } from './parse'
export const parseCache = _parseCache as Map<string, SFCParseResult>

import {
  DOMErrorMessages,
  errorMessages as coreErrorMessages,
} from '@vue-source/compiler-dom'

export const errorMessages: Record<number, string> = {
  ...coreErrorMessages,
  ...DOMErrorMessages,
}

export { parse as babelParse } from '@babel/parser'
import { walk as _walk } from 'estree-walker'
export { default as MagicString } from './magicString'
export const walk = _walk as any
export {
  generateCodeFrame,
  walkIdentifiers,
  extractIdentifiers,
  isInDestructureAssignment,
  isStaticProperty,
} from '@vue-source/compiler-core'

export { extractRuntimeProps } from './script/defineProps'
export { extractRuntimeEmits } from './script/defineEmits'

export type {
  SFCParseOptions,
  SFCParseResult,
  SFCDescriptor,
  SFCBlock,
  SFCTemplateBlock,
  SFCScriptBlock,
  SFCStyleBlock,
} from './parse'
export type {
  TemplateCompiler,
  SFCTemplateCompileOptions,
  SFCTemplateCompileResult,
} from './compileTemplate'
export type {
  SFCStyleCompileOptions,
  SFCStyleCompileResults,
} from './compileStyle'
export type {
  SFCScriptCompileOptions,
  ScriptCompileResult,
  ModelDecl,
  ScriptBinding,
} from './compileScript'
export type { ScriptCompileContext } from './script/context'
export type { ResolvedTypeElements } from './script/resolveType'
export type {
  AssetURLOptions,
  AssetURLTagConfig,
} from './template/transformAssetUrl'
export type {
  CompilerOptions,
  CompilerError,
  BindingMetadata,
} from '@vue-source/compiler-core'

export const shouldTransformRef = () => false
