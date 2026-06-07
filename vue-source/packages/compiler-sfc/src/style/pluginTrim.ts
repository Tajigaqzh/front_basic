export function trimStyleCode(source: string): string {
  return source
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim()
}
