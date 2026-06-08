/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { OMITTED_PROP_ERROR } from "./ReactFlightPropertyAccess.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import hasOwnProperty from "./hasOwnProperty.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import isArray from "./isArray.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import { REACT_ELEMENT_TYPE } from "./ReactSymbols.js";
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import getComponentNameFromType from "./getComponentNameFromType.js";

// @beginner: 定义 PropertyEntry：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type PropertyEntry = [string, string];
// @beginner: 定义 AnyRecord：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type AnyRecord = Record<string, unknown> & {
  $$typeof?: unknown;
  type?: unknown;
  key?: unknown;
  props?: Record<string, unknown>;
  status?: unknown;
  value?: unknown;
  reason?: unknown;
};

// @beginner: 声明 EMPTY_ARRAY：保存当前步骤需要读取或更新的数据。
const EMPTY_ARRAY = 0;
// @beginner: 声明 COMPLEX_ARRAY：保存当前步骤需要读取或更新的数据。
const COMPLEX_ARRAY = 1;
// @beginner: 声明 PRIMITIVE_ARRAY：保存当前步骤需要读取或更新的数据。
const PRIMITIVE_ARRAY = 2;
// @beginner: 声明 ENTRIES_ARRAY：保存当前步骤需要读取或更新的数据。
const ENTRIES_ARRAY = 3;
// @beginner: 声明 OBJECT_WIDTH_LIMIT：保存当前步骤需要读取或更新的数据。
const OBJECT_WIDTH_LIMIT = 100;

// @beginner: 进入 getArrayKind：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getArrayKind(array: unknown[]): 0 | 1 | 2 | 3 {
  // @beginner: 声明 kind：保存当前步骤需要读取或更新的数据。
  let kind: 0 | 1 | 2 | 3 = EMPTY_ARRAY;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (let i = 0; i < array.length && i < OBJECT_WIDTH_LIMIT; i += 1) {
    // @beginner: 声明 value：保存当前步骤需要读取或更新的数据。
    const value = array[i];
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (typeof value === "object" && value !== null) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (isArray(value) && value.length === 2 && typeof value[0] === "string") {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (kind !== EMPTY_ARRAY && kind !== ENTRIES_ARRAY) {
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return COMPLEX_ARRAY;
        }
        kind = ENTRIES_ARRAY;
      // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
      } else {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return COMPLEX_ARRAY;
      }
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (typeof value === "function") {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return COMPLEX_ARRAY;
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (typeof value === "string" && value.length > 50) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return COMPLEX_ARRAY;
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (kind !== EMPTY_ARRAY && kind !== PRIMITIVE_ARRAY) {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return COMPLEX_ARRAY;
    // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
    } else if (typeof value === "bigint") {
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return COMPLEX_ARRAY;
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      kind = PRIMITIVE_ARRAY;
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return kind;
}

// @beginner: 进入 addObjectToProperties：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addObjectToProperties(
  object: Record<string, unknown>,
  properties: PropertyEntry[],
  indent: number,
  prefix: string,
): void {
  // @beginner: 声明 addedProperties：保存当前步骤需要读取或更新的数据。
  let addedProperties = 0;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const key in object) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (hasOwnProperty.call(object, key) && key[0] !== "_") {
      addedProperties += 1;
      addValueToProperties(key, object[key], properties, indent, prefix);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (addedProperties >= OBJECT_WIDTH_LIMIT) {
        properties.push([
          `${prefix}${"\xa0\xa0".repeat(indent)}Only ${OBJECT_WIDTH_LIMIT} properties are shown. React will not log more properties of this object.`,
          "",
        ]);
        break;
      }
    }
  }
}

// @beginner: 进入 readReactElementTypeof：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function readReactElementTypeof(value: AnyRecord): unknown {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return "$$typeof" in value && hasOwnProperty.call(value, "$$typeof")
    ? value.$$typeof
    : undefined;
}

// @beginner: 进入 getObjectName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getObjectName(value: object): string {
  // @beginner: 声明 objectToString：保存当前步骤需要读取或更新的数据。
  const objectToString = Object.prototype.toString.call(value);
  // @beginner: 声明 objectName：保存当前步骤需要读取或更新的数据。
  let objectName = objectToString.slice(8, objectToString.length - 1);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (objectName === "Object") {
    // @beginner: 声明 proto：保存当前步骤需要读取或更新的数据。
    const proto = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null;
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (proto && typeof proto.constructor === "function") {
      objectName = proto.constructor.name || objectName;
    }
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return objectName;
}

