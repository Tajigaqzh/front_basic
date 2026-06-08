/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 ToStringValue：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ToStringValue = string | number | boolean | bigint | null | undefined;
