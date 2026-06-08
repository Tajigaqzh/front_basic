/**
 * @beginner-module: 源码导读
 * 本文件属于 scheduler 调度器，负责按优先级安排任务执行。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 enableProfiling：保存当前步骤需要读取或更新的数据。
export const enableProfiling = true;
// @beginner: 声明 frameYieldMs：保存当前步骤需要读取或更新的数据。
export const frameYieldMs = 5;
// @beginner: 声明 userBlockingPriorityTimeout：保存当前步骤需要读取或更新的数据。
export const userBlockingPriorityTimeout = 250;
// @beginner: 声明 normalPriorityTimeout：保存当前步骤需要读取或更新的数据。
export const normalPriorityTimeout = 5000;
// @beginner: 声明 lowPriorityTimeout：保存当前步骤需要读取或更新的数据。
export const lowPriorityTimeout = 10000;
// @beginner: 声明 enableRequestPaint：保存当前步骤需要读取或更新的数据。
export const enableRequestPaint = true;
// @beginner: 声明 enableAlwaysYieldScheduler：保存当前步骤需要读取或更新的数据。
export const enableAlwaysYieldScheduler = false;
