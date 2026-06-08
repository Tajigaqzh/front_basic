/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 HookFlags：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type HookFlags = number;

// @beginner: 声明 NoFlags：保存当前步骤需要读取或更新的数据。
export const NoFlags = 0;
// @beginner: 声明 HasEffect：保存当前步骤需要读取或更新的数据。
export const HasEffect = 0b0001;
// @beginner: 声明 Insertion：保存当前步骤需要读取或更新的数据。
export const Insertion = 0b0010;
// @beginner: 声明 Layout：保存当前步骤需要读取或更新的数据。
export const Layout = 0b0100;
// @beginner: 声明 Passive：保存当前步骤需要读取或更新的数据。
export const Passive = 0b1000;
