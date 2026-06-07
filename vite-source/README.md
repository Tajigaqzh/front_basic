# vite-source

这是一个用于阅读 Vite 执行逻辑的源码复刻版。它参考本机官方仓库
`/Users/nwyzx/Desktop/project/source/vite/packages/vite/src` 的模块组织，
但不会机械复制所有边缘能力，而是优先保留 Vite 最核心的执行主线：

- CLI 解析命令
- `resolveConfig` 归一化配置
- 插件排序和插件容器
- dev server 中间件
- `transformRequest` 模块加载、转换、缓存
- `ModuleGraph` 模块关系
- HMR 消息广播
- build/preview 的基本流程

核心代码在 `packages/vite/src/node`，阅读时建议从
`src/node/cli.ts` 或 `src/node/index.ts` 开始。

你再对比一下官网的vite的视线和当前代码，还缺什么，尤其是细节上


• 我会按“官方目录/文件职责 vs 当前复刻实现”的角度做一次差距盘点，重点看 dev server、插件链、resolver、import analysis、optimizer、Vue 插件、build/SSR/HMR 这些细节。先收集两边目录和关键文件。

• Explored
└ List node
List node
List plugin-vue
List plugin-vue

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• 初步目录差距很明显：当前复刻版覆盖了主链路文件，但官方 node 下还有大量中间件、环境、worker、wasm、glob、esbuild/oxc、publicDir、watch、mixedModuleGraph 等细节模块；Vue 插件这边也缺 compiler.ts、script.ts、handleHotUpdate.ts、
helper.ts、utils/error.ts 等官方关键文件。我继续看插件链和几个核心文件的具体差异。

• Explored
└ Read index.ts

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• 我对比了本地官方源码：

- Vite 官方：/Users/nwyzx/Desktop/project/source/vite/packages/vite/src/node
- plugin-vue 官方：/Users/nwyzx/Desktop/project/source/vite-plugin-vue/packages/plugin-vue/src
- 当前复刻版：vite-source/packages/vite、vite-source/packages/plugin-vue

结论：当前版本已经跑通了“源码阅读主链路”，但还不是官方 Vite 的完整实现。尤其是细节上，缺口主要集中在下面这些地方。

当前已覆盖

- CLI -> resolveConfig -> 插件链 -> dev server -> transformRequest
- 基础插件：resolve、html、json、css、asset、define、importAnalysis、optimizedDeps
- 基础 ModuleGraph、HMR WebSocket、CSS Modules、图片 import、真实 Vue runtime
- 本地复刻版 @vitejs/plugin-vue：.vue 主模块、template、style scoped、script setup 基础绑定

Vite 缺的核心细节

1. Dev server 中间件体系还很简化

官方有完整 middleware 栈：

- server/middlewares/transform.ts
- static.ts
- indexHtml.ts
- htmlFallback.ts
- proxy.ts
- hostCheck.ts
- error.ts
- notFound.ts
- time.ts
- memoryFiles.ts

当前 vite-source/packages/vite/src/node/server/index.ts 是手写 if/else 路由。还缺：

- SPA/MPA HTML fallback
- /public 目录处理
- /@fs/ 安全 allow list
- proxy
- CORS / host 校验
- HTTPS / HTTP2
- ETag、cache header
- error overlay
- source map 返回
- open browser
- CLI shortcuts

2. resolver 还远不够精确

当前 resolver 能处理相对路径、绝对路径、bare import、/@id/，但官方 resolve.ts / nodeResolve.ts 细节很多：

- exports / imports 条件解析完整规则
- browser field 映射
- module / main / jsnext:main 优先级细节
- package self reference
- resolve.dedupe
- symlink / preserveSymlinks
- SSR external / noExternal
- optional peer dependency
- #imports
- nested dependency 的更多边界
- package data watch 与缓存失效

现在 Vue runtime 能跑，但复杂 npm 包解析还会遇到边界。

3. import analysis 仍是正则级，不是 AST 级

当前 vite-source/packages/vite/src/node/plugins/importAnalysis.ts 是轻量扫描。

官方用更严谨的 lexer/AST 处理：

- import/export 的所有语法形态
- import.meta.glob
- dynamic import vars
- import assertions / attributes
- template literal dynamic import
- source map 保留
- HMR accept 精确依赖
- circular import 和 accepted boundary 传播

所以现在适合阅读流程，但复杂语法会漏。

4. 插件容器只实现了最小 Rollup 上下文

当前 vite-source/packages/vite/src/node/server/pluginContainer.ts 已支持基本 resolveId/load/transform 和 object hook，但官方还包含：

- this.emitFile
- this.getFileName
- this.getModuleInfo
- this.parse
- this.addWatchFile 的真实 watcher 集成
- watchChange
- buildEnd
- closeBundle
- hook filter / order
- per-environment plugin context
- transform cache、sourcemap chain
- SSR/client environment 分离

这会影响第三方插件兼容性。

5. CSS 还只是演示级

当前 CSS 支持普通 CSS、CSS Modules、简单预处理模拟。官方 [css.ts] 还包括：

- PostCSS config 自动加载
- Sass/Less/Stylus 真编译
- Lightning CSS
- CSS @import
- URL rebasing
- CSS code splitting
- CSS HMR 精确更新
- CSS source map
- ?inline、?raw
- CSS Modules compose、global/local、localsConvention 完整规则

