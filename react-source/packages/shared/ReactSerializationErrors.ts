/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  REACT_ELEMENT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_VIEW_TRANSITION_TYPE,
} from "./ReactSymbols.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import isArray from "./isArray.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getPrototypeOf from "./getPrototypeOf.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { enableViewTransition } from "./ReactFeatureFlags.js";

// @beginner: 声明 jsxPropsParents：保存当前步骤需要读取或更新的数据。
export const jsxPropsParents: WeakMap<object, unknown> = new WeakMap();
// @beginner: 声明 jsxChildrenParents：保存当前步骤需要读取或更新的数据。
export const jsxChildrenParents: WeakMap<object, unknown> = new WeakMap();

// @beginner: 声明 CLIENT_REFERENCE_TAG：保存当前步骤需要读取或更新的数据。
const CLIENT_REFERENCE_TAG = Symbol.for("react.client.reference");

// @beginner: 定义 AnyRecord：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type AnyRecord = Record<string, unknown> & {
  $$typeof?: symbol;
  type?: unknown;
  render?: unknown;
  _payload?: unknown;
  _init?: (payload: unknown) => unknown;
};

// @beginner: 进入 isObjectPrototype：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function isObjectPrototype(object: unknown): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!object) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 声明 ObjectPrototype：保存当前步骤需要读取或更新的数据。
  const ObjectPrototype = Object.prototype;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (object === ObjectPrototype) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (getPrototypeOf(object)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 声明 names：保存当前步骤需要读取或更新的数据。
  const names = Object.getOwnPropertyNames(object);
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (let i = 0; i < names.length; i += 1) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!(names[i] in ObjectPrototype)) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 isGetter：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isGetter(object: unknown, name: string): boolean {
  // @beginner: 声明 ObjectPrototype：保存当前步骤需要读取或更新的数据。
  const ObjectPrototype = Object.prototype;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (object === ObjectPrototype || object === null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 声明 descriptor：保存当前步骤需要读取或更新的数据。
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (descriptor === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return isGetter(getPrototypeOf(object), name);
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return typeof descriptor.get === "function";
}

// @beginner: 进入 isSimpleObject：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isSimpleObject(object: unknown): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (!isObjectPrototype(getPrototypeOf(object))) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 声明 names：保存当前步骤需要读取或更新的数据。
  const names = Object.getOwnPropertyNames(object);
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (let i = 0; i < names.length; i += 1) {
    // @beginner: 声明 descriptor：保存当前步骤需要读取或更新的数据。
    const descriptor = Object.getOwnPropertyDescriptor(object, names[i]);
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!descriptor) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!descriptor.enumerable) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (
        (names[i] === "key" || names[i] === "ref") &&
        typeof descriptor.get === "function"
      ) {
        continue;
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return false;
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}

// @beginner: 进入 objectName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function objectName(object: unknown): string {
  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = Object.prototype.toString.call(object);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return name.slice(8, name.length - 1);
}

// @beginner: 进入 describeKeyForErrorMessage：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeKeyForErrorMessage(key: string): string {
  // @beginner: 声明 encodedKey：保存当前步骤需要读取或更新的数据。
  const encodedKey = JSON.stringify(key);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return `"${key}"` === encodedKey ? key : encodedKey;
}

// @beginner: 进入 describeClientReference：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeClientReference(_ref: unknown): string {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return "client";
}

// @beginner: 进入 describeValueForErrorMessage：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeValueForErrorMessage(value: unknown): string {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (typeof value) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "string":
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return JSON.stringify(value.length <= 10 ? value : `${value.slice(0, 10)}...`);
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "object": {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (isArray(value)) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return "[...]";
      }
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (value !== null && (value as AnyRecord).$$typeof === CLIENT_REFERENCE_TAG) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return describeClientReference(value);
      }
      // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
      const name = objectName(value);
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return name === "Object" ? "{...}" : name;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "function": {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if ((value as unknown as AnyRecord).$$typeof === CLIENT_REFERENCE_TAG) {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return describeClientReference(value);
      }
      // @beginner: 声明 fn：保存当前步骤需要读取或更新的数据。
      const fn = value as Function & { displayName?: string };
      // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
      const name = fn.displayName || fn.name;
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return name ? `function ${name}` : "function";
    }
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return String(value);
  }
}

// @beginner: 进入 describeElementType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function describeElementType(type: unknown): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof type === "string") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return type;
  }
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (type) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case REACT_SUSPENSE_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "Suspense";
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case REACT_SUSPENSE_LIST_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return "SuspenseList";
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case REACT_VIEW_TRANSITION_TYPE:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return enableViewTransition ? "ViewTransition" : "";
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof type === "object" && type !== null) {
    // @beginner: 声明 elementType：保存当前步骤需要读取或更新的数据。
    const elementType = type as AnyRecord;
    // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
    switch (elementType.$$typeof) {
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_FORWARD_REF_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return describeElementType(elementType.render);
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_MEMO_TYPE:
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return describeElementType(elementType.type);
      // @beginner: 匹配到这个 case 后，只处理这一类输入。
      case REACT_LAZY_TYPE:
        // @beginner: 保护性执行：这段逻辑可能抛错，catch/finally 会负责收尾。
        try {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return describeElementType(elementType._init?.(elementType._payload));
        // @beginner: 错误处理分支：把上面 try 中抛出的异常转换成 React 可处理的状态。
        } catch {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return "";
        }
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return "";
}

// @beginner: 进入 appendHighlighted：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function appendHighlighted(
  str: string,
  expandedName: string | undefined,
  start: number,
  length: number,
): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (expandedName === undefined) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return str;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (start > -1 && length > 0) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return `\n  ${str}\n  ${" ".repeat(start)}${"^".repeat(length)}`;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return `\n  ${str}`;
}

