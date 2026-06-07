# Vue Source

这是一个手写 Vue 源码与实验目录，当前已经补齐了响应式、运行时和编译链路的主要骨架，适合做源码阅读、教学拆解和面试复盘。

## 源码实现步骤

- `reactivity`
  响应式核心，用于理解 Vue 3 的基本原理
- `shared`
  共享工具包
- `runtime-core`
  运行时核心，包含组件实例、VNode、调度器、渲染器主流程
- `runtime-dom`
  DOM 运行时，负责浏览器宿主实现、属性 patch、事件 patch
- `compiler-core` / `compiler-dom`
  编译层主链路，负责模板 AST、transform、codegen 与 DOM 平台扩展
- `compiler-sfc`
  单文件组件入口，负责 `.vue` 分块和模板编译接入

## 目录结构

```text
vue-source/
├─ packages/
│  ├─ reactivity/   # 手写响应式核心
│  ├─ shared/       # 共享工具函数
│  ├─ runtime-core/ # 运行时核心
│  ├─ runtime-dom/  # DOM 运行时
│  ├─ compiler-*/   # 编译链路与 SFC 入口
│  └─ vue/          # 聚合包
├─ scripts/         # 构建脚本
├─ rollup.config.js # 打包配置
└─ tsconfig.json    # TypeScript 配置
```

## 当前重点模块

### `packages/reactivity`

包名：`@vue-source/reactivity`

简介：

- 实现响应式核心能力
- 对外提供 `reactive`、`ref`、`computed`、`watch`、`effect` 等 API
- 是当前手写 Vue 源码实验的核心包

- `effect`
  副作用执行、调度、批处理
- `dep`
  依赖桶、订阅关系、触发流程
- `ref`
  `.value` 访问器响应式
- `reactive`
  基于 `Proxy` 的对象响应式入口
- `computed`
  带缓存的派生值
- `watch`
  侦听 API
- `effectScope`
  副作用作用域管理

### `packages/shared`

包名：`@vue-source/shared`

简介：

- 提供共享工具函数与类型工具
- 给 `reactivity` 等包复用
- 保持底层通用逻辑与响应式实现解耦

- 提供 `hasChanged`、`isObject`、`makeMap` 等共享工具函数
- 被 `reactivity` 等包复用

## 模块关系

`shared` 提供底层通用工具，`reactivity` 基于这些工具实现响应式系统。

可以简单理解成：

```text
shared
  -> 提供通用判断、工具函数

reactivity
  -> 基于 shared 实现 effect / dep / ref / reactive / computed / watch

runtime-core
  -> 基于 reactivity + shared 提供组件和渲染主流程

runtime-dom
  -> 基于 runtime-core 提供浏览器宿主实现

compiler-core
  -> 提供 parse / transform / codegen 主链路

compiler-dom
  -> 在 compiler-core 之上补 DOM 平台规则

compiler-sfc
  -> 负责 .vue 分块，并把 template 交给 compiler-dom
```

## 常用命令

在 `vue-source` 目录下执行：

```bash
pnpm install
```

构建：

```bash
pnpm build
```

开发模式：

```bash
pnpm dev
```

## 阅读路线

1. 先读 `packages/shared` 和 `packages/reactivity`
2. 再读 `packages/runtime-core` 和 `packages/runtime-dom`
3. 然后读 `packages/compiler-core` 和 `packages/compiler-dom`
4. 最后把 `packages/compiler-sfc` 和运行时、编译器串起来看完整链路
