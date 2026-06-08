/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DOMEventName } from "../DOMEventNames.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { AnyNativeEvent } from "../PluginModuleType.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { EventSystemFlags } from "../EventSystemFlags.js";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { FormStatus } from "../../shared/ReactDOMFormActions.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { createSyntheticEvent } from "../SyntheticEvent.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { getFiberCurrentPropsFromNode } from "../../client/ReactDOMComponentTree.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import sanitizeURL from "../../shared/sanitizeURL.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { checkAttributeStringCoercion } from "shared";

// @beginner: 定义 FormAction：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type FormAction = string | ((formData: FormData) => void | Promise<void>) | null;

// @beginner: 声明 pendingFormStatuses：保存当前步骤需要读取或更新的数据。
const pendingFormStatuses = new WeakMap<Fiber, FormStatus>();

// @beginner: 进入 getPendingFormStatus：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getPendingFormStatus(formInst: Fiber): FormStatus | null {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return pendingFormStatuses.get(formInst) ?? null;
}

// @beginner: 进入 coerceFormActionProp：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function coerceFormActionProp(actionProp: unknown): FormAction {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (actionProp === null || actionProp === undefined || typeof actionProp === "symbol" || typeof actionProp === "boolean") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return null;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof actionProp === "function") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return actionProp as (formData: FormData) => void | Promise<void>;
  }
  checkAttributeStringCoercion(actionProp, "action");
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return sanitizeURL(String(actionProp));
}

// @beginner: 进入 createFormData：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function createFormData(form: HTMLFormElement, submitter: HTMLInputElement | HTMLButtonElement | null): FormData {
  // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
  try {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return new FormData(form, submitter ?? undefined);
  // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
  } catch {
    // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
    try {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return new FormData(form);
    // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
    } catch {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return new FormData();
    }
  }
}

// @beginner: 进入 extractEvents：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  maybeTargetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  _eventSystemFlags: EventSystemFlags,
  _targetContainer: EventTarget,
): void {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (domEventName !== "submit" || maybeTargetInst === null || maybeTargetInst.stateNode !== nativeEventTarget) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return;
  }

  // @beginner: 声明 formInst：保存当前步骤需要读取或更新的数据。
  const formInst = maybeTargetInst;
  // @beginner: 声明 form：保存当前步骤需要读取或更新的数据。
  const form = nativeEventTarget as HTMLFormElement;
  // @beginner: 声明 formProps：保存当前步骤需要读取或更新的数据。
  const formProps = getFiberCurrentPropsFromNode(form) ?? formInst.memoizedProps ?? formInst.pendingProps;
  // @beginner: 声明 action：保存当前步骤需要读取或更新的数据。
  let action = coerceFormActionProp(formProps.action);
  // @beginner: 声明 submitter：保存当前步骤需要读取或更新的数据。
  let submitter = (nativeEvent as { submitter?: HTMLInputElement | HTMLButtonElement | null }).submitter ?? null;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (submitter !== null) {
    // @beginner: 声明 submitterProps：保存当前步骤需要读取或更新的数据。
    const submitterProps = getFiberCurrentPropsFromNode(submitter);
    // @beginner: 声明 submitterAction：保存当前步骤需要读取或更新的数据。
    const submitterAction = coerceFormActionProp(submitterProps?.formAction ?? submitter.getAttribute?.("formAction"));
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (submitterAction !== null) {
      action = submitterAction;
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (typeof action === "function") {
        submitter = null;
      }
    }
  }

  // @beginner: 声明 event：保存当前步骤需要读取或更新的数据。
  const event = createSyntheticEvent(nativeEvent);
  event.type = "action";
  event.target = nativeEventTarget;

  // @beginner: 进入 submitForm：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
  function submitForm(): void {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (nativeEvent.defaultPrevented) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof action === "function") {
      event.preventDefault();
      // @beginner: 声明 formData：保存当前步骤需要读取或更新的数据。
      const formData = createFormData(form, submitter);
      // @beginner: 声明 pendingState：保存当前步骤需要读取或更新的数据。
      const pendingState: FormStatus = {
        pending: true,
        data: formData,
        method: form.method,
        action,
      };
      pendingFormStatuses.set(formInst, pendingState);
      action(formData);
    }
  }

  dispatchQueue.push({
    event,
    listeners: [
      {
        instance: null,
        listener: submitForm,
        currentTarget: form,
      },
    ],
  });
}

// @beginner: 进入 dispatchReplayedFormAction：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function dispatchReplayedFormAction(
  formInst: Fiber,
  form: HTMLFormElement,
  action: (formData: FormData) => void | Promise<void>,
  formData: FormData,
): void {
  pendingFormStatuses.set(formInst, {
    pending: true,
    data: formData,
    method: form.method,
    action,
  });
  action(formData);
}
