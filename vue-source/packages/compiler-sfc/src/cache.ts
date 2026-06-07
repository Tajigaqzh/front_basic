export function createCache<T>(): Map<string, T> {
  return new Map<string, T>()
}