/**
 * 把值展开成 performance track 属性行。与官方逻辑一致，ReactElement、Promise、
 * entries array、普通对象会被递归展开，过深或过宽时用省略号收敛。
 */
// @beginner: 进入 addValueToProperties：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addValueToProperties(
  propertyName: string,
  value: unknown,
  properties: PropertyEntry[],
  indent: number,
  prefix: string,
): void {
  // @beginner: 声明 desc：保存当前步骤需要读取或更新的数据。
  let desc: string;

  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (typeof value) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "object":
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (value === null) {
        desc = "null";
        break;
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (readReactElementTypeof(value as AnyRecord) === REACT_ELEMENT_TYPE) {
        // @beginner: 声明 element：保存当前步骤需要读取或更新的数据。
        const element = value as AnyRecord;
        // @beginner: 声明 typeName：保存当前步骤需要读取或更新的数据。
        const typeName = getComponentNameFromType(element.type) || "\u2026";
        // @beginner: 声明 key：保存当前步骤需要读取或更新的数据。
        const key = element.key;
        // @beginner: 声明 props：保存当前步骤需要读取或更新的数据。
        const props = element.props ?? {};
        // @beginner: 声明 propsKeys：保存当前步骤需要读取或更新的数据。
        const propsKeys = Object.keys(props);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (key == null && propsKeys.length === 0) {
          desc = `<${typeName} />`;
          break;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (indent < 3 || (propsKeys.length === 1 && propsKeys[0] === "children" && key == null)) {
          desc = `<${typeName} \u2026 />`;
          break;
        }

        properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, `<${typeName}`]);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (key !== null && key !== undefined) {
          addValueToProperties("key", key, properties, indent + 1, prefix);
        }
        // @beginner: 声明 hasChildren：保存当前步骤需要读取或更新的数据。
        let hasChildren = false;
        // @beginner: 声明 addedProperties：保存当前步骤需要读取或更新的数据。
        let addedProperties = 0;
        // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
        for (const propKey in props) {
          addedProperties += 1;
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (propKey === "children") {
            // @beginner: 条件分支：根据当前值选择不同处理路径。
            if (props.children != null && (!isArray(props.children) || props.children.length > 0)) {
              hasChildren = true;
            }
          // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
          } else if (hasOwnProperty.call(props, propKey) && propKey[0] !== "_") {
            addValueToProperties(propKey, props[propKey], properties, indent + 1, prefix);
          }
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (addedProperties >= OBJECT_WIDTH_LIMIT) {
            break;
          }
        }
        properties.push(["", hasChildren ? `>\u2026</${typeName}>` : "/>"]);
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (isArray(value)) {
        // @beginner: 声明 array：保存当前步骤需要读取或更新的数据。
        const array = value as unknown[];
        // @beginner: 声明 didTruncate：保存当前步骤需要读取或更新的数据。
        const didTruncate = array.length > OBJECT_WIDTH_LIMIT;
        // @beginner: 声明 kind：保存当前步骤需要读取或更新的数据。
        const kind = getArrayKind(array);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (kind === PRIMITIVE_ARRAY || kind === EMPTY_ARRAY) {
          desc = JSON.stringify(
            didTruncate ? array.slice(0, OBJECT_WIDTH_LIMIT).concat("\u2026") : array,
          ) ?? "undefined";
          break;
        }
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (kind === ENTRIES_ARRAY) {
          properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, ""]);
          // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
          for (let i = 0; i < array.length && i < OBJECT_WIDTH_LIMIT; i += 1) {
            // @beginner: 声明 entry：保存当前步骤需要读取或更新的数据。
            const entry = array[i] as [string, unknown];
            addValueToProperties(entry[0], entry[1], properties, indent + 1, prefix);
          }
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (didTruncate) {
            addValueToProperties(OBJECT_WIDTH_LIMIT.toString(), "\u2026", properties, indent + 1, prefix);
          }
          // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
          return;
        }
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (value instanceof Error) {
        properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, value.name || "Error"]);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (indent < 3) {
          addValueToProperties("message", value.message, properties, indent + 1, prefix);
        }
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (value instanceof Date) {
        desc = Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
        break;
      }

      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if ((value as AnyRecord).status === "fulfilled") {
        // @beginner: 声明 idx：保存当前步骤需要读取或更新的数据。
        const idx = properties.length;
        addValueToProperties(propertyName, (value as AnyRecord).value, properties, indent, prefix);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (properties.length > idx) {
          properties[idx][1] = `Promise<${properties[idx][1] || "Object"}>`;
        }
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if ((value as AnyRecord).status === "rejected") {
        // @beginner: 声明 idx：保存当前步骤需要读取或更新的数据。
        const idx = properties.length;
        addValueToProperties(propertyName, (value as AnyRecord).reason, properties, indent, prefix);
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (properties.length > idx) {
          properties[idx][1] = `Rejected Promise<${properties[idx][1]}>`;
        }
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return;
      }

      properties.push([
        `${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`,
        getObjectName(value) === "Object" ? (indent < 3 ? "" : "\u2026") : getObjectName(value),
      ]);
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (indent < 3) {
        addObjectToProperties(value as Record<string, unknown>, properties, indent + 1, prefix);
      }
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "function": {
      // @beginner: 声明 functionName：保存当前步骤需要读取或更新的数据。
      const functionName = (value as Function).name;
      desc = functionName === "" || typeof functionName !== "string" ? "() => {}" : `${functionName}() {}`;
      break;
    }
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "string":
      desc =
        value === OMITTED_PROP_ERROR
          ? "\u2026"
          : JSON.stringify(value.length >= 1024 ? `${value.slice(0, 1023)}\u2026` : value) ?? "\"\"";
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "undefined":
      desc = "undefined";
      break;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case "boolean":
      desc = value ? "true" : "false";
      break;
    // @beginner: 默认分支：没有命中前面任何 case 时使用。
    default:
      desc = String(value);
  }

  properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, desc]);
}

