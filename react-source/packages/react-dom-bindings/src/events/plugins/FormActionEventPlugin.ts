import type { Fiber } from "react-reconciler/src/ReactInternalTypes.js";
import type { DOMEventName } from "../DOMEventNames.js";
import type { AnyNativeEvent } from "../PluginModuleType.js";
import type { DispatchQueue } from "../DOMPluginEventSystem.js";
import type { EventSystemFlags } from "../EventSystemFlags.js";
import type { FormStatus } from "../../shared/ReactDOMFormActions.js";
import { createSyntheticEvent } from "../SyntheticEvent.js";
import { getFiberCurrentPropsFromNode } from "../../client/ReactDOMComponentTree.js";
import sanitizeURL from "../../shared/sanitizeURL.js";
import { checkAttributeStringCoercion } from "shared";

export type FormAction = string | ((formData: FormData) => void | Promise<void>) | null;

const pendingFormStatuses = new WeakMap<Fiber, FormStatus>();

export function getPendingFormStatus(formInst: Fiber): FormStatus | null {
  return pendingFormStatuses.get(formInst) ?? null;
}

function coerceFormActionProp(actionProp: unknown): FormAction {
  if (actionProp === null || actionProp === undefined || typeof actionProp === "symbol" || typeof actionProp === "boolean") {
    return null;
  }
  if (typeof actionProp === "function") {
    return actionProp as (formData: FormData) => void | Promise<void>;
  }
  checkAttributeStringCoercion(actionProp, "action");
  return sanitizeURL(String(actionProp));
}

function createFormData(form: HTMLFormElement, submitter: HTMLInputElement | HTMLButtonElement | null): FormData {
  try {
    return new FormData(form, submitter ?? undefined);
  } catch {
    try {
      return new FormData(form);
    } catch {
      return new FormData();
    }
  }
}

export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  maybeTargetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  _eventSystemFlags: EventSystemFlags,
  _targetContainer: EventTarget,
): void {
  if (domEventName !== "submit" || maybeTargetInst === null || maybeTargetInst.stateNode !== nativeEventTarget) {
    return;
  }

  const formInst = maybeTargetInst;
  const form = nativeEventTarget as HTMLFormElement;
  const formProps = getFiberCurrentPropsFromNode(form) ?? formInst.memoizedProps ?? formInst.pendingProps;
  let action = coerceFormActionProp(formProps.action);
  let submitter = (nativeEvent as { submitter?: HTMLInputElement | HTMLButtonElement | null }).submitter ?? null;

  if (submitter !== null) {
    const submitterProps = getFiberCurrentPropsFromNode(submitter);
    const submitterAction = coerceFormActionProp(submitterProps?.formAction ?? submitter.getAttribute?.("formAction"));
    if (submitterAction !== null) {
      action = submitterAction;
      if (typeof action === "function") {
        submitter = null;
      }
    }
  }

  const event = createSyntheticEvent(nativeEvent);
  event.type = "action";
  event.target = nativeEventTarget;

  function submitForm(): void {
    if (nativeEvent.defaultPrevented) {
      return;
    }

    if (typeof action === "function") {
      event.preventDefault();
      const formData = createFormData(form, submitter);
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
