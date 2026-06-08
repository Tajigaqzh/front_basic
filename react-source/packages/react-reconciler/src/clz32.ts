/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 log：保存当前步骤需要读取或更新的数据。
const log = Math.log;
// @beginner: 声明 LN2：保存当前步骤需要读取或更新的数据。
const LN2 = Math.LN2;

// @beginner: 进入 clz32Fallback：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function clz32Fallback(x: number): number {
  // @beginner: 声明 asUint：保存当前步骤需要读取或更新的数据。
  const asUint = x >>> 0;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (asUint === 0) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return 32;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (31 - ((log(asUint) / LN2) | 0)) | 0;
}

// @beginner: 定义 clz32：这里保存一个可调用函数，后续代码会在需要时执行它。
export const clz32: (x: number) => number = Math.clz32 ?? clz32Fallback;
