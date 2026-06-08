import {
  REACT_CACHE_TYPE,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_PROFILER_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_STRICT_MODE_TYPE,
} from "shared";
import type { ElementType, Key, Props, ReactElement, ReactNode } from "shared";

const RESERVED_PROPS = new Set(["key", "__self", "__source"]);

export const Fragment = REACT_FRAGMENT_TYPE;
export const Profiler = REACT_PROFILER_TYPE;
export const Suspense = REACT_SUSPENSE_TYPE;
export const StrictMode = REACT_STRICT_MODE_TYPE;
export const unstable_Cache = REACT_CACHE_TYPE;

export function ReactElement<P extends Props>(
  type: ElementType,
  key: Key,
  props: P,
): ReactElement<P> {
  // ReactElement 是跨包共享的 UI 描述对象。官方源码里它还会记录 owner、
  // debugStack 等开发态字段；这里保留 render 主路径依赖的 type/key/props。
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    props,
  };
}

export function createElement<P extends Props>(
  type: ElementType,
  config: (P & { key?: Key }) | null,
  ...children: ReactNode[]
): ReactElement<P> {
  const props: Props = {};
  let key: Key = null;

  if (config !== null) {
    if (config.key !== undefined && config.key !== null) {
      key = String(config.key);
    }

    for (const propName of Object.keys(config)) {
      if (!RESERVED_PROPS.has(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  if (children.length === 1) {
    props.children = children[0];
  } else if (children.length > 1) {
    props.children = children;
  }

  return ReactElement(type, key, props as P);
}

export function isValidElement(value: unknown): value is ReactElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ReactElement).$$typeof === REACT_ELEMENT_TYPE
  );
}