// @beginner: 声明 REMOVED：保存当前步骤需要读取或更新的数据。
const REMOVED = "-\xa0";
// @beginner: 声明 ADDED：保存当前步骤需要读取或更新的数据。
const ADDED = "+\xa0";
// @beginner: 声明 UNCHANGED：保存当前步骤需要读取或更新的数据。
const UNCHANGED = "\u2007\xa0";

// @beginner: 进入 addObjectDiffToProperties：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function addObjectDiffToProperties(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  properties: PropertyEntry[],
  indent: number,
): boolean {
  // @beginner: 声明 isDeeplyEqual：保存当前步骤需要读取或更新的数据。
  let isDeeplyEqual = true;
  // @beginner: 声明 prevPropertiesChecked：保存当前步骤需要读取或更新的数据。
  let prevPropertiesChecked = 0;

  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const key in prev) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (prevPropertiesChecked > OBJECT_WIDTH_LIMIT) {
      properties.push([
        `Previous object has more than ${OBJECT_WIDTH_LIMIT} properties. React will not attempt to diff objects with too many properties.`,
        "",
      ]);
      isDeeplyEqual = false;
      break;
    }
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (!(key in next)) {
      properties.push([`${REMOVED}${"\xa0\xa0".repeat(indent)}${key}`, "\u2026"]);
      isDeeplyEqual = false;
    }
    prevPropertiesChecked += 1;
  }

  // @beginner: 声明 nextPropertiesChecked：保存当前步骤需要读取或更新的数据。
  let nextPropertiesChecked = 0;
  // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
  for (const key in next) {
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (nextPropertiesChecked > OBJECT_WIDTH_LIMIT) {
      properties.push([
        `Next object has more than ${OBJECT_WIDTH_LIMIT} properties. React will not attempt to diff objects with too many properties.`,
        "",
      ]);
      isDeeplyEqual = false;
      break;
    }

    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (key in prev) {
      // @beginner: 声明 prevValue：保存当前步骤需要读取或更新的数据。
      const prevValue = prev[key];
      // @beginner: 声明 nextValue：保存当前步骤需要读取或更新的数据。
      const nextValue = next[key];
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (prevValue !== nextValue) {
        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (indent === 0 && key === "children") {
          // @beginner: 声明 line：保存当前步骤需要读取或更新的数据。
          const line = `${"\xa0\xa0".repeat(indent)}${key}`;
          properties.push([`${REMOVED}${line}`, "\u2026"], [`${ADDED}${line}`, "\u2026"]);
          isDeeplyEqual = false;
          continue;
        }

        // @beginner: 条件分支：根据当前值选择不同处理路径。
        if (
          indent < 3 &&
          typeof prevValue === "object" &&
          typeof nextValue === "object" &&
          prevValue !== null &&
          nextValue !== null &&
          readReactElementTypeof(prevValue as AnyRecord) === readReactElementTypeof(nextValue as AnyRecord)
        ) {
          // @beginner: 条件分支：根据当前值选择不同处理路径。
          if (readReactElementTypeof(nextValue as AnyRecord) === REACT_ELEMENT_TYPE) {
            // @beginner: 声明 prevElement：保存当前步骤需要读取或更新的数据。
            const prevElement = prevValue as AnyRecord;
            // @beginner: 声明 nextElement：保存当前步骤需要读取或更新的数据。
            const nextElement = nextValue as AnyRecord;
            // @beginner: 条件分支：根据当前值选择不同处理路径。
            if (prevElement.type === nextElement.type && prevElement.key === nextElement.key) {
              // @beginner: 声明 typeName：保存当前步骤需要读取或更新的数据。
              const typeName = getComponentNameFromType(nextElement.type) || "\u2026";
              // @beginner: 声明 line：保存当前步骤需要读取或更新的数据。
              const line = `${"\xa0\xa0".repeat(indent)}${key}`;
              // @beginner: 声明 desc：保存当前步骤需要读取或更新的数据。
              const desc = `<${typeName} \u2026 />`;
              properties.push([`${REMOVED}${line}`, desc], [`${ADDED}${line}`, desc]);
              isDeeplyEqual = false;
              continue;
            }
          // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
          } else if (
            Object.prototype.toString.call(prevValue) === Object.prototype.toString.call(nextValue) &&
            (Object.prototype.toString.call(nextValue) === "[object Object]" ||
              Object.prototype.toString.call(nextValue) === "[object Array]")
          ) {
            // @beginner: 声明 entry：保存当前步骤需要读取或更新的数据。
            const entry: PropertyEntry = [
              `${UNCHANGED}${"\xa0\xa0".repeat(indent)}${key}`,
              isArray(nextValue) ? "Array" : "",
            ];
            properties.push(entry);
            // @beginner: 声明 prevLength：保存当前步骤需要读取或更新的数据。
            const prevLength = properties.length;
            // @beginner: 声明 nestedEqual：保存当前步骤需要读取或更新的数据。
            const nestedEqual = addObjectDiffToProperties(
              prevValue as Record<string, unknown>,
              nextValue as Record<string, unknown>,
              properties,
              indent + 1,
            );
            // @beginner: 条件分支：根据当前值选择不同处理路径。
            if (!nestedEqual) {
              isDeeplyEqual = false;
            // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
            } else if (prevLength === properties.length) {
              entry[1] = "Referentially unequal but deeply equal objects. Consider memoization.";
            }
            continue;
          }
        // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
        } else if (
          typeof prevValue === "function" &&
          typeof nextValue === "function" &&
          prevValue.name === nextValue.name &&
          prevValue.length === nextValue.length &&
          Function.prototype.toString.call(prevValue) === Function.prototype.toString.call(nextValue)
        ) {
          // @beginner: 声明 desc：保存当前步骤需要读取或更新的数据。
          const desc = nextValue.name === "" ? "() => {}" : `${nextValue.name}() {}`;
          properties.push([
            `${UNCHANGED}${"\xa0\xa0".repeat(indent)}${key}`,
            `${desc} Referentially unequal function closure. Consider memoization.`,
          ]);
          continue;
        }

        addValueToProperties(key, prevValue, properties, indent, REMOVED);
        addValueToProperties(key, nextValue, properties, indent, ADDED);
        isDeeplyEqual = false;
      }
    // @beginner: 兜底分支：前面的条件都不满足时执行这里的逻辑。
    } else {
      properties.push([`${ADDED}${"\xa0\xa0".repeat(indent)}${key}`, "\u2026"]);
      isDeeplyEqual = false;
    }

    nextPropertiesChecked += 1;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return isDeeplyEqual;
}
