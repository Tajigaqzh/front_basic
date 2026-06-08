/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 DescribableObject：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type DescribableObject = {
  url?: unknown;
  href?: unknown;
  src?: unknown;
  currentSrc?: unknown;
  command?: unknown;
  request?: unknown;
  response?: unknown;
  id?: unknown;
  name?: unknown;
  toString(): string;
};

// @beginner: 进入 readNestedUrl：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function readNestedUrl(value: unknown): string | null {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (value !== null && typeof value === "object") {
    // @beginner: 声明 url：保存当前步骤需要读取或更新的数据。
    const url = (value as { url?: unknown }).url;
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return typeof url === "string" ? url : null;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return null;
}

/**
 * 为性能/调试里的异步 I/O 记录提取短描述。
 *
 * 官方只取足够稳定、可读的标识符：函数名、URL、src、command、id/name 等。
 * 太短、太长或 `[object X]` 形式的字符串会被过滤掉，避免污染性能轨道。
 */
// @beginner: 进入 getIODescription：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getIODescription(value: unknown): string {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
    switch (typeof value) {
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case "function":
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return value.name || "";
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case "object": {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (value === null) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return "";
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (value instanceof Error) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return String(value.message);
        }

        // @beginner: 声明 object：保存当前步骤需要读取或更新的数据。
        const object = value as DescribableObject;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof object.url === "string") {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return object.url;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof object.href === "string") {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return object.href;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof object.src === "string") {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return object.src;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof object.currentSrc === "string") {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return object.currentSrc;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof object.command === "string") {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return object.command;
        }

        // @beginner: 声明 requestUrl：保存当前步骤需要读取或更新的数据。
        const requestUrl = readNestedUrl(object.request);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (requestUrl !== null) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return requestUrl;
        }
        // @beginner: 声明 responseUrl：保存当前步骤需要读取或更新的数据。
        const responseUrl = readNestedUrl(object.response);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (responseUrl !== null) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return responseUrl;
        }

        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (
          typeof object.id === "string" ||
          typeof object.id === "number" ||
          typeof object.id === "bigint"
        ) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return String(object.id);
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof object.name === "string") {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return object.name;
        }

        // @beginner: 声明 str：保存当前步骤需要读取或更新的数据。
        const str = object.toString();
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (str.startsWith("[object ") || str.length < 5 || str.length > 500) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return "";
        }
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return str;
      }
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case "string":
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return value.length < 5 || value.length > 500 ? "" : value;
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case "number":
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case "bigint":
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return String(value);
      // @beginner: 默认分支：没有命中前面任何 case 时使用。
      default:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return "";
    }
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "";
  }
}
