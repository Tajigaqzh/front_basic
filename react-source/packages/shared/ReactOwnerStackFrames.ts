import DefaultPrepareStackTrace from "./DefaultPrepareStackTrace.js";

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
export function formatOwnerStack(error: Error): string {
  const ErrorWithPrepareStackTrace = Error as ErrorConstructorWithPrepareStackTrace;
  const prevPrepareStackTrace = ErrorWithPrepareStackTrace.prepareStackTrace;
  ErrorWithPrepareStackTrace.prepareStackTrace = DefaultPrepareStackTrace;

  let stack = error.stack ?? "";
  ErrorWithPrepareStackTrace.prepareStackTrace = prevPrepareStackTrace;

  if (stack.startsWith("Error: react-stack-top-frame\n")) {
    stack = stack.slice(29);
  }

  let idx = stack.indexOf("\n");
  if (idx !== -1) {
    stack = stack.slice(idx + 1);
  }

  idx = stack.indexOf("react_stack_bottom_frame");
  if (idx !== -1) {
    idx = stack.lastIndexOf("\n", idx);
  }

  if (idx !== -1) {
    return stack.slice(0, idx);
  }

  return "";
}
