export function checkKeyStringCoercion(value: unknown): void {
  willCoercionThrow(value);
}

export function checkAttributeStringCoercion(value: unknown, _attributeName: string): void {
  willCoercionThrow(value);
}

export function checkCSSPropertyStringCoercion(value: unknown, _propName: string): void {
  willCoercionThrow(value);
}

function willCoercionThrow(value: unknown): void {
  // 官方源码在 DEV 下用这个文件给 Symbol/Temporal 等无法安全转字符串的值报警。
  // 这里执行一次 String 转换，让错误尽早暴露，同时不引入 DEV/PROD 分支。
  String(value);
}
