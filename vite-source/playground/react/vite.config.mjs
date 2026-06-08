import react from '../../packages/plugin-react/dist/index.js'

export default {
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    manifest: true,
  },
}
