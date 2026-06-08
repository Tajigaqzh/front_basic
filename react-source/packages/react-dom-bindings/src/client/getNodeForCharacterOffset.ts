export function getNodeForCharacterOffset(
  root: Node,
  offset: number,
): { node: Text; offset: number } | null {
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT) ??
    document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node = walker.nextNode() as Text | null;

  while (node !== null) {
    const nextOffset = currentOffset + node.data.length;
    if (offset <= nextOffset) {
      return { node, offset: offset - currentOffset };
    }
    currentOffset = nextOffset;
    node = walker.nextNode() as Text | null;
  }

  return null;
}
