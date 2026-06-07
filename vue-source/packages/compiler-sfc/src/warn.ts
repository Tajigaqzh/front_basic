const hasWarned: Record<string, boolean> = {}

export function warnOnce(msg: string): void {
  const isNodeProd =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process !==
      'undefined' &&
    (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV === 'production'
  if (!isNodeProd && !__TEST__ && !hasWarned[msg]) {
    hasWarned[msg] = true
    warn(msg)
  }
}

export function warn(msg: string): void {
  console.warn(
    `\x1b[1m\x1b[33m[@vue-source/compiler-sfc]\x1b[0m\x1b[33m ${msg}\x1b[0m\n`,
  )
}
