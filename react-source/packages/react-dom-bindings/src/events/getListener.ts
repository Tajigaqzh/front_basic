/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
export default function getListener(
  props: Record<string, unknown>,
  registrationName: string,
): ((event: Event) => void) | null {
  // @beginner: 声明 listener：保存当前步骤需要读取或更新的数据。
  const listener = props[registrationName];
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof listener === "function" ? (listener as (event: Event) => void) : null;
}
