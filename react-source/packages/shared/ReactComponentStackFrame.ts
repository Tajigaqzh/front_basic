import { disableLogs, reenableLogs } from "./ConsolePatchingDev.js";
import ReactSharedInternals from "./ReactSharedInternals.js";
import DefaultPrepareStackTrace from "./DefaultPrepareStackTrace.js";
import { formatOwnerStack } from "./ReactOwnerStackFrames.js";

type ErrorConstructorWithPrepareStackTrace = ErrorConstructor & {
  prepareStackTrace?: typeof DefaultPrepareStackTrace;
};

type ComponentFunction = Function & {
  displayName?: string;
  prototype?: Record<string, unknown>;
};

let prefix: string | undefined;
let suffix: string | undefined;

export function describeBuiltInComponentFrame(name: string): string {
  if (prefix === undefined) {
    try {
      throw new Error();
    } catch (error) {
      const stack = error instanceof Error ? error.stack ?? "" : "";
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

  return `\n${prefix}${name}${suffix}`;
}

export function describeDebugInfoFrame(
  name: string,
  env: string | null | undefined,
  location: Error | null | undefined,
): string {
  if (location != null) {
    const childStack = formatOwnerStack(location);
    const idx = childStack.lastIndexOf("\n");
    const lastLine = idx === -1 ? childStack : childStack.slice(idx + 1);
    if (lastLine.indexOf(name) !== -1) {
      return `\n${lastLine}`;
    }
  }

  return describeBuiltInComponentFrame(`${name}${env ? ` [${env}]` : ""}`);
}

let reentry = false;
const componentFrameCache = new WeakMap<Function, string>();

function getDisplayName(fn: ComponentFunction): string {
  return fn.displayName || fn.name || "";
}

function constructClassComponent(fn: ComponentFunction): void {
  const Fake = function FakeComponentForStackFrame(): void {
    throw new Error();
  };

  Object.defineProperty(Fake.prototype, "props", {
    configurable: true,
    set() {
      throw new Error();
    },
  });

  if (typeof Reflect === "object" && typeof Reflect.construct === "function") {
    Reflect.construct(fn, [], Fake);
    return;
  }

  const proto = fn.prototype;
  let prototypeModified = false;
  let prevProps: PropertyDescriptor | undefined;

  try {
    if (proto && typeof proto === "object") {
      prevProps = Object.getOwnPropertyDescriptor(proto, "props");
      Object.defineProperty(proto, "props", {
        configurable: true,
        set() {
          throw new Error();
        },
      });
      prototypeModified = true;
    }

    Reflect.construct(fn, []);
  } finally {
    if (prototypeModified && proto) {
      if (prevProps !== undefined) {
        Object.defineProperty(proto, "props", prevProps);
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
export function describeNativeComponentFrame(
  fn: ComponentFunction,
  construct: boolean,
): string {
  if (!fn || reentry) {
    return "";
  }

  const cachedFrame = componentFrameCache.get(fn);
  if (cachedFrame !== undefined) {
    return cachedFrame;
  }

  reentry = true;
  const ErrorWithPrepareStackTrace = Error as ErrorConstructorWithPrepareStackTrace;
  const previousPrepareStackTrace = ErrorWithPrepareStackTrace.prepareStackTrace;
  ErrorWithPrepareStackTrace.prepareStackTrace = DefaultPrepareStackTrace;
  const previousDispatcher = ReactSharedInternals.H;
  ReactSharedInternals.H = null;
  disableLogs();

  try {
    const RunInRootFrame = {
      DetermineComponentFrameRoot(): [string | null, string | null] {
        let control: Error | undefined;

        try {
          if (construct) {
            const Fake = function FakeControlForStackFrame(): void {
              throw new Error();
            };

            Object.defineProperty(Fake.prototype, "props", {
              configurable: true,
              set() {
                throw new Error();
              },
            });

            try {
              if (typeof Reflect === "object" && typeof Reflect.construct === "function") {
                Reflect.construct(Fake, []);
              } else {
                Fake();
              }
            } catch (error) {
              if (error instanceof Error) {
                control = error;
              }
            }

            constructClassComponent(fn);
          } else {
            try {
              throw new Error();
            } catch (error) {
              if (error instanceof Error) {
                control = error;
              }
            }

            const maybePromise = (fn as () => { catch?: (onReject: () => void) => void } | unknown)();
            if (
              maybePromise !== null &&
              typeof maybePromise === "object" &&
              typeof (maybePromise as { catch?: unknown }).catch === "function"
            ) {
              (maybePromise as { catch(onReject: () => void): void }).catch(() => {});
            }
          }
        } catch (sample) {
          if (
            sample instanceof Error &&
            control instanceof Error &&
            typeof sample.stack === "string" &&
            typeof control.stack === "string"
          ) {
            return [sample.stack, control.stack];
          }
        }

        return [null, null];
      },
    };

    const rootFrame = RunInRootFrame.DetermineComponentFrameRoot as ComponentFunction;
    rootFrame.displayName = "DetermineComponentFrameRoot";
    const namePropDescriptor = Object.getOwnPropertyDescriptor(rootFrame, "name");
    if (namePropDescriptor?.configurable) {
      Object.defineProperty(rootFrame, "name", {
        value: "DetermineComponentFrameRoot",
      });
    }

    const [sampleStack, controlStack] = RunInRootFrame.DetermineComponentFrameRoot();
    if (sampleStack && controlStack) {
      const sampleLines = sampleStack.split("\n");
      const controlLines = controlStack.split("\n");
      let s = 0;
      let c = 0;

      while (
        s < sampleLines.length &&
        !sampleLines[s].includes("DetermineComponentFrameRoot")
      ) {
        s += 1;
      }
      while (
        c < controlLines.length &&
        !controlLines[c].includes("DetermineComponentFrameRoot")
      ) {
        c += 1;
      }

      if (s === sampleLines.length || c === controlLines.length) {
        s = sampleLines.length - 1;
        c = controlLines.length - 1;
        while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
          c -= 1;
        }
      }

      for (; s >= 1 && c >= 0; s -= 1, c -= 1) {
        if (sampleLines[s] !== controlLines[c]) {
          if (s !== 1 || c !== 1) {
            do {
              s -= 1;
              c -= 1;
              if (c < 0 || sampleLines[s] !== controlLines[c]) {
                let frame = `\n${sampleLines[s].replace(" at new ", " at ")}`;
                if (fn.displayName && frame.includes("<anonymous>")) {
                  frame = frame.replace("<anonymous>", fn.displayName);
                }
                componentFrameCache.set(fn, frame);
                return frame;
              }
            } while (s >= 1 && c >= 0);
          }
          break;
        }
      }
    }
  } finally {
    reentry = false;
    ReactSharedInternals.H = previousDispatcher;
    reenableLogs();
    ErrorWithPrepareStackTrace.prepareStackTrace = previousPrepareStackTrace;
  }

  const name = getDisplayName(fn);
  const syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
  componentFrameCache.set(fn, syntheticFrame);
  return syntheticFrame;
}

export function describeClassComponentFrame(ctor: ComponentFunction): string {
  return describeNativeComponentFrame(ctor, true);
}

export function describeFunctionComponentFrame(fn: ComponentFunction): string {
  return describeNativeComponentFrame(fn, false);
}
