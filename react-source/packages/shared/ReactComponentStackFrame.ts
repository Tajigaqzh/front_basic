/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { disableLogs, reenableLogs } from "./ConsolePatchingDev.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactSharedInternals from "./ReactSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import DefaultPrepareStackTrace from "./DefaultPrepareStackTrace.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { formatOwnerStack } from "./ReactOwnerStackFrames.js";

// @beginner: 定义 ErrorConstructorWithPrepareStackTrace：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ErrorConstructorWithPrepareStackTrace = ErrorConstructor & {
  prepareStackTrace?: typeof DefaultPrepareStackTrace;
};

// @beginner: 定义 ComponentFunction：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ComponentFunction = Function & {
  displayName?: string;
  prototype?: Record<string, unknown>;
};

// @beginner: 声明 prefix：保存当前步骤需要读取或更新的数据。
let prefix: string | undefined;
// @beginner: 声明 suffix：保存当前步骤需要读取或更新的数据。
let suffix: string | undefined;

// @beginner: 进入 describeBuiltInComponentFrame：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeBuiltInComponentFrame(name: string): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (prefix === undefined) {
    // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
    try {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error();
    // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
    } catch (error) {
      // @beginner: 声明 stack：保存当前步骤需要读取或更新的数据。
      const stack = error instanceof Error ? error.stack ?? "" : "";
      // @beginner: 声明 match：保存当前步骤需要读取或更新的数据。
      const match = stack.trim().match(/\n( *(at )?)/);
      prefix = (match && match[1]) || "";
      suffix =
        stack.indexOf("\n    at") > -1
          ? " (<anonymous>)"
          : stack.indexOf("@") > -1
            ? "@unknown:0:0"
            : "";
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return `\n${prefix}${name}${suffix}`;
}

// @beginner: 进入 describeDebugInfoFrame：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeDebugInfoFrame(
  name: string,
  env: string | null | undefined,
  location: Error | null | undefined,
): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (location != null) {
    // @beginner: 声明 childStack：保存当前步骤需要读取或更新的数据。
    const childStack = formatOwnerStack(location);
    // @beginner: 声明 idx：保存当前步骤需要读取或更新的数据。
    const idx = childStack.lastIndexOf("\n");
    // @beginner: 声明 lastLine：保存当前步骤需要读取或更新的数据。
    const lastLine = idx === -1 ? childStack : childStack.slice(idx + 1);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (lastLine.indexOf(name) !== -1) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return `\n${lastLine}`;
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return describeBuiltInComponentFrame(`${name}${env ? ` [${env}]` : ""}`);
}

// @beginner: 声明 reentry：保存当前步骤需要读取或更新的数据。
let reentry = false;
// @beginner: 声明 componentFrameCache：保存当前步骤需要读取或更新的数据。
const componentFrameCache = new WeakMap<Function, string>();

// @beginner: 进入 getDisplayName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getDisplayName(fn: ComponentFunction): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return fn.displayName || fn.name || "";
}

// @beginner: 进入 constructClassComponent：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function constructClassComponent(fn: ComponentFunction): void {
  // @beginner: 声明 Fake：保存当前步骤需要读取或更新的数据。
  const Fake = function FakeComponentForStackFrame(): void {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw new Error();
  };

  Object.defineProperty(Fake.prototype, "props", {
    configurable: true,
    set() {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error();
    },
  });

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof Reflect === "object" && typeof Reflect.construct === "function") {
    Reflect.construct(fn, [], Fake);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 proto：保存当前步骤需要读取或更新的数据。
  const proto = fn.prototype;
  // @beginner: 声明 prototypeModified：保存当前步骤需要读取或更新的数据。
  let prototypeModified = false;
  // @beginner: 声明 prevProps：保存当前步骤需要读取或更新的数据。
  let prevProps: PropertyDescriptor | undefined;

  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (proto && typeof proto === "object") {
      prevProps = Object.getOwnPropertyDescriptor(proto, "props");
      Object.defineProperty(proto, "props", {
        configurable: true,
        set() {
          // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
          throw new Error();
        },
      });
      prototypeModified = true;
    }

    Reflect.construct(fn, []);
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (prototypeModified && proto) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (prevProps !== undefined) {
        Object.defineProperty(proto, "props", prevProps);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        delete proto.props;
      }
    }
  }
}

