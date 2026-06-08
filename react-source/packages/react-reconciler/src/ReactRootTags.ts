/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 LegacyRoot：保存当前步骤需要读取或更新的数据。
export const LegacyRoot = 0;
// @beginner: 声明 ConcurrentRoot：保存当前步骤需要读取或更新的数据。
export const ConcurrentRoot = 1;

// @beginner: 定义 RootTag：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type RootTag = typeof LegacyRoot | typeof ConcurrentRoot;
