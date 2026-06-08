/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { CapturedValue } from "./ReactCapturedValue.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Lane } from "./ReactFiberLane.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { TreeContext } from "./ReactFiberTreeContext.js";

// 非 null ActivityState 表示一个 dehydrated Activity 边界。
// @beginner: 定义 ActivityState：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ActivityState {
  dehydrated: unknown;
  treeContext: TreeContext | null;
  retryLane: Lane;
  hydrationErrors: Array<CapturedValue<unknown>> | null;
}
