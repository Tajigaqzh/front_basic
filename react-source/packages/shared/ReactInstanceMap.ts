const internalInstanceKey = "__reactFiber$frontSource";

export function get<T>(key: unknown): T | undefined {
  return (key as Record<string, T | undefined>)[internalInstanceKey];
}

export function set<T>(key: unknown, value: T): void {
  // 官方 React 用 ReactInstanceMap 把 public class instance 映射回内部 Fiber。
  // setState 发生在实例上，调度更新时必须通过这个映射找到对应 fiber。
  (key as Record<string, T>)[internalInstanceKey] = value;
}
