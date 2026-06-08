import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import vue from '../../packages/plugin-vue/dist/index.js'

const root = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(root, '../../..')
const vueSourceRoot = resolve(workspaceRoot, 'vue-source')
const vuePkg = name => `/@fs/${resolve(vueSourceRoot, `packages/${name}/src/index.ts`)}`

export default {
  plugins: [vue()],
  resolve: {
    alias: [
      { find: 'vue', replacement: vuePkg('runtime-dom') },
      { find: '@vue-source/vue', replacement: vuePkg('vue') },
      { find: '@vue-source/compiler-core', replacement: vuePkg('compiler-core') },
      { find: '@vue-source/compiler-dom', replacement: vuePkg('compiler-dom') },
      { find: '@vue-source/reactivity', replacement: vuePkg('reactivity') },
      { find: '@vue-source/runtime-core', replacement: vuePkg('runtime-core') },
      { find: '@vue-source/runtime-dom', replacement: vuePkg('runtime-dom') },
      { find: '@vue-source/shared', replacement: vuePkg('shared') },
    ],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    __DEV__: JSON.stringify(true),
    __TEST__: JSON.stringify(false),
    __BROWSER__: JSON.stringify(true),
    __GLOBAL__: JSON.stringify(false),
    __ESM_BUNDLER__: JSON.stringify(true),
    __ESM_BROWSER__: JSON.stringify(false),
    __CJS__: JSON.stringify(false),
    __SSR__: JSON.stringify(false),
    __VERSION__: JSON.stringify('local-vite-local-vue'),
    __COMPAT__: JSON.stringify(false),
    __FEATURE_OPTIONS_API__: JSON.stringify(true),
    __FEATURE_PROD_DEVTOOLS__: JSON.stringify(false),
    __FEATURE_SUSPENSE__: JSON.stringify(true),
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
  },
  optimizeDeps: {
    exclude: [
      'vue',
      '@vue-source/vue',
      '@vue-source/compiler-core',
      '@vue-source/compiler-dom',
      '@vue-source/reactivity',
      '@vue-source/runtime-core',
      '@vue-source/runtime-dom',
      '@vue-source/shared',
    ],
  },
  build: {
    manifest: true,
  },
}
