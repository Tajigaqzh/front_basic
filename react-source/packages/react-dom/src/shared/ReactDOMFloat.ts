/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import ReactDOMSharedInternals from "shared/ReactDOMSharedInternals.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  getCrossOriginString,
  getCrossOriginStringAs,
} from "react-dom-bindings/src/shared/crossOriginStrings.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  getValueDescriptorExpectingEnumForWarning,
  getValueDescriptorExpectingObjectForWarning,
} from "react-dom-bindings/src/shared/ReactDOMResourceValidation.js";

// @beginner: 定义 PreconnectOptions：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PreconnectOptions {
  crossOrigin?: unknown;
}

// @beginner: 定义 PreloadOptions：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PreloadOptions {
  as: string;
  crossOrigin?: unknown;
  integrity?: unknown;
  nonce?: unknown;
  type?: unknown;
  fetchPriority?: unknown;
  referrerPolicy?: unknown;
  imageSrcSet?: unknown;
  imageSizes?: unknown;
  media?: unknown;
}

// @beginner: 定义 PreloadModuleOptions：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PreloadModuleOptions {
  as?: string;
  crossOrigin?: unknown;
  integrity?: unknown;
}

// @beginner: 定义 PreinitOptions：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PreinitOptions {
  as: "style" | "script" | string;
  crossOrigin?: unknown;
  integrity?: unknown;
  fetchPriority?: unknown;
  nonce?: unknown;
  precedence?: unknown;
}

// @beginner: 定义 PreinitModuleOptions：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface PreinitModuleOptions {
  as?: "script" | string;
  crossOrigin?: unknown;
  integrity?: unknown;
  nonce?: unknown;
}

// @beginner: 进入 warnInvalid：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function warnInvalid(message: string, value: unknown): void {
  console.error(message, getValueDescriptorExpectingObjectForWarning(value));
}

// @beginner: 进入 prefetchDNS：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function prefetchDNS(href: string): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.prefetchDNS(): Expected `href` to be a non-empty string but encountered %s.", href);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  ReactDOMSharedInternals.d.D(href);
}

// @beginner: 进入 preconnect：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function preconnect(href: string, options?: PreconnectOptions | null): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.preconnect(): Expected `href` to be a non-empty string but encountered %s.", href);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (options != null && typeof options !== "object") {
    console.error(
      "ReactDOM.preconnect(): Expected `options` to be an object but encountered %s.",
      getValueDescriptorExpectingEnumForWarning(options),
    );
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  ReactDOMSharedInternals.d.C(href, options ? getCrossOriginString(options.crossOrigin) : undefined);
}

// @beginner: 进入 preload：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function preload(href: string, options: PreloadOptions): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (
    typeof href !== "string" ||
    href === "" ||
    options == null ||
    typeof options !== "object" ||
    typeof options.as !== "string" ||
    options.as === ""
  ) {
    console.error("ReactDOM.preload(): Expected href and an options object with a valid `as` property.");
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  ReactDOMSharedInternals.d.L(href, options.as, {
    crossOrigin: getCrossOriginStringAs(options.as, options.crossOrigin),
    integrity: typeof options.integrity === "string" ? options.integrity : undefined,
    nonce: typeof options.nonce === "string" ? options.nonce : undefined,
    type: typeof options.type === "string" ? options.type : undefined,
    fetchPriority: typeof options.fetchPriority === "string" ? options.fetchPriority : undefined,
    referrerPolicy: typeof options.referrerPolicy === "string" ? options.referrerPolicy : undefined,
    imageSrcSet: typeof options.imageSrcSet === "string" ? options.imageSrcSet : undefined,
    imageSizes: typeof options.imageSizes === "string" ? options.imageSizes : undefined,
    media: typeof options.media === "string" ? options.media : undefined,
  });
}

// @beginner: 进入 preloadModule：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function preloadModule(href: string, options?: PreloadModuleOptions | null): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.preloadModule(): Expected `href` to be a non-empty string but encountered %s.", href);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (options != null) {
    ReactDOMSharedInternals.d.m(href, {
      as: typeof options.as === "string" && options.as !== "script" ? options.as : undefined,
      crossOrigin: getCrossOriginStringAs(options.as, options.crossOrigin),
      integrity: typeof options.integrity === "string" ? options.integrity : undefined,
    });
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    ReactDOMSharedInternals.d.m(href);
  }
}

// @beginner: 进入 preinit：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function preinit(href: string, options: PreinitOptions): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof href !== "string" || href === "" || options == null || typeof options !== "object") {
    console.error("ReactDOM.preinit(): Expected href and an options object.");
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 crossOrigin：保存当前步骤需要读取或更新的数据。
  const crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
  // @beginner: 声明 integrity：保存当前步骤需要读取或更新的数据。
  const integrity = typeof options.integrity === "string" ? options.integrity : undefined;
  // @beginner: 声明 fetchPriority：保存当前步骤需要读取或更新的数据。
  const fetchPriority = typeof options.fetchPriority === "string" ? options.fetchPriority : undefined;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (options.as === "style") {
    ReactDOMSharedInternals.d.S(
      href,
      typeof options.precedence === "string" ? options.precedence : undefined,
      { crossOrigin, integrity, fetchPriority },
    );
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (options.as === "script") {
    ReactDOMSharedInternals.d.X(href, {
      crossOrigin,
      integrity,
      fetchPriority,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined,
    });
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    console.error("ReactDOM.preinit(): Expected `as` to be \"style\" or \"script\".");
  }
}

// @beginner: 进入 preinitModule：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function preinitModule(href: string, options?: PreinitModuleOptions | null): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.preinitModule(): Expected `href` to be a non-empty string but encountered %s.", href);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (options == null) {
    ReactDOMSharedInternals.d.M(href);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (options.as == null || options.as === "script") {
    ReactDOMSharedInternals.d.M(href, {
      crossOrigin: getCrossOriginStringAs(options.as, options.crossOrigin),
      integrity: typeof options.integrity === "string" ? options.integrity : undefined,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined,
    });
  }
}
