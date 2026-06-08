/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 ensureCorrectIsomorphicReactVersion：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function ensureCorrectIsomorphicReactVersion(): void {
  // 官方用于校验 react 与 react-dom 版本一致；本地复刻共用同一个 workspace，无需运行时校验。
}
