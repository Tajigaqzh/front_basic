/**
 * @beginner-module: 源码导读
 * 本文件定义 Fiber flags，render 阶段打标记，commit 阶段按标记执行副作用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 Flags：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Flags = number;

// @beginner: 声明 NoFlags：保存当前步骤需要读取或更新的数据。
export const NoFlags = 0b0000;
// @beginner: 声明 Placement：保存当前步骤需要读取或更新的数据。
export const Placement = 0b0001;
// @beginner: 声明 Update：保存当前步骤需要读取或更新的数据。
export const Update = 0b0010;
// @beginner: 声明 ChildDeletion：保存当前步骤需要读取或更新的数据。
export const ChildDeletion = 0b0100;
// @beginner: 声明 Passive：保存当前步骤需要读取或更新的数据。
export const Passive = 0b1000;
// @beginner: 声明 DidPropagateContext：保存当前步骤需要读取或更新的数据。
export const DidPropagateContext = 0b0001_0000;
// @beginner: 声明 NeedsPropagation：保存当前步骤需要读取或更新的数据。
export const NeedsPropagation = 0b0010_0000;
// @beginner: 声明 DidCapture：保存当前步骤需要读取或更新的数据。
export const DidCapture = 0b0100_0000;
// @beginner: 声明 ShouldCapture：保存当前步骤需要读取或更新的数据。
export const ShouldCapture = 0b1000_0000;
// @beginner: 声明 Incomplete：保存当前步骤需要读取或更新的数据。
export const Incomplete = 0b0001_0000_0000;
// @beginner: 声明 ForceClientRender：保存当前步骤需要读取或更新的数据。
export const ForceClientRender = 0b0010_0000_0000;
// @beginner: 声明 ScheduleRetry：保存当前步骤需要读取或更新的数据。
export const ScheduleRetry = 0b0100_0000_0000;
// @beginner: 声明 Forked：保存当前步骤需要读取或更新的数据。
export const Forked = 0b1000_0000_0000;

// @beginner: 声明 MutationMask：保存当前步骤需要读取或更新的数据。
export const MutationMask = Placement | Update | ChildDeletion;
// @beginner: 声明 PassiveMask：保存当前步骤需要读取或更新的数据。
export const PassiveMask = Passive;
