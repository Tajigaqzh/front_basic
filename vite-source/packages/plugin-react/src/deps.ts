import fs from 'node:fs/promises'
import path from 'node:path'
import { build as esbuildBuild } from 'esbuild'
import type { ResolvedConfig } from './types.js'

export type ReactDepAliases = Map<string, string>

const reactDeps = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]

export async function bundleReactDeps(config: ResolvedConfig): Promise<ReactDepAliases> {
  const aliases = createReactDepAliases(config.root)
  const cacheDir = getReactDepsCacheDir(config.root)
  await fs.mkdir(cacheDir, { recursive: true })

  await esbuildBuild({
    absWorkingDir: config.root,
    stdin: {
      contents: createVendorEntry(config.root),
      resolveDir: config.root,
      sourcefile: 'react-vendor.bridge.js',
      loader: 'js',
    },
    outfile: getReactVendorFile(config.root),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    write: true,
    splitting: false,
    mainFields: config.resolve.mainFields,
    conditions: [
      ...(config.resolve.conditions ?? []),
      config.isProduction ? 'production' : 'development',
      'browser',
      'import',
      'default',
    ],
    logLevel: 'silent',
    define: normalizeEsbuildDefine(config.define),
  })

  for (const dep of reactDeps) {
    await fs.writeFile(getReactDepFile(config.root, dep), createAliasEntry(dep, config.root))
  }

  return aliases
}

function createVendorEntry(root: string): string {
  const reactEntry = slash(path.join(root, 'node_modules', 'react', 'index.js'))
  const reactDomEntry = slash(path.join(root, 'node_modules', 'react-dom', 'index.js'))
  const reactDomClientEntry = slash(path.join(root, 'node_modules', 'react-dom', 'client.js'))
  const jsxRuntimeEntry = slash(path.join(root, 'node_modules', 'react', 'jsx-runtime.js'))
  const jsxDevRuntimeEntry = slash(path.join(root, 'node_modules', 'react', 'jsx-dev-runtime.js'))

  return `
    import React from '${reactEntry}';
    import * as ReactDOM from '${reactDomEntry}';
    import * as ReactDOMClient from '${reactDomClientEntry}';
    import * as JSXRuntime from '${jsxRuntimeEntry}';
    import * as JSXDevRuntime from '${jsxDevRuntimeEntry}';

    export { React, ReactDOM, ReactDOMClient, JSXRuntime, JSXDevRuntime };
  `
}

function createAliasEntry(dep: string, root: string): string {
  const vendor = `./${path.basename(getReactVendorFile(root))}`

  if (dep === 'react') {
    return `
      import { React } from '${vendor}';
      export default React;
      export const {
        Activity,
        Children,
        Component,
        Fragment,
        Profiler,
        PureComponent,
        StrictMode,
        Suspense,
        cache,
        cacheSignal,
        cloneElement,
        createContext,
        createElement,
        createRef,
        forwardRef,
        isValidElement,
        lazy,
        memo,
        startTransition,
        unstable_useCacheRefresh,
        use,
        useActionState,
        useCallback,
        useContext,
        useDebugValue,
        useDeferredValue,
        useEffect,
        useEffectEvent,
        useId,
        useImperativeHandle,
        useInsertionEffect,
        useLayoutEffect,
        useMemo,
        useOptimistic,
        useReducer,
        useRef,
        useState,
        useSyncExternalStore,
        useTransition,
        version,
      } = React;
    `
  }

  if (dep === 'react-dom/client') {
    return `
      import { ReactDOMClient } from '${vendor}';
      export default ReactDOMClient;
      export const { createRoot, hydrateRoot, version } = ReactDOMClient;
    `
  }

  if (dep === 'react-dom') {
    return `
      import { ReactDOM } from '${vendor}';
      export default ReactDOM;
      export const {
        createPortal,
        flushSync,
        preconnect,
        prefetchDNS,
        preinit,
        preinitModule,
        preload,
        preloadModule,
        requestFormReset,
        unstable_batchedUpdates,
        useFormState,
        useFormStatus,
        version,
      } = ReactDOM;
    `
  }

  if (dep === 'react/jsx-runtime' || dep === 'react/jsx-dev-runtime') {
    const runtimeName = dep === 'react/jsx-runtime' ? 'JSXRuntime' : 'JSXDevRuntime'
    return `
      import { ${runtimeName} } from '${vendor}';
      export default ${runtimeName};
      export const { Fragment, jsx, jsxs, jsxDEV } = ${runtimeName};
    `
  }

  return `export * from '${dep}'; export { default } from '${dep}';`
}

export function createReactDepAliases(root: string): ReactDepAliases {
  return new Map(reactDeps.map((dep) => [dep, getReactDepFile(root, dep)]))
}

export function createReactDepUrlAliases(): ReactDepAliases {
  return new Map(reactDeps.map((dep) => [dep, `/node_modules/.vite-source/plugin-react/${flattenId(dep)}.js`]))
}

function getReactDepsCacheDir(root: string): string {
  return path.join(root, 'node_modules', '.vite-source', 'plugin-react')
}

function getReactDepFile(root: string, dep: string): string {
  return path.join(getReactDepsCacheDir(root), `${flattenId(dep)}.js`)
}

function getReactVendorFile(root: string): string {
  return path.join(getReactDepsCacheDir(root), 'react-vendor.js')
}

function flattenId(id: string): string {
  return id.replace(/[^\w.-]/g, '_')
}

function normalizeEsbuildDefine(define: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(define)) {
    normalized[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return normalized
}

function slash(value: string): string {
  return value.replace(/\\/g, '/')
}
