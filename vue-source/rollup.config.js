import fs from 'node:fs'
import path from 'node:path'
import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import alias from '@rollup/plugin-alias'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import esbuild from 'rollup-plugin-esbuild'

if (!process.env.TARGET) {
  throw new Error('必须通过 --environment TARGET:<package> 指定要构建的包。')
}

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname))
const packagesDir = path.join(rootDir, 'packages')
const packageDir = path.join(packagesDir, process.env.TARGET)
const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8'))
const packageName = path.basename(packageDir)
const buildOptions = pkg.buildOptions || {}
const allFormats = (process.env.FORMATS || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)
const packageFormats = allFormats.length
  ? allFormats
  : buildOptions.formats || ['esm', 'cjs', 'esm-prod', 'cjs-prod']

const resolvePackagePath = relativePath => path.join(packageDir, relativePath)

const workspacePackages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

const aliasEntries = workspacePackages
  .filter(name => fs.existsSync(path.join(packagesDir, name, 'src', 'index.ts')))
  .map(name => ({
    find: `@vue-source/${name}`,
    replacement: path.join(packagesDir, name, 'src', 'index.ts'),
  }))

const outputMap = {
  esm: {
    file: resolvePackagePath(`dist/${packageName}.esm.js`),
    format: 'es',
  },
  'esm-bundler': {
    file: resolvePackagePath(`dist/${packageName}.esm-bundler.js`),
    format: 'es',
  },
  'esm-browser': {
    file: resolvePackagePath(`dist/${packageName}.esm-browser.js`),
    format: 'es',
  },
  'esm-prod': {
    file: resolvePackagePath(`dist/${packageName}.esm.prod.js`),
    format: 'es',
  },
  cjs: {
    file: resolvePackagePath(`dist/${packageName}.cjs`),
    format: 'cjs',
  },
  'cjs-prod': {
    file: resolvePackagePath(`dist/${packageName}.cjs.prod`),
    format: 'cjs',
  },
}

export default packageFormats.map(format => createConfig(format))

function createConfig(format) {
  const output = outputMap[format]
  if (!output) {
    throw new Error(`不支持的格式：${format}`)
  }

  const isProd = format.endsWith('-prod')
  const baseFormat = format.replace(/-prod$/, '')

  return {
    input: resolvePackagePath('src/index.ts'),
    external: id => {
      if (id.startsWith('@vue-source/')) {
        return !id.startsWith(pkg.name)
      }
      return false
    },
    output: {
      ...output,
      exports: 'named',
      sourcemap: true,
    },
    plugins: [
      alias({
        entries: aliasEntries,
      }),
      nodeResolve({
        extensions: ['.mjs', '.js', '.json', '.ts'],
      }),
      commonjs(),
      json(),
      esbuild({
        target: 'es2020',
        tsconfig: path.join(rootDir, 'tsconfig.json'),
        sourceMap: true,
        minify: isProd,
        define: {
          'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
          __DEV__: JSON.stringify(!isProd),
        },
        format: baseFormat === 'cjs' ? 'cjs' : 'esm',
      }),
    ],
  }
}
