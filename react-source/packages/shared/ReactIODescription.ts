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

function readNestedUrl(value: unknown): string | null {
  if (value !== null && typeof value === "object") {
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

/**
 * 为性能/调试里的异步 I/O 记录提取短描述。
 *
 * 官方只取足够稳定、可读的标识符：函数名、URL、src、command、id/name 等。
 * 太短、太长或 `[object X]` 形式的字符串会被过滤掉，避免污染性能轨道。
 */
export function getIODescription(value: unknown): string {
  try {
    switch (typeof value) {
      case "function":
        return value.name || "";
      case "object": {
        if (value === null) {
          return "";
        }
        if (value instanceof Error) {
          return String(value.message);
        }

        const object = value as DescribableObject;
        if (typeof object.url === "string") {
          return object.url;
        }
        if (typeof object.href === "string") {
          return object.href;
        }
        if (typeof object.src === "string") {
          return object.src;
        }
        if (typeof object.currentSrc === "string") {
          return object.currentSrc;
        }
        if (typeof object.command === "string") {
          return object.command;
        }

        const requestUrl = readNestedUrl(object.request);
        if (requestUrl !== null) {
          return requestUrl;
        }
        const responseUrl = readNestedUrl(object.response);
        if (responseUrl !== null) {
          return responseUrl;
        }

        if (
          typeof object.id === "string" ||
          typeof object.id === "number" ||
          typeof object.id === "bigint"
        ) {
          return String(object.id);
        }
        if (typeof object.name === "string") {
          return object.name;
        }

        const str = object.toString();
        if (str.startsWith("[object ") || str.length < 5 || str.length > 500) {
          return "";
        }
        return str;
      }
      case "string":
        return value.length < 5 || value.length > 500 ? "" : value;
      case "number":
      case "bigint":
        return String(value);
      default:
        return "";
    }
  } catch {
    return "";
  }
}
