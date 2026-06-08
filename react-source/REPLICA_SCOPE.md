# React Source 1:1 复刻范围

目标是按官方 React 仓库 `packages/*` 的包边界复刻 client/runtime 核心，不复刻服务端渲染、RSC 服务端绑定和 DevTools。

根工程包名可以保留为 `@front/react-source`；`react-source/packages/*` 下的子包目录名保持官方包名一致，例如 `react`、`react-dom`、`react-reconciler`、`scheduler`、`shared`。

跨包引用使用 workspace 包名或官方包名子路径，例如 `from "shared"`、`from "scheduler"`、`from "react-reconciler"`、`from "react-dom-bindings/src/client/ReactFiberConfigDOM.js"`；同包内部文件才使用相对路径。

## 纳入第一批运行时核心包

- `shared`
- `scheduler`
- `react`
- `react-dom`
- `react-dom-bindings`
- `react-reconciler`
- `react-is`
- `react-refresh`
- `react-cache`
- `use-sync-external-store`
- `use-subscription`

## 明确排除

- 服务端/RSC 相关：`react-server`、`react-client`、`react-server-dom-*`、`react-flight-server-*`、`react-markup`
- DevTools 相关：所有 `react-devtools*`
- 测试工具：`react-test-renderer`、`react-noop-renderer`、`jest-react`、`internal-test-utils`、`dom-event-testing-library`、`react-suspense-test-utils`
- 非 Web DOM 运行时：`react-native-renderer`、`react-art`
- 工具链插件：`eslint-plugin-react-hooks`

## 复刻策略

- 包名、文件名、模块职责尽量对齐官方源码。
- 官方 Flow 源码改写为 TypeScript。
- 保留中文注释解释关键流程。
- 对 client render 主链路追求高保真：ReactElement、Dispatcher、Fiber、Lane、Scheduler、DOM bindings、render/commit、Hooks。
- 对实验特性和平台特性保留同名占位或最小实现，避免偏离包结构。
