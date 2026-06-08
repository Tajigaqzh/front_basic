type ConsoleMethod = (...args: unknown[]) => void;

let disabledDepth = 0;
let prevLog: ConsoleMethod | undefined;
let prevInfo: ConsoleMethod | undefined;
let prevWarn: ConsoleMethod | undefined;
let prevError: ConsoleMethod | undefined;
let prevGroup: ConsoleMethod | undefined;
let prevGroupCollapsed: ConsoleMethod | undefined;
let prevGroupEnd: ConsoleMethod | undefined;

function disabledLog(): void {}

(disabledLog as ConsoleMethod & { __reactDisabledLog?: true }).__reactDisabledLog = true;

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
export function disableLogs(): void {
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

export function reenableLogs(): void {
  disabledDepth -= 1;

  if (disabledDepth === 0) {
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

  if (disabledDepth < 0) {
    disabledDepth = 0;
    console.error("disabledDepth fell below zero. This is a bug in React.");
  }
}
