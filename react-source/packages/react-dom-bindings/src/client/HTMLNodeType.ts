/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 ELEMENT_NODE：保存当前步骤需要读取或更新的数据。
export const ELEMENT_NODE = 1;
// @beginner: 声明 TEXT_NODE：保存当前步骤需要读取或更新的数据。
export const TEXT_NODE = 3;
// @beginner: 声明 COMMENT_NODE：保存当前步骤需要读取或更新的数据。
export const COMMENT_NODE = 8;
// @beginner: 声明 DOCUMENT_NODE：保存当前步骤需要读取或更新的数据。
export const DOCUMENT_NODE = 9;
// @beginner: 声明 DOCUMENT_FRAGMENT_NODE：保存当前步骤需要读取或更新的数据。
export const DOCUMENT_FRAGMENT_NODE = 11;
