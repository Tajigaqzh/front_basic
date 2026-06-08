import { getOffsets, setOffsets, type SelectionInformation } from "./ReactDOMSelection.js";

function hasSelectionCapabilities(elem: Element | null): elem is HTMLInputElement | HTMLTextAreaElement {
  return (
    elem instanceof HTMLInputElement ||
    elem instanceof HTMLTextAreaElement ||
    (elem instanceof HTMLElement && elem.contentEditable === "true")
  );
}

export function getSelectionInformation(containerInfo: Document | Element): SelectionInformation {
  const doc = "nodeType" in containerInfo && containerInfo.nodeType === 9 ? (containerInfo as Document) : containerInfo.ownerDocument;
  const focusedElem = doc?.activeElement ?? null;
  return {
    focusedElem,
    selectionRange: hasSelectionCapabilities(focusedElem) ? getOffsets(focusedElem) : null,
  };
}

export function restoreSelection(priorSelectionInformation: SelectionInformation): void {
  const { focusedElem, selectionRange } = priorSelectionInformation;
  if (selectionRange !== null && hasSelectionCapabilities(focusedElem)) {
    setOffsets(focusedElem, selectionRange);
  }
}
