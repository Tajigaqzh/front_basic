export {
  defineConfig,
  resolveConfig,
  type InlineConfig,
  type ResolvedConfig,
  type UserConfig,
  type ConfigEnv,
} from './config.js'
export { createServer, type ViteDevServer } from './server/index.js'
export { build, createBuilder, type BuildEnvironmentOptions } from './build.js'
export { preview } from './preview.js'
export {
  createFilter,
  formatPostcssSourceMap,
  isCSSRequest,
  normalizePath,
} from './utils.js'
export { transformWithEsbuild, type ESBuildOptions, type ESBuildTransformResult } from './plugins/esbuild.js'
export { ssrLoadModule, ssrTransform, type SsrModule, type SsrTransformResult } from './ssr/index.js'
export {
  optimizeDeps,
  scanDeps,
  type DepsOptimizer,
  type DepOptimizationMetadata,
  type OptimizedDepInfo,
} from './optimizer/index.js'
export {
  createChunkGraph,
  type BuildChunk,
  type BuildModule,
  type ChunkGraph,
} from './build.js'
export type { Plugin, PluginOption, TransformResult } from './plugin.js'
