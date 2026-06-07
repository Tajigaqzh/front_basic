import type { RawSourceMap } from '@vue-source/compiler-core'

export type PreprocessLang = 'less' | 'sass' | 'scss' | 'styl' | 'stylus'

export interface StylePreprocessorResults {
  code: string
  map?: RawSourceMap
  errors: Error[]
  dependencies: string[]
}

export type StylePreprocessor = (
  source: string,
  map: RawSourceMap | undefined,
  options: {
    filename: string
    [key: string]: any
  },
  preprocessCustomRequire?: ((id: string) => unknown) | undefined,
) => StylePreprocessorResults

function passthroughPreprocessor(
  source: string,
  map: RawSourceMap | undefined,
  _options: {
    filename: string
    [key: string]: any
  },
  _preprocessCustomRequire?: ((id: string) => unknown) | undefined,
): StylePreprocessorResults {
  return {
    code: source,
    map,
    errors: [],
    dependencies: [],
  }
}

export const processors: Record<PreprocessLang, StylePreprocessor> = {
  less: passthroughPreprocessor,
  sass: passthroughPreprocessor,
  scss: passthroughPreprocessor,
  styl: passthroughPreprocessor,
  stylus: passthroughPreprocessor,
}
