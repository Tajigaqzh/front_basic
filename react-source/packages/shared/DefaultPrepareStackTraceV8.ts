/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 CallSiteLike：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type CallSiteLike = {
  toString(): string;
};

/**
 * Node/V8 环境的 `Error.prepareStackTrace` fork。
 *
 * V8 会把结构化调用栈传给这个函数；React 在 owner stack 处理中临时安装它，
 * 目的是得到稳定的 `Error: message\n    at ...` 文本格式，便于后续裁剪内部帧。
 */
// @beginner: 进入 prepareStackTrace：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function prepareStackTrace(
  error: Error,
  structuredStackTrace: CallSiteLike[],
): string {
  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = error.name || "Error";
  // @beginner: 声明 message：保存当前步骤需要读取或更新的数据。
  const message = error.message || "";
  // @beginner: 声明 stack：保存当前步骤需要读取或更新的数据。
  let stack = `${name}: ${message}`;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (let i = 0; i < structuredStackTrace.length; i += 1) {
    stack += `\n    at ${structuredStackTrace[i].toString()}`;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return stack;
}

export default prepareStackTrace;
