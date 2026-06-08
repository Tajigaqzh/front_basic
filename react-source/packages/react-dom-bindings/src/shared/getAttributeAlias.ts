/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 aliases：保存当前步骤需要读取或更新的数据。
const aliases = new Map<string, string>([
  ["acceptCharset", "accept-charset"],
  ["className", "class"],
  ["htmlFor", "for"],
  ["httpEquiv", "http-equiv"],
  ["crossOrigin", "crossorigin"],
]);

export default function getAttributeAlias(name: string): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return aliases.get(name) ?? name;
}
