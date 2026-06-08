const aliases = new Map<string, string>([
  ["acceptCharset", "accept-charset"],
  ["className", "class"],
  ["htmlFor", "for"],
  ["httpEquiv", "http-equiv"],
  ["crossOrigin", "crossorigin"],
]);

export default function getAttributeAlias(name: string): string {
  return aliases.get(name) ?? name;
}
