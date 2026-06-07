export function warn(msg: string, ...args: any[]): void {
  // reactivity 模块内部统一走这个出口发开发期警告，
  // 便于后续集中替换、定制或与上层 runtime 的告警体系对齐。
  console.warn(`[Vue warn] ${msg}`, ...args)
}
