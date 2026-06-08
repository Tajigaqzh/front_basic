/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 checkKeyStringCoercion：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function checkKeyStringCoercion(value: unknown): void {
  willCoercionThrow(value);
}

// @beginner: 进入 checkAttributeStringCoercion：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function checkAttributeStringCoercion(value: unknown, _attributeName: string): void {
  willCoercionThrow(value);
}

// @beginner: 进入 checkCSSPropertyStringCoercion：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function checkCSSPropertyStringCoercion(value: unknown, _propName: string): void {
  willCoercionThrow(value);
}

// @beginner: 进入 willCoercionThrow：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function willCoercionThrow(value: unknown): void {
  // 官方源码在 DEV 下用这个文件给 Symbol/Temporal 等无法安全转字符串的值报警。
  // 这里执行一次 String 转换，让错误尽早暴露，同时不引入 DEV/PROD 分支。
  String(value);
}
