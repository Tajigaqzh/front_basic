// 如果类型 T 可以接受 `any`，则输出类型 Y；否则输出类型 N。
// 参考：https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
/**
 * 类型约束 `0 extends 1` 本身不成立（因为 `0` 不能赋值给 `1`），
 * 所以按理说 `0 extends (1 & T)` 也不应该成立，
 * 因为 `(1 & T)` 理应比 `1` 更窄。
 *
 * 但当 `T` 是 `any` 时，它会被化简成 `0 extends (1 & any)`，
 * 也就是 `0 extends any`，这个条件是成立的。
 *
 * 这是因为 `any` 在 TypeScript 中是刻意设计成不完全类型安全的：
 * 它在绝大多数情况下既可以充当超类型，也可以充当子类型。
 *
 * 因此，`IfAny<T, Y, N>` 可以用来判断 `T` 是否为 `any`。
 * 如果是，就返回 `Y`；如果不是，就返回 `N`。下面来看它的实际效果：
 */
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N
