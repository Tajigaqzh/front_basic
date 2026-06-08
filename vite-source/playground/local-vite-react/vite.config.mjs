import localReactSource from './plugins/local-react-source-plugin.mjs'

export default {
  plugins: [localReactSource()],
  resolve: {
    alias: [
      { find: 'react/jsx-runtime', replacement: '/src/vendor/react-jsx-runtime.js' },
      { find: 'react/jsx-dev-runtime', replacement: '/src/vendor/react-jsx-dev-runtime.js' },
      { find: 'react', replacement: '/src/vendor/react.js' },
      { find: 'react-dom/client', replacement: '/src/vendor/react-dom-client.js' },
      { find: 'react-dom', replacement: '/src/vendor/react-dom.js' },
    ],
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
    ],
  },
  server: {
    port: 3001,
  },
  build: {
    manifest: true,
  },
}
