/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 LinkStyleResourceProps：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type LinkStyleResourceProps = {
  href?: unknown;
  onLoad?: unknown;
  onError?: unknown;
  disabled?: unknown;
};

// @beginner: 进入 propNamesListJoin：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function propNamesListJoin(list: string[], combinator: "and" | "or"): string {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (list.length) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case 0:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "";
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case 1:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return list[0];
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case 2:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `${list[0]} ${combinator} ${list[1]}`;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `${list.slice(0, -1).join(", ")}, ${combinator} ${list[list.length - 1]}`;
  }
}

// @beginner: 进入 validateLinkPropsForStyleResource：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function validateLinkPropsForStyleResource(props: LinkStyleResourceProps): boolean {
  // @beginner: 声明 变量：保存当前步骤需要读取或更新的数据。
  const { href, onLoad, onError, disabled } = props;
  // @beginner: 声明 includedProps：保存当前步骤需要读取或更新的数据。
  const includedProps: string[] = [];
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (onLoad) includedProps.push("`onLoad`");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (onError) includedProps.push("`onError`");
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disabled != null) includedProps.push("`disabled`");

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (includedProps.length === 0) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 includedPropsPhrase：保存当前步骤需要读取或更新的数据。
  let includedPropsPhrase = propNamesListJoin(includedProps, "and");
  includedPropsPhrase += includedProps.length === 1 ? " prop" : " props";
  // @beginner: 声明 withArticlePhrase：保存当前步骤需要读取或更新的数据。
  const withArticlePhrase =
    includedProps.length === 1 ? `an ${includedPropsPhrase}` : `the ${includedPropsPhrase}`;

  console.error(
    "React encountered a <link rel=\"stylesheet\" href=\"%s\" ... /> with a `precedence` prop that also included %s. React will not hoist or deduplicate this stylesheet. Remove %s or remove `precedence`.",
    href,
    withArticlePhrase,
    includedPropsPhrase,
  );
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 getValueDescriptorExpectingObjectForWarning：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getValueDescriptorExpectingObjectForWarning(thing: unknown): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return thing === null
    ? "`null`"
    : thing === undefined
      ? "`undefined`"
      : thing === ""
        ? "an empty string"
        : `something with type "${typeof thing}"`;
}

// @beginner: 进入 getValueDescriptorExpectingEnumForWarning：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getValueDescriptorExpectingEnumForWarning(thing: unknown): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return thing === null
    ? "`null`"
    : thing === undefined
      ? "`undefined`"
      : thing === ""
        ? "an empty string"
        : typeof thing === "string"
          ? JSON.stringify(thing)
          : `something with type "${typeof thing}"`;
}
