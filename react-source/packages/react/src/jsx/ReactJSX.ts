import { createElement, Fragment } from "./ReactJSXElement.js";
import type { ElementType, Key, Props, ReactElement } from "shared";

export { Fragment };

export function jsx<P extends Props>(
  type: ElementType,
  props: P & { key?: Key },
  key?: Key,
): ReactElement<P> {
  return createElement(type, { ...props, key: key ?? props.key } as P & { key?: Key });
}

export const jsxs = jsx;
