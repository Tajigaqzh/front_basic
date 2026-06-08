/**
 * @beginner-module: 源码导读
 * 本文件属于 react 包的公开 API 或基础能力，通常只创建描述对象或转发到 reconciler。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { REACT_LAZY_TYPE, type ElementType } from "shared";

// @beginner: 定义 Thenable：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type Thenable<T> = Promise<{ default: T }>;

// @beginner: 定义 LazyComponent：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface LazyComponent<T extends ElementType = ElementType> {
  $$typeof: typeof REACT_LAZY_TYPE;
  _payload: {
    status: "uninitialized" | "pending" | "resolved" | "rejected";
    result: (() => Thenable<T>) | Thenable<T> | T | unknown;
  };
  _init: (payload: LazyComponent<T>["_payload"]) => T;
}

// @beginner: 进入 lazy：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function lazy<T extends ElementType>(ctor: () => Thenable<T>): LazyComponent<T> {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    $$typeof: REACT_LAZY_TYPE,
    _payload: {
      status: "uninitialized",
      result: ctor,
    },
    _init: lazyInitializer,
  };
}

// @beginner: 进入 lazyInitializer：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function lazyInitializer<T extends ElementType>(payload: LazyComponent<T>["_payload"]): T {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (payload.status === "resolved") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return payload.result as T;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (payload.status === "rejected") {
    // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
    throw payload.result;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (payload.status === "uninitialized") {
    // @beginner: 声明 ctor：保存 lazy 传入的加载函数，调用后得到 thenable。
    const ctor = payload.result as () => Thenable<T>;
    // @beginner: 声明 thenable：保存当前步骤需要读取或更新的数据。
    const thenable = ctor();
    payload.status = "pending";
    payload.result = thenable;
    thenable.then(
      (moduleObject) => {
        payload.status = "resolved";
        payload.result = moduleObject.default;
      },
      (error) => {
        payload.status = "rejected";
        payload.result = error;
      },
    );
  }

  // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
  throw payload.result;
}