/**
 * 把对象、数组和 JSX props 压缩成错误提示里的一小段可读文本。
 * `expandedName` 对应出错字段名；命中时会追加一行 `^^^^` 指示具体片段。
 */
// @beginner: 进入 describeObjectForErrorMessage：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function describeObjectForErrorMessage(
  objectOrArray: Record<string | number, unknown> | readonly unknown[],
  expandedName?: string,
): string {
  // @beginner: 声明 objKind：保存当前步骤需要读取或更新的数据。
  const objKind = objectName(objectOrArray);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (objKind !== "Object" && objKind !== "Array") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return objKind;
  }

  // @beginner: 声明 str：保存当前步骤需要读取或更新的数据。
  let str = "";
  // @beginner: 声明 start：保存当前步骤需要读取或更新的数据。
  let start = -1;
  // @beginner: 声明 length：保存当前步骤需要读取或更新的数据。
  let length = 0;

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (isArray(objectOrArray)) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (jsxChildrenParents.has(objectOrArray)) {
      // @beginner: 声明 type：保存当前步骤需要读取或更新的数据。
      const type = jsxChildrenParents.get(objectOrArray);
      str = `<${describeElementType(type)}>`;
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      for (let i = 0; i < objectOrArray.length; i += 1) {
        // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
        const value = objectOrArray[i];
        // @beginner: 声明 substr：保存当前步骤需要读取或更新的数据。
        let substr: string;
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof value === "string") {
          substr = value;
        // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
        } else if (typeof value === "object" && value !== null) {
          substr = `{${describeObjectForErrorMessage(value as Record<string, unknown>)}}`;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          substr = `{${describeValueForErrorMessage(value)}}`;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (`${i}` === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
        } else if (substr.length < 15 && str.length + substr.length < 40) {
          str += substr;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          str += "{...}";
        }
      }
      str += `</${describeElementType(type)}>`;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      str = "[";
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      for (let i = 0; i < objectOrArray.length; i += 1) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (i > 0) {
          str += ", ";
        }
        // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
        const value = objectOrArray[i];
        // @beginner: 声明 substr：保存当前步骤需要读取或更新的数据。
        const substr =
          typeof value === "object" && value !== null
            ? describeObjectForErrorMessage(value as Record<string, unknown>)
            : describeValueForErrorMessage(value);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (`${i}` === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
        } else if (substr.length < 10 && str.length + substr.length < 40) {
          str += substr;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          str += "...";
        }
      }
      str += "]";
    }
  // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
  } else {
    // @beginner: 声明 object：保存当前步骤需要读取或更新的数据。
    const object = objectOrArray as AnyRecord;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (object.$$typeof === REACT_ELEMENT_TYPE) {
      str = `<${describeElementType(object.type)}/>`;
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (object.$$typeof === CLIENT_REFERENCE_TAG) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return describeClientReference(object);
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (jsxPropsParents.has(object)) {
      // @beginner: 声明 type：保存当前步骤需要读取或更新的数据。
      const type = jsxPropsParents.get(object);
      str = `<${describeElementType(type) || "..."}`;
      // @beginner: 声明 names：保存当前步骤需要读取或更新的数据。
      const names = Object.keys(object);
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      for (let i = 0; i < names.length; i += 1) {
        str += " ";
        // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
        const name = names[i];
        str += `${describeKeyForErrorMessage(name)}=`;
        // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
        const value = object[name];
        // @beginner: 声明 substr：保存当前步骤需要读取或更新的数据。
        let substr =
          typeof value === "object" && value !== null
            ? describeObjectForErrorMessage(value as Record<string, unknown>)
            : describeValueForErrorMessage(value);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (typeof value !== "string") {
          substr = `{${substr}}`;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (name === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
        } else if (substr.length < 10 && str.length + substr.length < 40) {
          str += substr;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          str += "...";
        }
      }
      str += ">";
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      str = "{";
      // @beginner: 声明 names：保存当前步骤需要读取或更新的数据。
      const names = Object.keys(object);
      // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
      for (let i = 0; i < names.length; i += 1) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (i > 0) {
          str += ", ";
        }
        // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
        const name = names[i];
        str += `${describeKeyForErrorMessage(name)}: `;
        // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
        const value = object[name];
        // @beginner: 声明 substr：保存当前步骤需要读取或更新的数据。
        const substr =
          typeof value === "object" && value !== null
            ? describeObjectForErrorMessage(value as Record<string, unknown>)
            : describeValueForErrorMessage(value);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (name === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
        } else if (substr.length < 10 && str.length + substr.length < 40) {
          str += substr;
        // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
        } else {
          str += "...";
        }
      }
      str += "}";
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return appendHighlighted(str, expandedName, start, length);
}
