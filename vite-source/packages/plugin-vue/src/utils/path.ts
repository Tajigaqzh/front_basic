import path from 'node:path'

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

export function pathToUrl(root: string, file: string): string {
  const relative = normalizePath(path.relative(root, file))
  return relative.startsWith('.') ? `/${relative}` : `/${relative}`
}
