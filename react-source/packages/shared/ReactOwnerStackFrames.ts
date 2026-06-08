/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import DefaultPrepareStackTrace from "./DefaultPrepareStackTrace.js";

// @beginner: 定义 ErrorConstructorWithPrepareStackTrace：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ErrorConstructorWithPrepareStackTrace = ErrorConstructor & {
  prepareStackTrace?: typeof DefaultPrepareStackTrace;
};

/**
 * 把 JSX 创建时保存下来的 Error stack 裁剪成 owner stack。
 *
 * 官方 JSX runtime 会在开发态把 `react-stack-top-frame` 和
 * `react_stack_bottom_frame` 两个哨兵帧塞进调用栈。这里按同样规则：
 * 1. 去掉 Error 消息和 JSX runtime 顶部帧；
 * 2. 找到底部 React 内部哨兵；
 * 3. 只保留用户 owner 调用链。
 */
// @beginner: 进入 formatOwnerStack：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function formatOwnerStack(error: Error): string {
  // @beginner: 声明 ErrorWithPrepareStackTrace：保存当前步骤需要读取或更新的数据。
  const ErrorWithPrepareStackTrace = Error as ErrorConstructorWithPrepareStackTrace;
  // @beginner: 声明 prevPrepareStackTrace：保存当前步骤需要读取或更新的数据。
  const prevPrepareStackTrace = ErrorWithPrepareStackTrace.prepareStackTrace;
  ErrorWithPrepareStackTrace.prepareStackTrace = DefaultPrepareStackTrace;

  // @beginner: 声明 stack：保存当前步骤需要读取或更新的数据。
  let stack = error.stack ?? "";
  ErrorWithPrepareStackTrace.prepareStackTrace = prevPrepareStackTrace;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (stack.startsWith("Error: react-stack-top-frame\n")) {
    stack = stack.slice(29);
  }

  // @beginner: 声明 idx：保存当前步骤需要读取或更新的数据。
  let idx = stack.indexOf("\n");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (idx !== -1) {
    stack = stack.slice(idx + 1);
  }

  idx = stack.indexOf("react_stack_bottom_frame");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (idx !== -1) {
    idx = stack.lastIndexOf("\n", idx);
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (idx !== -1) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return stack.slice(0, idx);
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return "";
}
