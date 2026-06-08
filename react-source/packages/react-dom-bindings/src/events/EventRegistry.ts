import type { DOMEventName } from "./DOMEventNames.js";

export const allNativeEvents: Set<DOMEventName> = new Set();

export const registrationNameDependencies: Record<string, DOMEventName[]> = {};
export const possibleRegistrationNames: Record<string, string> = {};

export function registerTwoPhaseEvent(
  registrationName: string,
  dependencies: DOMEventName[],
): void {
  registerDirectEvent(registrationName, dependencies);
  registerDirectEvent(`${registrationName}Capture`, dependencies);
}

export function registerDirectEvent(
  registrationName: string,
  dependencies: DOMEventName[],
): void {
  // 官方这里会在 DEV 下检查重复注册。当前保留覆盖语义，方便插件重复初始化。
  registrationNameDependencies[registrationName] = dependencies;
  possibleRegistrationNames[registrationName.toLowerCase()] = registrationName;
  if (registrationName === "onDoubleClick") {
    possibleRegistrationNames.ondblclick = registrationName;
  }

  for (const dependency of dependencies) {
    allNativeEvents.add(dependency);
  }
}
