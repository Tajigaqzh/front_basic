export function isRelativeUrl(url: string): boolean {
  const first = url.charAt(0)
  return first === '.' || first === '~' || first === '@' || first === '#'
}

export function isExternalUrl(url: string): boolean {
  return /^(?:https?:)?\/\//.test(url)
}

export function isDataUrl(url: string): boolean {
  return /^\s*data:/i.test(url)
}
