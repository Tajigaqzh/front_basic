# Vite Source 官方对照表

本表记录阅读版文件和官方源码文件的对应关系，以及删减点。阅读版不是官方
替代品，它保留主执行流，省略大量生产级边界。

## Vite Core

| 阅读版文件 | 官方对应文件 | 保留内容 | 主要删减 |
| --- | --- | --- | --- |
| `src/node/cli.ts` | `src/node/cli.ts` | serve/build/preview 命令分发 | 完整 CLI flags、shortcuts、环境变量加载提示 |
| `src/node/config.ts` | `src/node/config.ts` | config 文件加载、插件 config/configResolved、默认配置 | 多 environment、env 文件、legacy、实验选项、复杂 merge |
| `src/node/plugins/index.ts` | `src/node/plugins/index.ts` | 内置插件链顺序 | preAlias、worker、wasm、modulepreload、license、terser、plugin filter、devtools |
| `src/node/plugins/resolve.ts` | `src/node/plugins/resolve.ts` | alias、文件解析、exports/imports、conditions、browser、dedupe、builtin、optional peer | PnP、tsconfig paths、SSR external 深层规则、resolve warning 细节 |
| `src/node/plugins/importAnalysis.ts` | `src/node/plugins/importAnalysis.ts` | lexer 解析 import、URL 重写、HMR accept 信息 | accepted exports、循环边界、完整 sourcemap、复杂 import attributes |
| `src/node/plugins/css.ts` | `src/node/plugins/css.ts` | CSS Modules、Sass/Less、PostCSS、URL rebasing、build CSS extraction | Lightning CSS、完整 `@import`、CSS code splitting 细节、compose/global/local 完整规则 |
| `src/node/plugins/esbuild.ts` | `src/node/plugins/esbuild.ts` | TS/JSX transform | tsconfig 细节、decorators、build target 全量能力 |
| `src/node/optimizer/*` | `src/node/optimizer/*` | scan、metadata stale、esbuild bundle、缓存路径 | missing imports 自动重优化、dep version query、linked package 策略、SSR optimizeDeps |
| `src/node/server/index.ts` | `src/node/server/index.ts` | HTTP server、middleware 栈、watch、WS、HMR 触发 | chokidar、middlewareMode、HTTPS/HTTP2、warmup、open browser、shortcuts |
| `src/node/server/pluginContainer.ts` | `src/node/server/pluginContainer.ts` | resolve/load/transform、emitFile/getFileName/getModuleInfo、watch file | 完整 Rollup context、parse、sourcemap chain、hook filter/order、environment context |
| `src/node/server/moduleGraph.ts` | `src/node/server/mixedModuleGraph.ts` / `moduleGraph.ts` | URL/id 映射、importers/importedModules、HMR deps | 多 environment module graph、module info proxy、soft invalidation |
| `src/node/server/hmr.ts` | `src/node/server/hmr.ts` | accept boundary 传播、plugin handleHotUpdate、update/full-reload | accepted exports、循环 import 检测、CSS 专门路径、multi environment HMR |
| `src/node/build.ts` | `src/node/build.ts` | Rollup build、chunk graph、tree-shaking、manualChunks、CSS asset、manifest | build plugin suite、modulepreload graph、lib/worker/SSR build、watch、license、terser |
| `src/node/ssr/*` | `src/node/ssr/*` | SSR transform 和模块加载骨架 | module runner、external/noExternal 完整规则、stacktrace sourcemap、SSR HMR |
| `src/node/preview.ts` | `src/node/preview.ts` | dist 静态服务 | preview proxy、headers、open browser、strict host 细节 |

## Plugin Vue

| 阅读版文件 | 官方对应文件 | 保留内容 | 主要删减 |
| --- | --- | --- | --- |
| `packages/plugin-vue/src/index.ts` | `packages/plugin-vue/src/index.ts` | 插件入口、config、子请求分发、外链块读取 | option 细节、custom element、SSR 专门分支 |
| `main.ts` | `main.ts` | SFC 主模块拼装、template/style/custom 请求、helper | TS helper 细节、inline template 优化 |
| `script.ts` | `script.ts` | compileScript、script cache、`genDefaultAs` | props destructure、defineModel、更多 TS 边界 |
| `template.ts` | `template.ts` | compileTemplate、bindingMetadata、scoped | asset URL transform 完整规则、SSR render |
| `style.ts` | `style.ts` | compileStyleAsync、scoped CSS | SFC CSS Modules、style vars、sourcemap 合并 |
| `handleHotUpdate.ts` | `handleHotUpdate.ts` | descriptor diff、script/template/style invalidation | `__VUE_HMR_RUNTIME__` rerender/reload 精确运行时 |
| `helper.ts` | `helper.ts` | export helper 虚拟模块 | 与官方基本一致，但用途更小 |
| `utils/descriptorCache.ts` | `utils/descriptorCache.ts` | SFC descriptor 缓存和失效 | error 定位、更多缓存 key 细节 |

## 为什么这样删减

阅读版优先保留这些问题的答案：

- 一个请求如何从 URL 变成最终 JS？
- 插件钩子按什么顺序执行？
- 裸模块为什么要预构建？
- HMR 如何从文件变化走到浏览器更新？
- `.vue` 文件为什么会拆成 template/style 子请求？
- build 阶段为什么要交给 Rollup/Rolldown？

被删掉的大多是生产级边界：

- 多运行环境隔离
- 第三方插件全兼容
- worker/wasm/lib/SSR build
- 完整 sourcemap
- 完整 HMR 精确更新
- 复杂依赖生态兼容

学习时可以先掌握阅读版，再到官方源码里逐项补这些边界。
