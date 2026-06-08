/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 supportedInputTypes：保存当前步骤需要读取或更新的数据。
const supportedInputTypes: Record<string, true> = {
  color: true,
  date: true,
  datetime: true,
  "datetime-local": true,
  email: true,
  month: true,
  number: true,
  password: true,
  range: true,
  search: true,
  tel: true,
  text: true,
  time: true,
  url: true,
  week: true,
};

export default function isTextInputElement(elem: unknown): boolean {
  // @beginner: 声明 node：保存当前步骤需要读取或更新的数据。
  const node = elem as { nodeName?: string; type?: string } | null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node === null || node.nodeName === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 nodeName：保存当前步骤需要读取或更新的数据。
  const nodeName = node.nodeName.toLowerCase();
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (nodeName === "input") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return node.type !== undefined && supportedInputTypes[node.type] === true;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return nodeName === "textarea";
}
