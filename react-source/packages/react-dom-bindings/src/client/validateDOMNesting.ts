const specialTags = new Set(["address", "article", "aside", "blockquote", "center", "details", "dialog", "dir", "div", "dl", "fieldset", "figcaption", "figure", "footer", "header", "hgroup", "main", "menu", "nav", "ol", "p", "section", "summary", "ul"]);

export interface AncestorInfoDev {
  current: string | null;
  pTagInButtonScope: string | null;
}

export function updatedAncestorInfoDev(oldInfo: AncestorInfoDev | null, tag: string): AncestorInfoDev {
  const info: AncestorInfoDev = {
    current: tag,
    pTagInButtonScope: oldInfo?.pTagInButtonScope ?? null,
  };
  if (tag === "p") {
    info.pTagInButtonScope = tag;
  } else if (specialTags.has(tag)) {
    info.pTagInButtonScope = null;
  }
  return info;
}

export function validateDOMNesting(childTag: string, ancestorInfo: AncestorInfoDev | null): boolean {
  if (childTag === "tr" && ancestorInfo?.current === "table") {
    return false;
  }
  if (ancestorInfo?.pTagInButtonScope && specialTags.has(childTag)) {
    return false;
  }
  return true;
}
