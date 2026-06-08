/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 Container：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Container = Element | Document | DocumentFragment;
// @beginner: 定义 Instance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type Instance = Element;
// @beginner: 定义 TextInstance：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type TextInstance = Text;
