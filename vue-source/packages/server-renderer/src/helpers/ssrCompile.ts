import {
  type ComponentInternalInstance,
  type ComponentOptions,
  warn,
} from '@vue-source/runtime-dom'
import { compile } from '@vue-source/compiler-ssr'
import { NO, extend, generateCodeFrame, isFunction } from '@vue-source/shared'
import type { CompilerError, CompilerOptions } from '@vue-source/compiler-core'
import type { PushFn } from '../render'

import * as Vue from '@vue-source/runtime-dom'
import * as helpers from '../internal'

type SSRRenderFunction = (
  context: any,
  push: PushFn,
  parentInstance: ComponentInternalInstance,
) => void

const compileCache: Record<string, SSRRenderFunction> = Object.create(null)

export function ssrCompile(
  template: string,
  instance: ComponentInternalInstance,
): SSRRenderFunction {
  // TODO: this branch should now work in ESM builds, enable it in a minor
  if (!__CJS__) {
    throw new Error(
      `On-the-fly template compilation is not supported in the ESM build of ` +
        `@vue-source/server-renderer. All templates must be pre-compiled into ` +
        `render functions.`,
    )
  }

  // TODO: This is copied from runtime-core/src/component.ts and should probably be refactored
  const Component = instance.type as ComponentOptions
  const { isCustomElement, compilerOptions } = instance.appContext.config
  const { delimiters, compilerOptions: componentCompilerOptions } = Component

  const finalCompilerOptions: CompilerOptions = extend(
    extend(
      {
        isCustomElement,
        delimiters,
      },
      compilerOptions,
    ),
    componentCompilerOptions,
  )

  finalCompilerOptions.isCustomElement =
    finalCompilerOptions.isCustomElement || NO
  finalCompilerOptions.isNativeTag = finalCompilerOptions.isNativeTag || NO

  const cacheKey = JSON.stringify(
    {
      template,
      compilerOptions: finalCompilerOptions,
    },
    (key, value) => {
      return isFunction(value) ? value.toString() : value
    },
  )

  const cached = compileCache[cacheKey]
  if (cached) {
    return cached
  }

  finalCompilerOptions.onError = (err: CompilerError) => {
    if (__DEV__) {
      const message = `[@vue-source/server-renderer] Template compilation error: ${err.message}`
      const codeFrame =
        err.loc &&
        generateCodeFrame(
          template as string,
          err.loc.start.offset,
          err.loc.end.offset,
        )
      warn(codeFrame ? `${message}\n${codeFrame}` : message)
    } else {
      throw err
    }
  }

  const { code } = compile(template, finalCompilerOptions)
  const requireMap = {
    '@vue-source/runtime-dom': Vue,
    '@vue-source/server-renderer': helpers,
  }
  const fakeRequire = (
    id: '@vue-source/runtime-dom' | '@vue-source/server-renderer',
  ) => requireMap[id]
  return (compileCache[cacheKey] = Function('require', code)(fakeRequire))
}
