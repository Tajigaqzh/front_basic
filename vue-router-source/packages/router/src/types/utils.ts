/**
 * Creates a union type that still allows autocompletion for strings.
 * @internal
 */
// 典型用途：在允许任意 string 的同时，优先提示一组已知字面量。
export type _LiteralUnion<LiteralType, BaseType extends string = string> =
  | LiteralType
  | (BaseType & Record<never, never>)

export type IsNull<T> =
  // avoid distributive conditional types
  [T] extends [null] ? true : false

// 用于在复杂泛型推导里区分 unknown / any / 具体类型。
export type IsUnknown<T> = unknown extends T // `T` can be `unknown` or `any`
  ? IsNull<T> extends false // `any` can be `null`, but `unknown` can't be
    ? true
    : false
  : false

/**
 * Maybe a promise maybe not
 * @internal
 */
export type _Awaitable<T> = T | PromiseLike<T>

/**
 * @internal
 */
// 强制把交叉类型重新“拍平”，提升 IDE 展示可读性。
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * @internal
 */
export type _AlphaNumeric =
  | 'a'
  | 'A'
  | 'b'
  | 'B'
  | 'c'
  | 'C'
  | 'd'
  | 'D'
  | 'e'
  | 'E'
  | 'f'
  | 'F'
  | 'g'
  | 'G'
  | 'h'
  | 'H'
  | 'i'
  | 'I'
  | 'j'
  | 'J'
  | 'k'
  | 'K'
  | 'l'
  | 'L'
  | 'm'
  | 'M'
  | 'n'
  | 'N'
  | 'o'
  | 'O'
  | 'p'
  | 'P'
  | 'q'
  | 'Q'
  | 'r'
  | 'R'
  | 's'
  | 'S'
  | 't'
  | 'T'
  | 'u'
  | 'U'
  | 'v'
  | 'V'
  | 'w'
  | 'W'
  | 'x'
  | 'X'
  | 'y'
  | 'Y'
  | 'z'
  | 'Z'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '_'

export type Awaitable<T> = T | Promise<T>
// 对外版 Awaitable，和 _Awaitable 含义相近，但命名上用于更公开的类型场景。
