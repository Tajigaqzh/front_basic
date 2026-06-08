import {
  REACT_ELEMENT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_VIEW_TRANSITION_TYPE,
} from "./ReactSymbols.js";
import isArray from "./isArray.js";
import getPrototypeOf from "./getPrototypeOf.js";
import { enableViewTransition } from "./ReactFeatureFlags.js";

export const jsxPropsParents: WeakMap<object, unknown> = new WeakMap();
export const jsxChildrenParents: WeakMap<object, unknown> = new WeakMap();

const CLIENT_REFERENCE_TAG = Symbol.for("react.client.reference");

type AnyRecord = Record<string, unknown> & {
  $$typeof?: symbol;
  type?: unknown;
  render?: unknown;
  _payload?: unknown;
  _init?: (payload: unknown) => unknown;
};

function isObjectPrototype(object: unknown): boolean {
  if (!object) {
    return false;
  }
  const ObjectPrototype = Object.prototype;
  if (object === ObjectPrototype) {
    return true;
  }
  if (getPrototypeOf(object)) {
    return false;
  }

  const names = Object.getOwnPropertyNames(object);
  for (let i = 0; i < names.length; i += 1) {
    if (!(names[i] in ObjectPrototype)) {
      return false;
    }
  }
  return true;
}

export function isGetter(object: unknown, name: string): boolean {
  const ObjectPrototype = Object.prototype;
  if (object === ObjectPrototype || object === null) {
    return false;
  }
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  if (descriptor === undefined) {
    return isGetter(getPrototypeOf(object), name);
  }
  return typeof descriptor.get === "function";
}

export function isSimpleObject(object: unknown): boolean {
  if (!isObjectPrototype(getPrototypeOf(object))) {
    return false;
  }
  const names = Object.getOwnPropertyNames(object);
  for (let i = 0; i < names.length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(object, names[i]);
    if (!descriptor) {
      return false;
    }
    if (!descriptor.enumerable) {
      if (
        (names[i] === "key" || names[i] === "ref") &&
        typeof descriptor.get === "function"
      ) {
        continue;
      }
      return false;
    }
  }
  return true;
}

export function objectName(object: unknown): string {
  const name = Object.prototype.toString.call(object);
  return name.slice(8, name.length - 1);
}

function describeKeyForErrorMessage(key: string): string {
  const encodedKey = JSON.stringify(key);
  return `"${key}"` === encodedKey ? key : encodedKey;
}

function describeClientReference(_ref: unknown): string {
  return "client";
}

export function describeValueForErrorMessage(value: unknown): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value.length <= 10 ? value : `${value.slice(0, 10)}...`);
    case "object": {
      if (isArray(value)) {
        return "[...]";
      }
      if (value !== null && (value as AnyRecord).$$typeof === CLIENT_REFERENCE_TAG) {
        return describeClientReference(value);
      }
      const name = objectName(value);
      return name === "Object" ? "{...}" : name;
    }
    case "function": {
      if ((value as unknown as AnyRecord).$$typeof === CLIENT_REFERENCE_TAG) {
        return describeClientReference(value);
      }
      const fn = value as Function & { displayName?: string };
      const name = fn.displayName || fn.name;
      return name ? `function ${name}` : "function";
    }
    default:
      return String(value);
  }
}

function describeElementType(type: unknown): string {
  if (typeof type === "string") {
    return type;
  }
  switch (type) {
    case REACT_SUSPENSE_TYPE:
      return "Suspense";
    case REACT_SUSPENSE_LIST_TYPE:
      return "SuspenseList";
    case REACT_VIEW_TRANSITION_TYPE:
      return enableViewTransition ? "ViewTransition" : "";
  }

  if (typeof type === "object" && type !== null) {
    const elementType = type as AnyRecord;
    switch (elementType.$$typeof) {
      case REACT_FORWARD_REF_TYPE:
        return describeElementType(elementType.render);
      case REACT_MEMO_TYPE:
        return describeElementType(elementType.type);
      case REACT_LAZY_TYPE:
        try {
          return describeElementType(elementType._init?.(elementType._payload));
        } catch {
          return "";
        }
    }
  }
  return "";
}

