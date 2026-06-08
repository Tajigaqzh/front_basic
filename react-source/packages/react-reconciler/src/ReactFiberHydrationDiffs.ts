import type { Fiber } from "./ReactInternalTypes.js";
import { HostText } from "./ReactWorkTags.js";
import getComponentNameFromFiber from "./getComponentNameFromFiber.js";

export type ServerProps =
  | undefined
  | null
  | string
  | Readonly<Record<string, unknown>>;

export interface HydrationDiffNode {
  fiber: Fiber;
  children: HydrationDiffNode[];
  serverProps: ServerProps;
  serverTail: Array<string | { type: string; props: Readonly<Record<string, unknown>> }>;
  distanceFromLeaf: number;
}

const maxRowLength = 120;
const idealDepth = 15;

function findNotableNode(node: HydrationDiffNode, indent: number): HydrationDiffNode {
  if (
    node.serverProps === undefined &&
    node.serverTail.length === 0 &&
    node.children.length === 1 &&
    node.distanceFromLeaf > 3 &&
    node.distanceFromLeaf > idealDepth - indent
  ) {
    return findNotableNode(node.children[0], indent);
  }
  return node;
}

function indentation(indent: number): string {
  return "  " + "  ".repeat(indent);
}

function added(indent: number): string {
  return "+ " + "  ".repeat(indent);
}

function removed(indent: number): string {
  return "- " + "  ".repeat(indent);
}

const needsEscaping = /["'&<>\n\t]|^\s|\s$/;

function describeTextNode(content: string, maxLength: number): string {
  if (needsEscaping.test(content)) {
    const encoded = JSON.stringify(content);
    return encoded.length > maxLength - 2 ? `{${encoded.slice(0, Math.max(0, maxLength - 7))}..."}` : `{${encoded}}`;
  }
  return content.length > maxLength ? `${content.slice(0, Math.max(0, maxLength - 3))}...` : content;
}

function describeValue(value: unknown, maxLength: number): string {
  if (typeof value === "string") {
    const encoded = JSON.stringify(value);
    return encoded.length > maxLength ? `${encoded.slice(0, Math.max(0, maxLength - 4))}..."` : encoded;
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "[...]";
  }
  if (typeof value === "function") {
    return value.name ? `function ${value.name}` : "function";
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const props = Object.keys(object)
      .slice(0, 3)
      .map((key) => `${key}:${describeValue(object[key], 15)}`)
      .join(",");
    return `{${props}${Object.keys(object).length > 3 ? ", ..." : ""}}`;
  }
  return String(value);
}

function describePropValue(value: unknown, maxLength: number): string {
  if (typeof value === "string" && !needsEscaping.test(value)) {
    return value.length > maxLength - 2 ? `"${value.slice(0, Math.max(0, maxLength - 5))}..."` : `"${value}"`;
  }
  return `{${describeValue(value, maxLength - 2)}}`;
}

function describeFiberType(fiber: Fiber): string | null {
  return getComponentNameFromFiber(fiber);
}

function describeElement(type: string, props: Readonly<Record<string, unknown>>, prefix: string): string {
  const propText = Object.keys(props)
    .filter((key) => key !== "children")
    .map((key) => `${key}=${describePropValue(props[key], 40)}`)
    .join(" ");
  return `${prefix}<${type}${propText === "" ? "" : ` ${propText}`}>\n`;
}

function describeTextDiff(clientText: string, serverProps: ServerProps, indent: number): string {
  const maxLength = maxRowLength - indent * 2;
  if (serverProps === null) {
    return added(indent) + describeTextNode(clientText, maxLength) + "\n";
  }
  if (typeof serverProps === "string") {
    return (
      added(indent) +
      describeTextNode(clientText, maxLength) +
      "\n" +
      removed(indent) +
      describeTextNode(serverProps, maxLength) +
      "\n"
    );
  }
  return indentation(indent) + describeTextNode(clientText, maxLength) + "\n";
}

function describeNode(node: HydrationDiffNode, indent: number): string {
  const notableNode = findNotableNode(node, indent);
  if (notableNode !== node) {
    return indentation(indent) + "...\n" + describeNode(notableNode, indent + 1);
  }

  let content = "";
  if (node.fiber.tag === HostText) {
    const text = String((node.fiber.pendingProps as { text?: unknown }).text ?? node.fiber.pendingProps ?? "");
    content += describeTextDiff(text, node.serverProps, indent);
    indent += 1;
  } else {
    const type = describeFiberType(node.fiber);
    if (type !== null) {
      if (node.serverProps === null) {
        content += describeElement(type, node.fiber.pendingProps, added(indent));
      } else if (node.serverProps === undefined || typeof node.serverProps === "string") {
        content += describeElement(type, node.fiber.pendingProps, indentation(indent));
      } else {
        content += describeElement(type, node.fiber.pendingProps, indentation(indent));
        for (const key of Object.keys(node.serverProps)) {
          const clientValue = node.fiber.pendingProps[key];
          const serverValue = node.serverProps[key];
          if (!Object.is(clientValue, serverValue)) {
            content += `${added(indent + 1)}${key}=${describePropValue(clientValue, 40)}\n`;
            content += `${removed(indent + 1)}${key}=${describePropValue(serverValue, 40)}\n`;
          }
        }
      }
      indent += 1;
    }
  }

  for (const child of node.children) {
    content += describeNode(child, indent);
  }
  for (const tailNode of node.serverTail) {
    content +=
      typeof tailNode === "string"
        ? removed(indent) + describeTextNode(tailNode, maxRowLength - indent * 2) + "\n"
        : describeElement(tailNode.type, tailNode.props, removed(indent));
  }
  return content;
}

export function describeDiff(rootNode: HydrationDiffNode): string {
  try {
    return "\n\n" + describeNode(rootNode, 0);
  } catch {
    return "";
  }
}
