/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 进入 getEventCharCode：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getEventCharCode(nativeEvent: KeyboardEvent): number {
  // @beginner: 声明 charCode：保存当前步骤需要读取或更新的数据。
  let charCode = nativeEvent.charCode;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (charCode === 0 && nativeEvent.keyCode === 13) {
    charCode = 13;
  }

  // Firefox 可能为非打印键触发 keypress；官方用 32 以下字符过滤，
  // Enter 例外，因为它既可能作为控制键也可能作为可输入字符。
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (charCode >= 32 || charCode === 13) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return charCode;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return 0;
}

export default getEventCharCode;