function appendHighlighted(
  str: string,
  expandedName: string | undefined,
  start: number,
  length: number,
): string {
  if (expandedName === undefined) {
    return str;
  }
  if (start > -1 && length > 0) {
    return `\n  ${str}\n  ${" ".repeat(start)}${"^".repeat(length)}`;
  }
  return `\n  ${str}`;
}

/**
 * 把对象、数组和 JSX props 压缩成错误提示里的一小段可读文本。
 * `expandedName` 对应出错字段名；命中时会追加一行 `^^^^` 指示具体片段。
 */
export function describeObjectForErrorMessage(
  objectOrArray: Record<string | number, unknown> | readonly unknown[],
  expandedName?: string,
): string {
  const objKind = objectName(objectOrArray);
  if (objKind !== "Object" && objKind !== "Array") {
    return objKind;
  }

  let str = "";
  let start = -1;
  let length = 0;

  if (isArray(objectOrArray)) {
    if (jsxChildrenParents.has(objectOrArray)) {
      const type = jsxChildrenParents.get(objectOrArray);
      str = `<${describeElementType(type)}>`;
      for (let i = 0; i < objectOrArray.length; i += 1) {
        const value = objectOrArray[i];
        let substr: string;
        if (typeof value === "string") {
          substr = value;
        } else if (typeof value === "object" && value !== null) {
          substr = `{${describeObjectForErrorMessage(value as Record<string, unknown>)}}`;
        } else {
          substr = `{${describeValueForErrorMessage(value)}}`;
        }
        if (`${i}` === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        } else if (substr.length < 15 && str.length + substr.length < 40) {
          str += substr;
        } else {
          str += "{...}";
        }
      }
      str += `</${describeElementType(type)}>`;
    } else {
      str = "[";
      for (let i = 0; i < objectOrArray.length; i += 1) {
        if (i > 0) {
          str += ", ";
        }
        const value = objectOrArray[i];
        const substr =
          typeof value === "object" && value !== null
            ? describeObjectForErrorMessage(value as Record<string, unknown>)
            : describeValueForErrorMessage(value);
        if (`${i}` === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        } else if (substr.length < 10 && str.length + substr.length < 40) {
          str += substr;
        } else {
          str += "...";
        }
      }
      str += "]";
    }
  } else {
    const object = objectOrArray as AnyRecord;
    if (object.$$typeof === REACT_ELEMENT_TYPE) {
      str = `<${describeElementType(object.type)}/>`;
    } else if (object.$$typeof === CLIENT_REFERENCE_TAG) {
      return describeClientReference(object);
    } else if (jsxPropsParents.has(object)) {
      const type = jsxPropsParents.get(object);
      str = `<${describeElementType(type) || "..."}`;
      const names = Object.keys(object);
      for (let i = 0; i < names.length; i += 1) {
        str += " ";
        const name = names[i];
        str += `${describeKeyForErrorMessage(name)}=`;
        const value = object[name];
        let substr =
          typeof value === "object" && value !== null
            ? describeObjectForErrorMessage(value as Record<string, unknown>)
            : describeValueForErrorMessage(value);
        if (typeof value !== "string") {
          substr = `{${substr}}`;
        }
        if (name === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        } else if (substr.length < 10 && str.length + substr.length < 40) {
          str += substr;
        } else {
          str += "...";
        }
      }
      str += ">";
    } else {
      str = "{";
      const names = Object.keys(object);
      for (let i = 0; i < names.length; i += 1) {
        if (i > 0) {
          str += ", ";
        }
        const name = names[i];
        str += `${describeKeyForErrorMessage(name)}: `;
        const value = object[name];
        const substr =
          typeof value === "object" && value !== null
            ? describeObjectForErrorMessage(value as Record<string, unknown>)
            : describeValueForErrorMessage(value);
        if (name === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        } else if (substr.length < 10 && str.length + substr.length < 40) {
          str += substr;
        } else {
          str += "...";
        }
      }
      str += "}";
    }
  }

  return appendHighlighted(str, expandedName, start, length);
}
