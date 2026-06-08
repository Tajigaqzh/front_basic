/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { canUseDOM } from "shared";

// @beginner: 声明 passiveBrowserEventsSupported：保存当前步骤需要读取或更新的数据。
export let passiveBrowserEventsSupported = false;

// @beginner: 条件分支：根据当前值选择不同处理路径。
if (canUseDOM) {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 声明 options：保存当前步骤需要读取或更新的数据。
    const options = {};
    Object.defineProperty(options, "passive", {
      get() {
        passiveBrowserEventsSupported = true;
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return false;
      },
    });
    window.addEventListener("test", () => undefined, options);
    window.removeEventListener("test", () => undefined, options);
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch {
    passiveBrowserEventsSupported = false;
  }
}
