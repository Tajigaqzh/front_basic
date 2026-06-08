import { createFiberRoot, updateContainer } from "react-reconciler";
import {
  isContainerMarkedAsRoot,
  markContainerAsRoot,
  unmarkContainerAsRoot,
} from "react-dom-bindings/src/client/ReactDOMComponentTree.js";
import { listenToAllSupportedEvents } from "react-dom-bindings/src/events/DOMPluginEventSystem.js";
import type { FiberRoot } from "react-reconciler/src/ReactInternalTypes.js";
import type { ReactElement } from "shared";

export interface Root {
  render(children: ReactElement | null | undefined): void;
  unmount(): void;
}

export class ReactDOMRoot implements Root {
  private readonly internalRoot: FiberRoot;

  constructor(internalRoot: FiberRoot) {
    this.internalRoot = internalRoot;
  }

  render(children: ReactElement | null | undefined): void {
    updateContainer(children, this.internalRoot);
  }

  unmount(): void {
    updateContainer(null, this.internalRoot);
    unmarkContainerAsRoot(this.internalRoot.containerInfo as Node);
  }
}

export function createRoot(container: Element | DocumentFragment): Root {
  if (!isValidContainer(container)) {
    throw new Error("createRoot(...): Target container is not a DOM element.");
  }

  const root = createFiberRoot(container);
  if (!isContainerMarkedAsRoot(container as Node)) {
    markContainerAsRoot(root.current, container as Node);
  }
  // 官方 createRoot 会在根容器安装一次顶层委托监听，后续事件由插件系统从 target 找 Fiber。
  listenToAllSupportedEvents(container);
  return new ReactDOMRoot(root);
}

function isValidContainer(container: Element | DocumentFragment): boolean {
  return (
    container !== null &&
    (container.nodeType === 1 || container.nodeType === 9 || container.nodeType === 11)
  );
}
