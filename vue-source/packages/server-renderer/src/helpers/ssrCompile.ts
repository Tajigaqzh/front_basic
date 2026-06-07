import {
  type ComponentInternalInstance,
  type ComponentOptions,
  warn,
} from '@vue-source/runtime-dom'
import { compile } from '@vue-source/compiler-ssr'
import { NO, extend, generateCodeFrame, isFunction } from '@vue-source/shared'
import type { CompilerError, CompilerOptions } from '@vue-source/compiler-core'
import type { PushFn } from '../buffer'

import * as Vue from '@vue-source/runtime-dom'
import type * as InternalHelpers from '../internal'

type SSRRenderFunction = (
  context: any,
  push: PushFn,
  parentInstance: ComponentInternalInstance,
) => void

type InternalHelpersModule = typeof InternalHelpers

// 运行时模板编译结果和编译选项强相关，必须按模板内容 + 编译配置联合缓存。
const compileCache: Record<string, SSRRenderFunction> = Object.create(null)

export function ssrCompile(
  template: string,
  instance: ComponentInternalInstance,
): SSRRenderFunction {
  // 运行时编译依赖 `new Function` 和 require 映射，因此这里只支持 CJS 构建。
  if (!__CJS__) {
    throw new Error(
      `On-the-fly template compilation is not supported in the ESM build of ` +
        `@vue-source/server-renderer. All templates must be pre-compiled into ` +
        `render functions.`,
    )
  }

  const loadInternalHelpers = () =>
    ((0, eval)('require')('../internal') as InternalHelpersModule)

  // 这里把 app 级和组件级编译配置合并成最终 SSR 编译参数，
  // 保证运行时编译行为尽量贴近常规 template 编译。
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

  // 开发环境尽量输出带 code frame 的错误，方便直接定位模板位置；
  // 生产环境则保留原始异常，交给上层统一处理。
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
    '@vue-source/server-renderer': loadInternalHelpers(),
  }
  const fakeRequire = (
    id: '@vue-source/runtime-dom' | '@vue-source/server-renderer',
  ) => requireMap[id]

  // 编译器产出的是一段 CommonJS 风格代码，这里通过受控 require 环境执行。
  return (compileCache[cacheKey] = Function('require', code)(fakeRequire))
}
