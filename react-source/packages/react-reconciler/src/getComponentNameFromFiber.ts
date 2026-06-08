import getComponentNameFromType from "shared/getComponentNameFromType.js";
import type { Fiber } from "./ReactInternalTypes.js";
import { HostComponent, HostRoot, HostText } from "./ReactWorkTags.js";

export default function getComponentNameFromFiber(fiber: Fiber): string | null {
  switch (fiber.tag) {
    case HostRoot:
      return "Root";
    case HostComponent:
      return typeof fiber.type === "string" ? fiber.type : null;
    case HostText:
      return "Text";
    default:
      return getComponentNameFromType(fiber.type);
  }
}
