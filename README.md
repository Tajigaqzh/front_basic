# Front Workspace

这是一个基于 `pnpm workspace` 的 monorepo。

## 项目结构

```text
front_basic/
├─ backend/   # OpenAI 流式接口
├─ frontend/  # React 前端
├─ docs/      # VitePress 文档站点
├─ promise/   # 手写 Promise 实现
├─ vue-source/# 手写 Vue 源码/实验目录
├─ package.json
└─ pnpm-workspace.yaml
```

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

### backend

```bash
pnpm --filter @front/backend build
```

### frontend

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

当前已经作为 workspace package 初始化，但还没接具体 Vue 构建工具。

```bash
pnpm --filter @front/vue-source dev
pnpm --filter @front/vue-source build
```

## 包名列表

- `@front/backend`
- `@front/frontend`
- `@front/docs`
- `@front/promise`
- `@front/vue-source`


# 源码实现步骤
- reactivity 响应式核心，理解vue3基本原理
- shared 共享工具包
- 




