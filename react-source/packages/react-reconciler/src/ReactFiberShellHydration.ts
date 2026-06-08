/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FiberRoot } from "./ReactInternalTypes.js";

// @beginner: 定义 RootState：描述对象需要具备哪些字段，方便读者理解数据形状。
interface RootState {
  isDehydrated?: boolean;
}

// React DOM 事件 replay 会询问 root shell 是否仍处于 dehydrated 状态。
// 当前复刻没有 SSR renderer，但保留这个跨模块断环入口，和官方文件名/API 对齐。
// @beginner: 进入 isRootDehydrated：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isRootDehydrated(root: FiberRoot): boolean {
  // @beginner: 声明 currentState：保存当前步骤需要读取或更新的数据。
  const currentState = root.current.memoizedState as RootState | null;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return currentState?.isDehydrated === true;
}