/**
 * 通过“sample stack 与 control stack 做差”提取单个组件帧。
 *
 * 关键点与官方一致：
 * - control stack：只在包裹函数里抛错；
 * - sample stack：在同一个包裹函数里调用组件并让它抛错；
 * - 两个栈共同拥有 `DetermineComponentFrameRoot` 哨兵帧，向上比较后第一个不同帧
 *   就是组件自身调用帧。
 */
// @beginner: 进入 describeNativeComponentFrame：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeNativeComponentFrame(
  fn: ComponentFunction,
  construct: boolean,
): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!fn || reentry) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "";
  }

  // @beginner: 声明 cachedFrame：保存当前步骤需要读取或更新的数据。
  const cachedFrame = componentFrameCache.get(fn);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (cachedFrame !== undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return cachedFrame;
  }

  reentry = true;
  // @beginner: 声明 ErrorWithPrepareStackTrace：保存当前步骤需要读取或更新的数据。
  const ErrorWithPrepareStackTrace = Error as ErrorConstructorWithPrepareStackTrace;
  // @beginner: 声明 previousPrepareStackTrace：保存当前步骤需要读取或更新的数据。
  const previousPrepareStackTrace = ErrorWithPrepareStackTrace.prepareStackTrace;
  ErrorWithPrepareStackTrace.prepareStackTrace = DefaultPrepareStackTrace;
  // @beginner: 声明 previousDispatcher：保存当前步骤需要读取或更新的数据。
  const previousDispatcher = ReactSharedInternals.H;
  ReactSharedInternals.H = null;
  disableLogs();

  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 声明 RunInRootFrame：保存当前步骤需要读取或更新的数据。
    const RunInRootFrame = {
      DetermineComponentFrameRoot(): [string | null, string | null] {
        // @beginner: 声明 control：保存当前步骤需要读取或更新的数据。
        let control: Error | undefined;

        // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
        try {
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (construct) {
            // @beginner: 声明 Fake：保存当前步骤需要读取或更新的数据。
            const Fake = function FakeControlForStackFrame(): void {
              // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
              throw new Error();
            };

            Object.defineProperty(Fake.prototype, "props", {
              configurable: true,
              set() {
                // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
                throw new Error();
              },
            });

            // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
            try {
              // @beginner: 条件分支：根据当前值选择不同处理路径。
              if (typeof Reflect === "object" && typeof Reflect.construct === "function") {
                Reflect.construct(Fake, []);
              // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
              } else {
                Fake();
              }
            // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
            } catch (error) {
              // @beginner: 条件分支：根据当前值选择不同处理路径。
              if (error instanceof Error) {
                control = error;
              }
            }

            constructClassComponent(fn);
          // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
          } else {
            // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
            try {
              // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
              throw new Error();
            // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
            } catch (error) {
              // @beginner: 条件分支：根据当前值选择不同处理路径。
              if (error instanceof Error) {
                control = error;
              }
            }

            // @beginner: 声明 maybePromise：保存调用用户函数后的返回值，可能是 Promise-like 对象。
            const maybePromise = (fn as () => { catch?: (onReject: () => void) => void } | unknown)();
            // @beginner: 条件分支：根据当前值选择不同处理路径。
            if (
              maybePromise !== null &&
              typeof maybePromise === "object" &&
              typeof (maybePromise as { catch?: unknown }).catch === "function"
            ) {
              (maybePromise as { catch(onReject: () => void): void }).catch(() => {});
            }
          }
        // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
        } catch (sample) {
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (
            sample instanceof Error &&
            control instanceof Error &&
            typeof sample.stack === "string" &&
            typeof control.stack === "string"
          ) {
            // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
            return [sample.stack, control.stack];
          }
        }

        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return [null, null];
      },
    };

    // @beginner: 声明 rootFrame：保存当前步骤需要读取或更新的数据。
    const rootFrame = RunInRootFrame.DetermineComponentFrameRoot as ComponentFunction;
    rootFrame.displayName = "DetermineComponentFrameRoot";
    // @beginner: 声明 namePropDescriptor：保存当前步骤需要读取或更新的数据。
    const namePropDescriptor = Object.getOwnPropertyDescriptor(rootFrame, "name");
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (namePropDescriptor?.configurable) {
      Object.defineProperty(rootFrame, "name", {
        value: "DetermineComponentFrameRoot",
      });
    }

    // @beginner: 声明 变量：保存当前步骤需要读取或更新的数据。
    const [sampleStack, controlStack] = RunInRootFrame.DetermineComponentFrameRoot();
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (sampleStack && controlStack) {
      // @beginner: 声明 sampleLines：保存当前步骤需要读取或更新的数据。
      const sampleLines = sampleStack.split("\n");
      // @beginner: 声明 controlLines：保存当前步骤需要读取或更新的数据。
      const controlLines = controlStack.split("\n");
      // @beginner: 声明 s：保存当前步骤需要读取或更新的数据。
      let s = 0;
      // @beginner: 声明 c：保存当前步骤需要读取或更新的数据。
      let c = 0;

      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      while (
        s < sampleLines.length &&
        !sampleLines[s].includes("DetermineComponentFrameRoot")
      ) {
        s += 1;
      }
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      while (
        c < controlLines.length &&
        !controlLines[c].includes("DetermineComponentFrameRoot")
      ) {
        c += 1;
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (s === sampleLines.length || c === controlLines.length) {
        s = sampleLines.length - 1;
        c = controlLines.length - 1;
        // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
        while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
          c -= 1;
        }
      }

      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      for (; s >= 1 && c >= 0; s -= 1, c -= 1) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (sampleLines[s] !== controlLines[c]) {
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (s !== 1 || c !== 1) {
            // @beginner: do-while 循环：先执行一次，再根据条件决定是否继续。
            do {
              s -= 1;
              c -= 1;
              // @beginner: 条件分支：根据当前值选择不同处理路径。
              if (c < 0 || sampleLines[s] !== controlLines[c]) {
                // @beginner: 声明 frame：保存当前步骤需要读取或更新的数据。
                let frame = `\n${sampleLines[s].replace(" at new ", " at ")}`;
                // @beginner: 条件分支：根据当前值选择不同处理路径。
                if (fn.displayName && frame.includes("<anonymous>")) {
                  frame = frame.replace("<anonymous>", fn.displayName);
                }
                componentFrameCache.set(fn, frame);
                // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
                return frame;
              }
            } while (s >= 1 && c >= 0);
          }
          break;
        }
      }
    }
  // @beginner: 收尾逻辑：无论 try 是否成功，都会执行这里来恢复现场。
  } finally {
    reentry = false;
    ReactSharedInternals.H = previousDispatcher;
    reenableLogs();
    ErrorWithPrepareStackTrace.prepareStackTrace = previousPrepareStackTrace;
  }

  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = getDisplayName(fn);
  // @beginner: 声明 syntheticFrame：保存当前步骤需要读取或更新的数据。
  const syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
  componentFrameCache.set(fn, syntheticFrame);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return syntheticFrame;
}

// @beginner: 进入 describeClassComponentFrame：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeClassComponentFrame(ctor: ComponentFunction): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return describeNativeComponentFrame(ctor, true);
}

// @beginner: 进入 describeFunctionComponentFrame：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeFunctionComponentFrame(fn: ComponentFunction): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return describeNativeComponentFrame(fn, false);
}
