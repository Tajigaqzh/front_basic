import { defaultExcludeRE, defaultIncludeRE, getPreambleCode, preambleCode, runtimePublicPath } from './constants.js'
import { bundleReactDeps, createReactDepUrlAliases, type ReactDepAliases } from './deps.js'
import { refreshRuntimeCode } from './refresh-runtime.js'
import { cleanUrl, matches, transformReact } from './transform.js'
import type { Options, Plugin } from './types.js'
export { reactCompilerPreset } from './reactCompilerPreset.js'

export default function reactPlugin(rawOptions: Options = {}): Plugin[] {
  // include/exclude 决定哪些源文件交给 React 插件处理，默认覆盖 js/jsx/ts/tsx。
  const include = rawOptions.include ?? defaultIncludeRE
  const exclude = rawOptions.exclude ?? defaultExcludeRE
  // automatic 对应 React 17+ 新 JSX transform；classic 对应 React.createElement。
  const jsxRuntime = rawOptions.jsxRuntime ?? 'automatic'
  // jsxImportSource 支持 preact、emotion 等自定义 JSX runtime。
  const jsxImportSource = rawOptions.jsxImportSource ?? 'react'
  // micro-frontend 场景可能从远端加载 refresh runtime，这里保留 host 前缀。
  const reactRefreshHost = rawOptions.reactRefreshHost ?? ''

  // base 来自最终 Vite 配置，用于生成 HTML preamble 里的内部 runtime 路径。
  let base = '/'
  // 生产构建、关闭 HMR 或用户禁用时跳过 Fast Refresh 包装。
  let skipFastRefresh = true
  // React 相关依赖被预打包/虚拟化后，通过 resolveId 返回对应缓存路径。
  let depAliases: ReactDepAliases = new Map()

  const reactTransform: Plugin = {
    name: 'vite:react',
    // React JSX/Fast Refresh 需要尽早处理源码，再交给后续 import-analysis 改写 import。
    enforce: 'pre',

    config(_config, env) {
      // config 钩子发生在用户配置加载后、resolveConfig 合并前，可追加默认配置。
      const depAliasEntries = Object.fromEntries(createReactDepUrlAliases())

      return {
        esbuild: {
          // 告诉 Vite/esbuild 用哪种 JSX 编译模式。
          jsx: jsxRuntime === 'classic' ? 'transform' : 'automatic',
          jsxImportSource,
        },
        optimizeDeps: {
          /**
           * 阅读版 React 插件自己处理 React 依赖别名，所以这里把它们排除出
           * 默认 optimizeDeps 扫描，避免同一依赖被两套流程处理。
           */
          exclude: [
            'react',
            'react-dom',
            'react-dom/client',
            `${jsxImportSource}/jsx-runtime`,
            `${jsxImportSource}/jsx-dev-runtime`,
          ],
        },
        define: {
          // React runtime 会读取 process.env.NODE_ENV，浏览器里需要提前替换成字面量。
          'process.env.NODE_ENV': JSON.stringify(env.command === 'build' ? 'production' : 'development'),
        },
        resolve: {
          // alias 让 import 'react' 这类请求进入插件控制的依赖副本。
          alias: depAliasEntries,
        },
      }
    },

    async configResolved(config) {
      // configResolved 拿到的是最终配置，适合计算只读派生状态。
      base = config.base
      skipFastRefresh = Boolean(
        rawOptions.fastRefresh === false ||
          config.isProduction ||
          config.command === 'build' ||
          config.server.hmr === false,
      )
      // bundleReactDeps 会准备 React runtime 相关依赖，并返回 resolver 可用的映射表。
      depAliases = await bundleReactDeps(config)
    },

    resolveId(id) {
      // resolveId 是短路钩子：命中 React 依赖别名就直接返回目标 id。
      return depAliases.get(id) ?? null
    },

    async transform(code, id) {
      // transform 是串行钩子；这里先过滤，避免无关文件进入 esbuild。
      const clean = cleanUrl(id)
      if (!matches(include, clean)) return null
      if (matches(exclude, clean)) return null
      if (!/\.[cm]?[jt]sx?$/.test(clean)) return null

      // 通过 esbuild 编译 JSX/TS，并在 dev HMR 场景追加 Fast Refresh 包装。
      return transformReact(code, clean, { jsxRuntime, jsxImportSource, reactRefreshHost }, skipFastRefresh)
    },
  }

  const reactRefresh: Plugin = {
    name: 'vite:react-refresh',
    // preamble/runtime 必须在普通模块分析前可解析。
    enforce: 'pre',

    resolveId(id) {
      // /@react-refresh 是浏览器可请求的虚拟模块，load 阶段返回 runtime 代码。
      if (id === runtimePublicPath) return id
      // preamble 是用户可显式 import 的虚拟模块，用 \0 标记避免普通 resolver 接管。
      if (id === '@vitejs/plugin-react/preamble') return '\0@vitejs/plugin-react/preamble'
      return null
    },

    load(id) {
      // 返回 React Refresh 浏览器运行时代码。
      if (id === runtimePublicPath) return refreshRuntimeCode
      if (id === '\0@vitejs/plugin-react/preamble') {
        // 不需要 Fast Refresh 时，preamble 保持空模块即可。
        return skipFastRefresh ? '' : getPreambleCode('/')
      }
      return null
    },

    transformIndexHtml() {
      // HTML 钩子负责把 Refresh preamble 注入页面，早于业务模块执行。
      if (skipFastRefresh) return null
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: getPreambleCode(base),
          injectTo: 'head',
        },
      ]
    },
  }

  return [reactRefresh, reactTransform]
}

export { preambleCode }
