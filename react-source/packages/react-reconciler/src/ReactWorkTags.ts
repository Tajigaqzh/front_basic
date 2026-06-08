/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// 函数组件
// @beginner: 声明 FunctionComponent：保存当前步骤需要读取或更新的数据。
export const FunctionComponent = 0;
// 类组件
// @beginner: 声明 ClassComponent：保存当前步骤需要读取或更新的数据。
export const ClassComponent = 1;
// 根
// @beginner: 声明 HostRoot：保存当前步骤需要读取或更新的数据。
export const HostRoot = 3;
// @beginner: 声明 HostPortal：保存当前步骤需要读取或更新的数据。
export const HostPortal = 4;
// @beginner: 声明 HostComponent：保存当前步骤需要读取或更新的数据。
export const HostComponent = 5;
// @beginner: 声明 HostText：保存当前步骤需要读取或更新的数据。
export const HostText = 6;
// @beginner: 声明 Fragment：保存当前步骤需要读取或更新的数据。
export const Fragment = 7;
// @beginner: 声明 Mode：保存当前步骤需要读取或更新的数据。
export const Mode = 8;
// @beginner: 声明 ContextConsumer：保存当前步骤需要读取或更新的数据。
export const ContextConsumer = 9;
// @beginner: 声明 ContextProvider：保存当前步骤需要读取或更新的数据。
export const ContextProvider = 10;
// @beginner: 声明 ForwardRef：保存当前步骤需要读取或更新的数据。
export const ForwardRef = 11;
// @beginner: 声明 Profiler：保存当前步骤需要读取或更新的数据。
export const Profiler = 12;
// @beginner: 声明 SuspenseComponent：保存当前步骤需要读取或更新的数据。
export const SuspenseComponent = 13;
// @beginner: 声明 MemoComponent：保存当前步骤需要读取或更新的数据。
export const MemoComponent = 14;
// @beginner: 声明 SimpleMemoComponent：保存当前步骤需要读取或更新的数据。
export const SimpleMemoComponent = 15;
// @beginner: 声明 LazyComponent：保存当前步骤需要读取或更新的数据。
export const LazyComponent = 16;
// @beginner: 声明 DehydratedFragment：保存当前步骤需要读取或更新的数据。
export const DehydratedFragment = 18;
// @beginner: 声明 SuspenseListComponent：保存当前步骤需要读取或更新的数据。
export const SuspenseListComponent = 19;
// @beginner: 声明 ScopeComponent：保存当前步骤需要读取或更新的数据。
export const ScopeComponent = 21;
// @beginner: 声明 OffscreenComponent：保存当前步骤需要读取或更新的数据。
export const OffscreenComponent = 22;
// @beginner: 声明 LegacyHiddenComponent：保存当前步骤需要读取或更新的数据。
export const LegacyHiddenComponent = 23;
// @beginner: 声明 CacheComponent：保存当前步骤需要读取或更新的数据。
export const CacheComponent = 24;
// @beginner: 声明 TracingMarkerComponent：保存当前步骤需要读取或更新的数据。
export const TracingMarkerComponent = 25;
// @beginner: 声明 HostHoistable：保存当前步骤需要读取或更新的数据。
export const HostHoistable = 26;
// @beginner: 声明 HostSingleton：保存当前步骤需要读取或更新的数据。
export const HostSingleton = 27;
// @beginner: 声明 ActivityComponent：保存当前步骤需要读取或更新的数据。
export const ActivityComponent = 31;

// @beginner: 定义 WorkTag：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type WorkTag =
  | typeof FunctionComponent
  | typeof ClassComponent
  | typeof HostRoot
  | typeof HostPortal
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment
  | typeof Mode
  | typeof ScopeComponent
  | typeof ContextConsumer
  | typeof ContextProvider
  | typeof ForwardRef
  | typeof Profiler
  | typeof SuspenseComponent
  | typeof SuspenseListComponent
  | typeof MemoComponent
  | typeof SimpleMemoComponent
  | typeof LazyComponent
  | typeof DehydratedFragment
  | typeof OffscreenComponent
  | typeof LegacyHiddenComponent
  | typeof CacheComponent
  | typeof TracingMarkerComponent
  | typeof HostHoistable
  | typeof HostSingleton
  | typeof ActivityComponent;
