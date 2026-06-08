import { transform } from 'esbuild'
export default function localReactSource() {
  return {
    name: 'front:local-react-source',
    enforce: 'pre',

    config() {
      return {
        esbuild: {
          jsx: 'automatic',
          jsxImportSource: 'react',
        },
        define: {
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
        },
      }
    },

    async transform(code, id) {
      const cleanId = id.split('?')[0].split('#')[0]
      if (!/\.[cm]?[jt]sx?$/.test(cleanId)) return null
      if (cleanId.includes('/node_modules/')) return null

      const result = await transform(code, {
        loader: cleanId.endsWith('.tsx')
          ? 'tsx'
          : cleanId.endsWith('.ts') || cleanId.endsWith('.mts') || cleanId.endsWith('.cts')
            ? 'ts'
            : cleanId.endsWith('.jsx')
              ? 'jsx'
              : 'js',
        sourcemap: true,
        sourcefile: cleanId,
        target: 'es2020',
        jsx: 'automatic',
        jsxImportSource: 'react',
      })

      return {
        code: result.code,
        map: result.map ? JSON.parse(result.map) : null,
      }
    },
  }
}
