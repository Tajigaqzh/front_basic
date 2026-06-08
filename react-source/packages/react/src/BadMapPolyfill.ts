/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 hasBadMapPolyfill：保存当前步骤需要读取或更新的数据。
export let hasBadMapPolyfill = false;

// @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
try {
  // @beginner: 声明 frozenObject：保存当前步骤需要读取或更新的数据。
  const frozenObject = Object.freeze({});
  new Map([[frozenObject, null]]);
  new Set([frozenObject]);
// @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
} catch {
  hasBadMapPolyfill = true;
}
