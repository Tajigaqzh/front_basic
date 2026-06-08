/**
 * 官方默认导出是 `undefined`：在浏览器/client 构建里让 JS 引擎使用原生
 * stack 格式；server/edge fork 会替换成 V8 兼容 formatter。
 */
export type StackTraceFormatter = (
  error: Error,
  structuredStackTrace: unknown[],
) => string;

const DefaultPrepareStackTrace = undefined as unknown as StackTraceFormatter | undefined;

export default DefaultPrepareStackTrace;