6. 依赖预构建还不是官方级别

当前 optimizer 有扫描和缓存，但官方依赖预构建复杂很多：

- Rolldown/esbuild 真 bundle
- CJS -> ESM interop
- dep hash / browser hash
- missing imports
- optimized dep stale 检测
- 依赖入口扫描插件
- package lock / config 变化触发重新预构建
- linked package 处理
- SSR optimizeDeps

现在更像“流程模型”，不是完整 dep optimizer。

7. build 还不是真正 Rollup/Rolldown 构建

当前 vite-source/packages/vite/src/node/build.ts 自己生成简化 ChunkGraph。

官方 build 还缺：

- Rolldown/Rollup 调用
- tree-shaking
- shared chunk
- manualChunks
- dynamic import chunk
- CSS extraction
- asset hashing
- preload graph
- manifest / ssrManifest 完整格式
- lib mode
- worker build
- minify
- sourcemap
- build watch

8. SSR 只是基础模块加载

当前 SSR 有 ssrLoadModule、ssrTransform 骨架。官方还包括：

- module runner
- CJS interop
- externalization 规则
- stacktrace sourcemap 修复
- SSR transform source map
- SSR HMR
- SSR manifest
- fetchModule / runnerImport 的完整协议

9. HMR 传播算法还很简化

现在能做基础 self-accept 和 full reload。官方 HMR 还包括：

- import.meta.hot.accept(['dep'], cb) 精确依赖更新
- accepted exports
- dead-end boundary 检测
- circular import 检测
- CSS HMR 特判
- Vue SFC template-only rerender
- prune / dispose
- custom event
- 多 environment HMR

plugin-vue 缺的细节
当前本地 vite-source/packages/plugin-vue/src/index.ts 已经能跑基础 SFC，但和官方还差：

- compiler.ts：自定义 compiler 解析
- script.ts：完整 resolveScript 缓存、TS、props destructure、defineModel
- handleHotUpdate.ts：Vue SFC 精确 HMR
- helper.ts：export helper
- utils/error.ts：Rollup 风格错误定位
- custom block
- <script lang="ts">
- <template src="">
- <style src="">
- CSS Modules in SFC
- custom element .ce.vue
- asset URL transform
- SSR render
- sourcemap 合并
- template inline 优化

我建议下一步优先补的顺序

1. server/middlewares/*：先把 dev server 从 if/else 拆成官方式 middleware。
2. plugins/importMetaGlob.ts、dynamicImportVars.ts、assetImportMetaUrl.ts：这是 Vite 日常特性核心。
3. plugins/esbuild.ts：补 TS/JSX 转换，否则 main.ts 现在只能写 JS 语法。
4. plugins/css.ts 深化：PostCSS、真实 Sass/Less、URL rebasing。
5. plugin-vue/script.ts 和 handleHotUpdate.ts：让 Vue SFC 更接近官方。
6. resolver 完整化：package exports/imports、conditions、browser fi~~~~eld。
7. build 改接 Rolldown/Rollup：真正 chunk graph、tree-shaking、manualChunks。
8. 后续再逐步补 AST 精确解析。
当前版本适合理解 Vite “主执行流”，但如果目标是 1:1 深度复刻，下一阶段应该从 middleware、resolver、import analysis、esbuild、plugin-vue script/HMR 这些细节开始补。



1. AST 精确解析还没做
    - importAnalysis.ts 目前比正则版强了一些，但还不是官方级 AST / lexer 级。
    - 复杂 import/export、import attributes、精确 HMR accept 依赖分析还没完全覆盖。

2. 依赖预构建还没做到官方级
    - 目前有 optimizer 流程和缓存模型。
    - 还缺真正 esbuild/Rolldown 预打包、CJS interop、missing imports、dep hash/stale 检测、linked package 边界。

3. build 已接 Rollup，但还不是完整官方 build
    - 已完成真实 Rollup chunk graph、tree-shaking、dynamic chunk、manualChunks。
    - 还缺 CSS extraction、CSS code splitting、asset hashing 完整规则、modulepreload graph、minify、sourcemap、watch、lib mode、worker build、ssrManifest。

4. HMR 还不够官方
    - 基础 self-accept、Vue SFC cache invalidation 有了。
    - 还缺精确边界传播、accepted deps 算法、circular import 检测、prune/dispose、Vue template-only rerender/runtime reload。

5. plugin-vue 还缺官方细节
    - script.ts 和 handleHotUpdate.ts 已有基础版。
    - 还缺 custom block、template src、style src、SFC CSS Modules、custom element、SSR render、asset URL transform、sourcemap 合并。

6. resolver 还有边缘规则
    - exports/imports/conditions/browser/self-reference/dedupe 已补。
    - 还缺 optional peer dependency、SSR external/noExternal、builtins、PnP、tsconfig paths、package cache watch invalidation。

7. middleware 还有工程细节
    - 官方式 middleware 拆分已完成。
    - 还缺 proxy、CORS、host check、publicDir 完整规则、/@fs/ allow list、ETag/cache header、error overlay、CLI shortcuts。

所以按你那 1-8 的路线看：1-7 都已经做了“可运行的源码阅读版实现”，但真正还没展开到官方深度的是 第 8 AST 精确解析，以及横向细节里的 dep optimizer、完整 HMR、完整 CSS/build/SSR 边界。

