# Front Workspace

这是一个基于 `pnpm workspace` 的前端学习与源码阅读 monorepo。当前仓库主要用于整理工程化实验、手写实现、源码复刻和配套阅读文档。

## 项目结构

```text
front_basic/
├─ ai_flow_output/       # AI Flow 应用统一管理目录
│  ├─ backend/           # OpenAI 流式接口与服务端实验
│  └─ frontend/          # React 前端示例
├─ docs/                 # VitePress 文档站点
├─ js/                   # JavaScript 零散实验目录
├─ promise/              # 手写 Promise 实现与测试
├─ vue-source/           # Vue 3 源码阅读版 / 手写实现
├─ vue-demo/             # Vue Demo 工程
├─ pinia-demo/           # Pinia 相关实验占位目录
├─ pinia-source/         # Pinia 源码阅读版
├─ vue-router-source/    # Vue Router 官方源码与阅读资料
├─ vite-source/          # Vite 源码复刻版与 playground
├─ rag/                  # RAG 相关记录与实验
├─ react-source/         # React 源码/实验占位目录
├─ package.json          # 根工作区脚本
├─ pnpm-workspace.yaml   # workspace 配置
├─ pnpm-lock.yaml        # 根锁文件
└─ vitest.config.ts      # 根测试配置
```

## Workspace 包

根 `pnpm-workspace.yaml` 当前纳入这些包：

- `ai_flow_output/backend`
- `ai_flow_output/frontend`
- `docs`
- `promise`
- `vue-source`
- `vue-demo`
- `pinia-source`
- `vue-router-source`
- `vite-source`

`vite-source`、`pinia-source`、`vue-router-source` 内部还各自保留自己的子 workspace / package 结构，根 workspace 只负责把它们作为独立学习项目纳入管理。

## 安装依赖

在根目录执行：

```bash
pnpm install
```

这会安装 root 依赖，并把各个 workspace package 一起链接好。

## 根目录命令

### 构建指定包

根目录提供统一的 `build` 命令，通过 `--pkg` 指定包名：

```bash
pnpm build --pkg @front/backend
pnpm build --pkg @front/frontend
pnpm build --pkg @front/docs
pnpm build --pkg @front/promise
pnpm build --pkg @front/vue-source
```

### 构建全部包

```bash
pnpm build:all
```

### 运行测试

运行全部根级测试：

```bash
pnpm test
```

监听模式：

```bash
pnpm test:watch
```

只运行 `promise` 目录下的测试：

```bash
pnpm test:promise
```

## 各子包常用命令

### AI Flow backend

```bash
pnpm --filter @front/backend build
```

### AI Flow frontend

开发：

```bash
pnpm --filter @front/frontend dev
```

构建：

```bash
pnpm --filter @front/frontend build
```

### docs

开发服务器端口固定为 `4000`：

```bash
pnpm --filter @front/docs dev
```

构建：

```bash
pnpm --filter @front/docs build
```

### promise

构建：

```bash
pnpm --filter @front/promise build
```

测试：

```bash
pnpm test:promise
```

### vue-source

```bash
pnpm --filter @front/vue-source build
pnpm --filter @front/vue-source build:types
pnpm --filter @front/vue-source build:pkg --pkg reactivity
```

### vue-demo

```bash
pnpm --filter @front/vue-demo dev
pnpm --filter @front/vue-demo build
```

### pinia-source

```bash
pnpm --filter @front/pinia-source-root build
pnpm --filter @front/pinia-source-root test
```

### vite-source

`vite-source` 是独立的源码复刻 workspace，常用命令建议在该目录内执行：

```bash
pnpm --dir vite-source build
pnpm --dir vite-source dev:basic
pnpm --dir vite-source dev:vue
pnpm --dir vite-source build:basic
pnpm --dir vite-source build:vue
```

## 当前内容重点

- `vue-source/packages/reactivity`
  手写 Vue 3 reactivity 核心实现与源码注释，覆盖 `effect`、`reactive`、`ref`、`computed`、`watch`、调度器、依赖收集与触发链路。
- `vue-source/packages/runtime-core`、`vue-source/packages/runtime-dom`
  Vue runtime 主链路阅读与实现实验，重点包括组件挂载、更新、patch、block tree、fragment、diff、scheduler、DOM patch props。
- `docs/vue/source`
  Vue 源码分析文档，包含 reactivity、runtime-core、runtime-dom 等阅读笔记与流程图。
- `pinia-source/packages/pinia`
  Pinia 核心源码阅读版，覆盖 `createPinia`、`defineStore`、setup store、option store、插件、订阅、action、hydration、storeToRefs 与类型系统。
- `docs/vue/pinia`
  Pinia 阅读路线、源码对照、核心链路拆解和类型专题。
- `vue-router-source/packages/router`
  Vue Router 官方源码与实验目录，重点阅读 matcher、history、navigation、RouterLink / RouterView、typed routes、unplugin 和运行时边界机制。
- `docs/vue/router`
  Vue Router 阅读路线、matcher/tokenizer/ranker、history modes、navigation flow、component API 和 URL normalization 文档。
- `vite-source/packages/vite`
  Vite 源码复刻版，覆盖 CLI、config、插件容器、dev server middleware、transformRequest、ModuleGraph、HMR、optimizer、resolver、CSS、build、SSR 主流程。
- `vite-source/packages/plugin-vue`
  本地复刻版 `@vitejs/plugin-vue`，覆盖 SFC descriptor、script、template、style、helper 和 HMR 更新处理。
- `vite-source/playground`
  basic 与 Vue playground，用于验证复刻版 Vite 的 dev server、HMR、CSS Modules、TS/JSX、Vue SFC、静态资源和 build。
- `docs/js/12_js_engineering`
  Vite 复刻核心流程、阅读路线、官方源码对照表和 plugin-vue 复刻流程文档。
- `promise`
  手写 Promise 实现与测试，用于理解 Promise/A+、then 链式调用、状态流转和异步调度。
- `ai_flow_output/backend`、`ai_flow_output/frontend`
  AI Flow 的服务端和 React 前端示例，统一从根目录旧 `backend` / `frontend` 迁移到 `ai_flow_output` 下管理。
