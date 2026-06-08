/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 rootMutationContext：保存当前步骤需要读取或更新的数据。
export let rootMutationContext = false;
// @beginner: 声明 viewTransitionMutationContext：保存当前步骤需要读取或更新的数据。
export let viewTransitionMutationContext = false;

// @beginner: 进入 pushRootMutationContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushRootMutationContext(): void {
  rootMutationContext = false;
  viewTransitionMutationContext = false;
}

// @beginner: 进入 pushMutationContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function pushMutationContext(): boolean {
  // @beginner: 声明 previous：保存当前步骤需要读取或更新的数据。
  const previous = viewTransitionMutationContext;
  viewTransitionMutationContext = false;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return previous;
}

// @beginner: 进入 popMutationContext：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function popMutationContext(previous: boolean): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (viewTransitionMutationContext) {
    rootMutationContext = true;
  }
  viewTransitionMutationContext = previous;
}

// @beginner: 进入 trackHostMutation：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function trackHostMutation(): void {
  viewTransitionMutationContext = true;
  rootMutationContext = true;
}
