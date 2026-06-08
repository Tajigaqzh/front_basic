const supportedInputTypes: Record<string, true> = {
  color: true,
  date: true,
  datetime: true,
  "datetime-local": true,
  email: true,
  month: true,
  number: true,
  password: true,
  range: true,
  search: true,
  tel: true,
  text: true,
  time: true,
  url: true,
  week: true,
};

export default function isTextInputElement(elem: unknown): boolean {
  const node = elem as { nodeName?: string; type?: string } | null;
  if (node === null || node.nodeName === undefined) {
    return false;
  }

  const nodeName = node.nodeName.toLowerCase();
  if (nodeName === "input") {
    return node.type !== undefined && supportedInputTypes[node.type] === true;
  }

  return nodeName === "textarea";
}
