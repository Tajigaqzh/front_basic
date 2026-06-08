export default function isCustomElement(tagName: string, props: Record<string, unknown> | null): boolean {
  if (tagName.indexOf("-") === -1) {
    return false;
  }

  if (props !== null && props.is != null) {
    return true;
  }

  // 官方会排除 SVG/MathML 中少量带横线的保留标签。
  return true;
}
