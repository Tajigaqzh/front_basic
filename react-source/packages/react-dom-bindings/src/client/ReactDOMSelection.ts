export interface SelectionInformation {
  focusedElem: Element | null;
  selectionRange: { start: number; end: number } | null;
}

export function getOffsets(node: HTMLInputElement | HTMLTextAreaElement): { start: number; end: number } {
  return {
    start: node.selectionStart ?? 0,
    end: node.selectionEnd ?? 0,
  };
}

export function setOffsets(
  node: HTMLInputElement | HTMLTextAreaElement,
  offsets: { start: number; end: number },
): void {
  node.setSelectionRange(offsets.start, offsets.end);
}
