import { defaultExcludeRE, defaultIncludeRE, getPreambleCode, preambleCode, runtimePublicPath } from './constants.js'
import { bundleReactDeps, createReactDepUrlAliases, type ReactDepAliases } from './deps.js'
import { refreshRuntimeCode } from './refresh-runtime.js'
import { cleanUrl, matches, transformReact } from './transform.js'
import type { Options, Plugin } from './types.js'
export { reactCompilerPreset } from './reactCompilerPreset.js'

export default function reactPlugin(rawOptions: Options = {}): Plugin[] {
  const include = rawOptions.include ?? defaultIncludeRE
  const exclude = rawOptions.exclude ?? defaultExcludeRE
  const jsxRuntime = rawOptions.jsxRuntime ?? 'automatic'
  const jsxImportSource = rawOptions.jsxImportSource ?? 'react'
  const reactRefreshHost = rawOptions.reactRefreshHost ?? ''

  let base = '/'
  let skipFastRefresh = true
  let depAliases: ReactDepAliases = new Map()

  const reactTransform: Plugin = {
    name: 'vite:react',
    enforce: 'pre',

    config(_config, env) {
      const depAliasEntries = Object.fromEntries(createReactDepUrlAliases())

      return {
        esbuild: {
          jsx: jsxRuntime === 'classic' ? 'transform' : 'automatic',
          jsxImportSource,
        },
        optimizeDeps: {
          exclude: [
            'react',
            'react-dom',
            'react-dom/client',
            `${jsxImportSource}/jsx-runtime`,
            `${jsxImportSource}/jsx-dev-runtime`,
          ],
        },
        define: {
          'process.env.NODE_ENV': JSON.stringify(env.command === 'build' ? 'production' : 'development'),
        },
        resolve: {
          alias: depAliasEntries,
        },
      }
    },

    async configResolved(config) {
      base = config.base
      skipFastRefresh = Boolean(
        rawOptions.fastRefresh === false ||
          config.isProduction ||
          config.command === 'build' ||
          config.server.hmr === false,
      )
      depAliases = await bundleReactDeps(config)
    },

    resolveId(id) {
      return depAliases.get(id) ?? null
    },

    async transform(code, id) {
      const clean = cleanUrl(id)
      if (!matches(include, clean)) return null
      if (matches(exclude, clean)) return null
      if (!/\.[cm]?[jt]sx?$/.test(clean)) return null

      return transformReact(code, clean, { jsxRuntime, jsxImportSource, reactRefreshHost }, skipFastRefresh)
    },
  }

  const reactRefresh: Plugin = {
    name: 'vite:react-refresh',
    enforce: 'pre',

    resolveId(id) {
      if (id === runtimePublicPath) return id
      if (id === '@vitejs/plugin-react/preamble') return '\0@vitejs/plugin-react/preamble'
      return null
    },

    load(id) {
      if (id === runtimePublicPath) return refreshRuntimeCode
      if (id === '\0@vitejs/plugin-react/preamble') {
        return skipFastRefresh ? '' : getPreambleCode('/')
      }
      return null
    },

    transformIndexHtml() {
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
