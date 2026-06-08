type CallSiteLike = {
  toString(): string;
};

/**
 * Node/V8 环境的 `Error.prepareStackTrace` fork。
 *
 * V8 会把结构化调用栈传给这个函数；React 在 owner stack 处理中临时安装它，
 * 目的是得到稳定的 `Error: message\n    at ...` 文本格式，便于后续裁剪内部帧。
 */
function prepareStackTrace(
  error: Error,
  structuredStackTrace: CallSiteLike[],
): string {
  const name = error.name || "Error";
  const message = error.message || "";
  let stack = `${name}: ${message}`;

  for (let i = 0; i < structuredStackTrace.length; i += 1) {
    stack += `\n    at ${structuredStackTrace[i].toString()}`;
  }

  return stack;
}

export default prepareStackTrace;
