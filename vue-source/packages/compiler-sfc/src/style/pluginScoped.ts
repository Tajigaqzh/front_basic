export function applyScopedStyle(code: string, id: string): string {
  const shortId = id.replace(/^data-v-/, '')
  return `/* scoped:${shortId} */\n${code}`
}
