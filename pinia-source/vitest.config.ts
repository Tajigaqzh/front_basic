import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __DEV__: 'true',
    __TEST__: 'true',
    __USE_DEVTOOLS__: 'false',
  },
  resolve: {
    alias: {
      pinia: fileURLToPath(new URL('./packages/pinia/src', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/__tests__/**/*.spec.ts'],
  },
})
