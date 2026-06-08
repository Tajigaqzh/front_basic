import ReactSharedInternals from "./ReactSharedInternals.js";

let lastResetTime = 0;

const getCurrentTime =
  typeof performance === "object" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

/**
 * React 为 owner stack 创建数量设限，避免错误路径里无限制造 Error 对象。
 * 该函数每秒最多重置一次计数，和官方开发态节流逻辑一致。
 */
export function resetOwnerStackLimit(): void {
  const now = getCurrentTime();
  const timeSinceLastReset = now - lastResetTime;

  if (timeSinceLastReset > 1000) {
    ReactSharedInternals.recentlyCreatedOwnerStacks = 0;
    lastResetTime = now;
  }
}
