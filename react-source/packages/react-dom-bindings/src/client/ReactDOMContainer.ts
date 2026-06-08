import { COMMENT_NODE, DOCUMENT_NODE, DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE } from "./HTMLNodeType.js";

export function isValidContainer(node: unknown): node is Element | Document | DocumentFragment | Comment {
  if (node === null || typeof node !== "object") {
    return false;
  }
  const nodeType = (node as { nodeType?: number }).nodeType;
  return (
    nodeType === ELEMENT_NODE ||
    nodeType === DOCUMENT_NODE ||
    nodeType === DOCUMENT_FRAGMENT_NODE ||
    nodeType === COMMENT_NODE
  );
}
