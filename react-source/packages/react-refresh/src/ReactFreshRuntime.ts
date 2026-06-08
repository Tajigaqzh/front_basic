type ComponentType = (...args: unknown[]) => unknown;

const allFamiliesByType = new WeakMap<ComponentType, string>();

export function register(type: ComponentType, id: string): void {
  allFamiliesByType.set(type, id);
}

export function createSignatureFunctionForTransform() {
  return function signature<T>(type: T): T {
    return type;
  };
}

export function isLikelyComponentType(type: unknown): boolean {
  return typeof type === "function" && /^[A-Z]/.test(type.name);
}

export function performReactRefresh(): void {
  // 完整 react-refresh 会和 renderer 注入的 scheduleRefresh 联动。
  // 当前保留运行时同名 API，后续接入 Fiber root 刷新时再扩展。
}
