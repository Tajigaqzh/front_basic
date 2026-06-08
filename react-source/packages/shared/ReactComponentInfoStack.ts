/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ReactComponentInfo } from "./ReactTypes.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { describeBuiltInComponentFrame } from "./ReactComponentStackFrame.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { formatOwnerStack } from "./ReactOwnerStackFrames.js";

/**
 * Server Component debugInfo 里没有 Fiber，只保存了组件名、owner 和 debugStack。
 * 这个函数沿 `owner` 链把这些 debugStack 拼成和 Fiber owner stack 一致的文本。
 */
// @beginner: 进入 getOwnerStackByComponentInfoInDev：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getOwnerStackByComponentInfoInDev(
  componentInfo: ReactComponentInfo,
): string {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 声明 info：保存当前步骤需要读取或更新的数据。
    let info = "";

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!componentInfo.owner && typeof componentInfo.name === "string") {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return describeBuiltInComponentFrame(componentInfo.name);
    }

    // @beginner: 声明 owner：保存当前步骤需要读取或更新的数据。
    let owner: ReactComponentInfo | null | undefined = componentInfo;

    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    while (owner) {
      // @beginner: 声明 ownerStack：保存当前步骤需要读取或更新的数据。
      const ownerStack = owner.debugStack;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (ownerStack != null) {
        owner = owner.owner;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (owner) {
          // @beginner: 声明 formattedStack：保存当前步骤需要读取或更新的数据。
          const formattedStack = formatOwnerStack(ownerStack);
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (formattedStack !== "") {
            info += `\n${formattedStack}`;
          }
        }
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        break;
      }
    }

    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return info;
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch (error) {
    // @beginner: 声明 message：保存当前步骤需要读取或更新的数据。
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return `\nError generating stack: ${message}`;
  }
}
