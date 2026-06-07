/**
 * Maybe a promise maybe not
 * @internal
 */
// unplugin 侧自己的 Awaitable 小工具，避免依赖 runtime types。
export type _Awaitable<T> = T | PromiseLike<T>

/**
 * Creates a union type that still allows autocompletion for strings.
 *@internal
 */
// 与 runtime 的 _LiteralUnion 用途相同：开放 string，同时保留字面量提示。
export type LiteralStringUnion<LiteralType, BaseType extends string = string> =
  | LiteralType
  | (BaseType & Record<never, never>)

// for highlighting
// 生成代码时用 String.raw 保持模板字符串中的缩进和反斜杠更可控。
export const ts = String.raw

/**
 * Pads a single-line string with spaces.
 *
 * @internal
 *
 * @param spaces The number of spaces to pad with.
 * @param str The string to pad, none if omitted.
 * @returns The padded string.
 */
export function pad(spaces: number, str = ''): string {
  return ' '.repeat(spaces) + str
}

/**
 * Formats an array of union items as a multiline union type.
 *
 * @internal
 *
 * @param items The items to format.
 * @param spaces The number of spaces to indent each line.
 * @returns The formatted multiline union type.
 */
export function formatMultilineUnion(items: string[], spaces: number): string {
  // 统一把 'a' | 'b' | 'c' 这种 union 格式化成多行声明，利于生成物可读性。
  return (items.length ? items : ['never'])
    .map(s => `| ${s}`)
    .join(`\n${pad(spaces)}`)
}

/**
 * Converts a string value to a string literal, escaping as necessary.
 *
 * @internal
 *
 * @param str the string to convert to a string type
 * @returns The string wrapped in single quotes and escaped.
 * @example
 * toStringLiteral('hello') // returns "'hello'"
 * toStringLiteral("it's fine") // returns "'it\'s fine'"
 */
export function toStringLiteral(str: string): string {
  // 把任意字符串安全转成 TS/JS 代码里的单引号字面量。
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
