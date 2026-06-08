import type { ReactComponentInfo } from "./ReactTypes.js";
import { describeBuiltInComponentFrame } from "./ReactComponentStackFrame.js";
import { formatOwnerStack } from "./ReactOwnerStackFrames.js";

/**
 * Server Component debugInfo 里没有 Fiber，只保存了组件名、owner 和 debugStack。
 * 这个函数沿 `owner` 链把这些 debugStack 拼成和 Fiber owner stack 一致的文本。
 */
export function getOwnerStackByComponentInfoInDev(
  componentInfo: ReactComponentInfo,
): string {
  try {
    let info = "";

    if (!componentInfo.owner && typeof componentInfo.name === "string") {
      return describeBuiltInComponentFrame(componentInfo.name);
    }

    let owner: ReactComponentInfo | null | undefined = componentInfo;

    while (owner) {
      const ownerStack = owner.debugStack;
      if (ownerStack != null) {
        owner = owner.owner;
        if (owner) {
          const formattedStack = formatOwnerStack(ownerStack);
          if (formattedStack !== "") {
            info += `\n${formattedStack}`;
          }
        }
      } else {
        break;
      }
    }

    return info;
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    return `\nError generating stack: ${message}`;
  }
}
