/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
export default function formatProdErrorMessage(code: number, ...args: unknown[]): string {
  // @beginner: 声明 url：保存当前步骤需要读取或更新的数据。
  let url = `https://react.dev/errors/${code}`;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const arg of args) {
    url += `?args[]=${encodeURIComponent(String(arg))}`;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return `Minified React error #${code}; visit ${url} for the full message.`;
}
