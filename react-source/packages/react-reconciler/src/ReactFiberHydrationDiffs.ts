/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HostText } from "./ReactWorkTags.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

// @beginner: 定义 ServerProps：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ServerProps =
  | undefined
  | null
  | string
  | Readonly<Record<string, unknown>>;

// @beginner: 定义 HydrationDiffNode：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface HydrationDiffNode {
  fiber: Fiber;
  children: HydrationDiffNode[];
  serverProps: ServerProps;
  serverTail: Array<string | { type: string; props: Readonly<Record<string, unknown>> }>;
  distanceFromLeaf: number;
}

// @beginner: 声明 maxRowLength：保存当前步骤需要读取或更新的数据。
const maxRowLength = 120;
// @beginner: 声明 idealDepth：保存当前步骤需要读取或更新的数据。
const idealDepth = 15;

// @beginner: 进入 findNotableNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function findNotableNode(node: HydrationDiffNode, indent: number): HydrationDiffNode {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (
    node.serverProps === undefined &&
    node.serverTail.length === 0 &&
    node.children.length === 1 &&
    node.distanceFromLeaf > 3 &&
    node.distanceFromLeaf > idealDepth - indent
  ) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return findNotableNode(node.children[0], indent);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return node;
}

// @beginner: 进入 indentation：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function indentation(indent: number): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return "  " + "  ".repeat(indent);
}

// @beginner: 进入 added：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function added(indent: number): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return "+ " + "  ".repeat(indent);
}

// @beginner: 进入 removed：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function removed(indent: number): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return "- " + "  ".repeat(indent);
}

// @beginner: 声明 needsEscaping：保存当前步骤需要读取或更新的数据。
const needsEscaping = /["'&<>\n\t]|^\s|\s$/;

// @beginner: 进入 describeTextNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeTextNode(content: string, maxLength: number): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (needsEscaping.test(content)) {
    // @beginner: 声明 encoded：保存当前步骤需要读取或更新的数据。
    const encoded = JSON.stringify(content);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return encoded.length > maxLength - 2 ? `{${encoded.slice(0, Math.max(0, maxLength - 7))}..."}` : `{${encoded}}`;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return content.length > maxLength ? `${content.slice(0, Math.max(0, maxLength - 3))}...` : content;
}

// @beginner: 进入 describeValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeValue(value: unknown, maxLength: number): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof value === "string") {
    // @beginner: 声明 encoded：保存当前步骤需要读取或更新的数据。
    const encoded = JSON.stringify(value);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return encoded.length > maxLength ? `${encoded.slice(0, Math.max(0, maxLength - 4))}..."` : encoded;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (value === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "null";
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (Array.isArray(value)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "[...]";
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof value === "function") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return value.name ? `function ${value.name}` : "function";
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof value === "object") {
    // @beginner: 声明 object：保存当前步骤需要读取或更新的数据。
    const object = value as Record<string, unknown>;
    // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
    const props = Object.keys(object)
      .slice(0, 3)
      .map((key) => `${key}:${describeValue(object[key], 15)}`)
      .join(",");
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return `{${props}${Object.keys(object).length > 3 ? ", ..." : ""}}`;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return String(value);
}

// @beginner: 进入 describePropValue：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describePropValue(value: unknown, maxLength: number): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof value === "string" && !needsEscaping.test(value)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return value.length > maxLength - 2 ? `"${value.slice(0, Math.max(0, maxLength - 5))}..."` : `"${value}"`;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return `{${describeValue(value, maxLength - 2)}}`;
}

// @beginner: 进入 describeFiberType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeFiberType(fiber: Fiber): string | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return getComponentNameFromFiber(fiber);
}

// @beginner: 进入 describeElement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeElement(type: string, props: Readonly<Record<string, unknown>>, prefix: string): string {
  // @beginner: 声明 propText：保存当前步骤需要读取或更新的数据。
  const propText = Object.keys(props)
    .filter((key) => key !== "children")
    .map((key) => `${key}=${describePropValue(props[key], 40)}`)
    .join(" ");
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return `${prefix}<${type}${propText === "" ? "" : ` ${propText}`}>\n`;
}

// @beginner: 进入 describeTextDiff：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeTextDiff(clientText: string, serverProps: ServerProps, indent: number): string {
  // @beginner: 声明 maxLength：保存当前步骤需要读取或更新的数据。
  const maxLength = maxRowLength - indent * 2;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (serverProps === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return added(indent) + describeTextNode(clientText, maxLength) + "\n";
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof serverProps === "string") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return (
      added(indent) +
      describeTextNode(clientText, maxLength) +
      "\n" +
      removed(indent) +
      describeTextNode(serverProps, maxLength) +
      "\n"
    );
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return indentation(indent) + describeTextNode(clientText, maxLength) + "\n";
}

// @beginner: 进入 describeNode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeNode(node: HydrationDiffNode, indent: number): string {
  // @beginner: 声明 notableNode：保存当前步骤需要读取或更新的数据。
  const notableNode = findNotableNode(node, indent);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (notableNode !== node) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return indentation(indent) + "...\n" + describeNode(notableNode, indent + 1);
  }

  // @beginner: 声明 content：保存当前步骤需要读取或更新的数据。
  let content = "";
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (node.fiber.tag === HostText) {
    // @beginner: 声明 text：保存当前步骤需要读取或更新的数据。
    const text = String((node.fiber.pendingProps as { text?: unknown }).text ?? node.fiber.pendingProps ?? "");
    content += describeTextDiff(text, node.serverProps, indent);
    indent += 1;
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // @beginner: 声明 type：保存当前步骤需要读取或更新的数据。
    const type = describeFiberType(node.fiber);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (type !== null) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (node.serverProps === null) {
        content += describeElement(type, node.fiber.pendingProps, added(indent));
      // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
      } else if (node.serverProps === undefined || typeof node.serverProps === "string") {
        content += describeElement(type, node.fiber.pendingProps, indentation(indent));
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        content += describeElement(type, node.fiber.pendingProps, indentation(indent));
        // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
        for (const key of Object.keys(node.serverProps)) {
          // @beginner: 声明 clientValue：保存当前步骤需要读取或更新的数据。
          const clientValue = node.fiber.pendingProps[key];
          // @beginner: 声明 serverValue：保存当前步骤需要读取或更新的数据。
          const serverValue = node.serverProps[key];
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (!Object.is(clientValue, serverValue)) {
            content += `${added(indent + 1)}${key}=${describePropValue(clientValue, 40)}\n`;
            content += `${removed(indent + 1)}${key}=${describePropValue(serverValue, 40)}\n`;
          }
        }
      }
      indent += 1;
    }
  }

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const child of node.children) {
    content += describeNode(child, indent);
  }
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const tailNode of node.serverTail) {
    content +=
      typeof tailNode === "string"
        ? removed(indent) + describeTextNode(tailNode, maxRowLength - indent * 2) + "\n"
        : describeElement(tailNode.type, tailNode.props, removed(indent));
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return content;
}

// @beginner: 进入 describeDiff：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeDiff(rootNode: HydrationDiffNode): string {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "\n\n" + describeNode(rootNode, 0);
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "";
  }
}
