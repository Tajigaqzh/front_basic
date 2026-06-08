/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 TypeOfMode：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TypeOfMode = number;

// @beginner: 声明 NoMode：保存当前步骤需要读取或更新的数据。
export const NoMode = 0b0000000;
// @beginner: 声明 ConcurrentMode：保存当前步骤需要读取或更新的数据。
export const ConcurrentMode = 0b0000001;
// @beginner: 声明 ProfileMode：保存当前步骤需要读取或更新的数据。
export const ProfileMode = 0b0000010;
// @beginner: 声明 StrictLegacyMode：保存当前步骤需要读取或更新的数据。
export const StrictLegacyMode = 0b0001000;
// @beginner: 声明 StrictEffectsMode：保存当前步骤需要读取或更新的数据。
export const StrictEffectsMode = 0b0010000;
// @beginner: 声明 SuspenseyImagesMode：保存当前步骤需要读取或更新的数据。
export const SuspenseyImagesMode = 0b0100000;
