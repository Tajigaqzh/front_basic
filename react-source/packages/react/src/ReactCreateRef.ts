export interface RefObject<T> {
  current: T | null;
}

export function createRef<T = unknown>(): RefObject<T> {
  // 官方实现返回一个只有 current 字段的密封对象；这里保留核心形态。
  return { current: null };
}
