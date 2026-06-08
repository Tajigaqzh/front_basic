/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactDOMSharedInternals from "shared/ReactDOMSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getCrossOriginString } from "./crossOriginStrings.js";

// @beginner: 定义 HintCode：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type HintCode = "D" | "C" | "L" | "m" | "X" | "S" | "M";
// @beginner: 定义 HintModel：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type HintModel =
  | string
  | readonly [string, string]
  | readonly [string, string, Record<string, unknown>]
  | readonly [string, Record<string, unknown>]
  | readonly [string, string | 0 | undefined, Record<string, unknown>?];

// @beginner: 进入 dispatchHint：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function dispatchHint(code: HintCode, model: HintModel): void {
  // @beginner: 声明 dispatcher：保存当前步骤需要读取或更新的数据。
  const dispatcher = ReactDOMSharedInternals.d;

  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (code) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "D":
      dispatcher.D(model as string);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "C":
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof model === "string") {
        dispatcher.C(model);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        dispatcher.C(model[0], model[1] as string);
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "L": {
      // @beginner: 声明 refined：保存当前步骤需要读取或更新的数据。
      const refined = model as readonly [string, string, Record<string, unknown>?];
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (refined.length === 3) {
        dispatcher.L(refined[0], refined[1], refined[2]);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        dispatcher.L(refined[0], refined[1]);
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "m":
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof model === "string") {
        dispatcher.m(model);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        dispatcher.m(model[0], model[1] as Record<string, unknown>);
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "X":
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof model === "string") {
        dispatcher.X(model);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        dispatcher.X(model[0], model[1] as Record<string, unknown>);
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "S":
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof model === "string") {
        dispatcher.S(model);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 声明 precedence：保存当前步骤需要读取或更新的数据。
        const precedence = model[1] === 0 ? undefined : (model[1] as string | undefined);
        dispatcher.S(model[0], precedence, model.length === 3 ? model[2] : undefined);
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "M":
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof model === "string") {
        dispatcher.M(model);
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        dispatcher.M(model[0], model[1] as Record<string, unknown>);
      }
  }
}

// @beginner: 进入 preinitModuleForSSR：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function preinitModuleForSSR(
  href: string,
  nonce: string | null | undefined,
  crossOrigin: string | null | undefined,
): void {
  ReactDOMSharedInternals.d.M(href, {
    crossOrigin: getCrossOriginString(crossOrigin),
    nonce,
  });
}

// @beginner: 进入 preinitScriptForSSR：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function preinitScriptForSSR(
  href: string,
  nonce: string | null | undefined,
  crossOrigin: string | null | undefined,
): void {
  ReactDOMSharedInternals.d.X(href, {
    crossOrigin: getCrossOriginString(crossOrigin),
    nonce,
  });
}
