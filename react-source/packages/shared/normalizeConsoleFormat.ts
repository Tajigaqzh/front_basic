/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
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
  // @beginner: 声明 j：保存当前步骤需要读取或更新的数据。
  let j = firstArg;
  // @beginner: 声明 normalizedString：保存当前步骤需要读取或更新的数据。
  let normalizedString = "";
  // @beginner: 声明 last：保存当前步骤需要读取或更新的数据。
  let last = 0;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (let i = 0; i < formatString.length - 1; i += 1) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (formatString.charCodeAt(i) !== 37) {
      continue;
    }

    // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
    switch (formatString.charCodeAt((i += 1))) {
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case 79:
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case 99:
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case 100:
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case 102:
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case 105:
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case 111:
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case 115:
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (j < args.length) {
          j += 1;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          normalizedString += `${formatString.slice(last, (last = i))}%`;
        }
        break;
    }
  }

  normalizedString += formatString.slice(last);

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  while (j < args.length) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (normalizedString !== "") {
      normalizedString += " ";
    }
    normalizedString += typeof args[j] === "string" ? "%s" : "%o";
    j += 1;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return normalizedString;
}
