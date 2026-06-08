/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
/**
 * 官方默认导出是 `undefined`：在浏览器/client 构建里让 JS 引擎使用原生
 * stack 格式；server/edge fork 会替换成 V8 兼容 formatter。
 */
// @beginner: 定义 StackTraceFormatter：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type StackTraceFormatter = (
  error: Error,
  structuredStackTrace: unknown[],
) => string;

// @beginner: 声明 DefaultPrepareStackTrace：保存当前步骤需要读取或更新的数据。
const DefaultPrepareStackTrace = undefined as unknown as StackTraceFormatter | undefined;

export default DefaultPrepareStackTrace;
