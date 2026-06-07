import { defineConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const banner = `
/*!
 * ${pkg.name} v${pkg.version}
 * local pinia source recreation
 */
`.trim()

const __DEV__ = `(process.env.NODE_ENV !== 'production')`
const __TEST__ = `(process.env.NODE_ENV === 'test')`

const commonOptions = defineConfig({
  banner,
  format: ['esm'],
  skipNodeModulesBundle: true,
  entry: {
    pinia: './src/index.ts',
  },
  define: {
    __DEV__,
    __TEST__,
    __USE_DEVTOOLS__: `((${__DEV__} || __VUE_PROD_DEVTOOLS__) && !${__TEST__})`,
  },
  dts: false,
})

const esm = defineConfig({
  ...commonOptions,
  platform: 'neutral',
  exports: true,
  dts: true,
  outputOptions: {
    entryFileNames: ({ name }) => `${name}.mjs`.replace('.d.mjs', '.d.ts'),
  },
})

export default [esm]
