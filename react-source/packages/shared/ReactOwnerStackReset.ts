/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "./ReactSharedInternals.js";

// @beginner: 声明 lastResetTime：保存当前步骤需要读取或更新的数据。
let lastResetTime = 0;

// @beginner: 声明 getCurrentTime：保存当前步骤需要读取或更新的数据。
const getCurrentTime =
  typeof performance === "object" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

/**
 * React 为 owner stack 创建数量设限，避免错误路径里无限制造 Error 对象。
 * 该函数每秒最多重置一次计数，和官方开发态节流逻辑一致。
 */
// @beginner: 进入 resetOwnerStackLimit：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function resetOwnerStackLimit(): void {
  // @beginner: 声明 now：保存当前步骤需要读取或更新的数据。
  const now = getCurrentTime();
  // @beginner: 声明 timeSinceLastReset：保存当前步骤需要读取或更新的数据。
  const timeSinceLastReset = now - lastResetTime;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (timeSinceLastReset > 1000) {
    ReactSharedInternals.recentlyCreatedOwnerStacks = 0;
    lastResetTime = now;
  }
}
