export function warn(msg: string, ..._args: any[]): void
export function warn(msg: string): void {
  // 单独收口 warning 输出，便于统一前缀、兼容旧环境，也方便后续替换策略。
  // avoid using ...args as it breaks in older Edge builds
  const args = Array.from(arguments).slice(1)
  console.warn.apply(
    console,
    ['[Vue Router warn]: ' + msg].concat(args) as [string, ...any[]]
  )
}
