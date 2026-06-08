/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromType from "shared/getComponentNameFromType.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "./ReactInternalTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { HostComponent, HostRoot, HostText } from "./ReactWorkTags.js";

export default function getComponentNameFromFiber(fiber: Fiber): string | null {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (fiber.tag) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostRoot:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "Root";
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostComponent:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return typeof fiber.type === "string" ? fiber.type : null;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case HostText:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "Text";
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return getComponentNameFromType(fiber.type);
  }
}
