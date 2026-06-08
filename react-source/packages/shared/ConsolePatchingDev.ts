/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 ConsoleMethod：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ConsoleMethod = (...args: unknown[]) => void;

// @beginner: 声明 disabledDepth：保存当前步骤需要读取或更新的数据。
let disabledDepth = 0;
// @beginner: 声明 prevLog：保存当前步骤需要读取或更新的数据。
let prevLog: ConsoleMethod | undefined;
// @beginner: 声明 prevInfo：保存当前步骤需要读取或更新的数据。
let prevInfo: ConsoleMethod | undefined;
// @beginner: 声明 prevWarn：保存当前步骤需要读取或更新的数据。
let prevWarn: ConsoleMethod | undefined;
// @beginner: 声明 prevError：保存当前步骤需要读取或更新的数据。
let prevError: ConsoleMethod | undefined;
// @beginner: 声明 prevGroup：保存当前步骤需要读取或更新的数据。
let prevGroup: ConsoleMethod | undefined;
// @beginner: 声明 prevGroupCollapsed：保存当前步骤需要读取或更新的数据。
let prevGroupCollapsed: ConsoleMethod | undefined;
// @beginner: 声明 prevGroupEnd：保存当前步骤需要读取或更新的数据。
let prevGroupEnd: ConsoleMethod | undefined;

// @beginner: 进入 disabledLog：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function disabledLog(): void {}

(disabledLog as ConsoleMethod & { __reactDisabledLog?: true }).__reactDisabledLog = true;

// @beginner: 声明 disabledDescriptor：保存当前步骤需要读取或更新的数据。
const disabledDescriptor = {
  configurable: true,
  enumerable: true,
  value: disabledLog,
  writable: true,
};

/**
 * 开发态生成组件栈时会“试跑”组件函数。这里临时静音 console，避免用户在
 * render 内部的日志因为这次探测调用而重复打印。嵌套调用用 depth 计数恢复。
 */
// @beginner: 进入 disableLogs：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function disableLogs(): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disabledDepth === 0) {
    prevLog = console.log;
    prevInfo = console.info;
    prevWarn = console.warn;
    prevError = console.error;
    prevGroup = console.group;
    prevGroupCollapsed = console.groupCollapsed;
    prevGroupEnd = console.groupEnd;

    Object.defineProperties(console, {
      info: disabledDescriptor,
      log: disabledDescriptor,
      warn: disabledDescriptor,
      error: disabledDescriptor,
      group: disabledDescriptor,
      groupCollapsed: disabledDescriptor,
      groupEnd: disabledDescriptor,
    });
  }

  disabledDepth += 1;
}

// @beginner: 进入 reenableLogs：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function reenableLogs(): void {
  disabledDepth -= 1;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disabledDepth === 0) {
    // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
    const props = {
      configurable: true,
      enumerable: true,
      writable: true,
    };

    Object.defineProperties(console, {
      log: { ...props, value: prevLog },
      info: { ...props, value: prevInfo },
      warn: { ...props, value: prevWarn },
      error: { ...props, value: prevError },
      group: { ...props, value: prevGroup },
      groupCollapsed: { ...props, value: prevGroupCollapsed },
      groupEnd: { ...props, value: prevGroupEnd },
    });
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (disabledDepth < 0) {
    disabledDepth = 0;
    console.error("disabledDepth fell below zero. This is a bug in React.");
  }
}
