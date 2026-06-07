import { initDirectivesForSSR } from '@vue-source/runtime-dom'

// SSR 入口初始化时，要把运行时 DOM 指令切换到服务端实现，
// 这样 `v-model`、`v-show` 等指令在渲染字符串时才会走 SSR 分支。
initDirectivesForSSR()

// 对外暴露 SSR 上下文类型与字符串渲染能力。
export type { SSRContext } from './buffer'
export { renderToString } from './renderToString'

// 对外暴露流式渲染能力；这些 API 共享同一套底层 buffer 展开逻辑。
export {
  renderToSimpleStream,
  renderToNodeStream,
  pipeToNodeWritable,
  renderToWebStream,
  pipeToWebWritable,
  type SimpleReadable,
  // deprecated
  renderToStream,
} from './renderToStream'

// 编译产物依赖的内部辅助方法也需要从入口透出。
export * from './internal'
