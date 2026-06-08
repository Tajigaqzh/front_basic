/**
 * 规范化 console format string，让占位符数量与参数数量对齐。
 *
 * React 在转发 console 日志前可能会 prepend/append 信息；如果原 format 的 `%s/%o`
 * 数量与参数不匹配，追加信息可能被错误消费。这个函数会转义多余占位符，并为剩余
 * 参数补上 Chrome DevTools 风格的 `%s`/`%o`。
 */
export default function normalizeConsoleFormat(
  formatString: string,
  args: readonly unknown[],
  firstArg: number,
): string {
  let j = firstArg;
  let normalizedString = "";
  let last = 0;

  for (let i = 0; i < formatString.length - 1; i += 1) {
    if (formatString.charCodeAt(i) !== 37) {
      continue;
    }

    switch (formatString.charCodeAt((i += 1))) {
      case 79:
      case 99:
      case 100:
      case 102:
      case 105:
      case 111:
      case 115:
        if (j < args.length) {
          j += 1;
        } else {
          normalizedString += `${formatString.slice(last, (last = i))}%`;
        }
        break;
    }
  }

  normalizedString += formatString.slice(last);

  while (j < args.length) {
    if (normalizedString !== "") {
      normalizedString += " ";
    }
    normalizedString += typeof args[j] === "string" ? "%s" : "%o";
    j += 1;
  }

  return normalizedString;
}
