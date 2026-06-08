/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 ComponentType：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ComponentType = (...args: unknown[]) => unknown;

// @beginner: 声明 allFamiliesByType：保存当前步骤需要读取或更新的数据。
const allFamiliesByType = new WeakMap<ComponentType, string>();

// @beginner: 进入 register：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function register(type: ComponentType, id: string): void {
  allFamiliesByType.set(type, id);
}

// @beginner: 进入 createSignatureFunctionForTransform：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createSignatureFunctionForTransform() {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return function signature<T>(type: T): T {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return type;
  };
}

// @beginner: 进入 isLikelyComponentType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isLikelyComponentType(type: unknown): boolean {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof type === "function" && /^[A-Z]/.test(type.name);
}

// @beginner: 进入 performReactRefresh：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function performReactRefresh(): void {
  // 完整 react-refresh 会和 renderer 注入的 scheduleRefresh 联动。
  // 当前保留运行时同名 API，后续接入 Fiber root 刷新时再扩展。
}
