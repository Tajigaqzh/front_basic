import { OMITTED_PROP_ERROR } from "./ReactFlightPropertyAccess.js";
import hasOwnProperty from "./hasOwnProperty.js";
import isArray from "./isArray.js";
import { REACT_ELEMENT_TYPE } from "./ReactSymbols.js";
import getComponentNameFromType from "./getComponentNameFromType.js";

type PropertyEntry = [string, string];
type AnyRecord = Record<string, unknown> & {
  $$typeof?: unknown;
  type?: unknown;
  key?: unknown;
  props?: Record<string, unknown>;
  status?: unknown;
  value?: unknown;
  reason?: unknown;
};

const EMPTY_ARRAY = 0;
const COMPLEX_ARRAY = 1;
const PRIMITIVE_ARRAY = 2;
const ENTRIES_ARRAY = 3;
const OBJECT_WIDTH_LIMIT = 100;

function getArrayKind(array: unknown[]): 0 | 1 | 2 | 3 {
  let kind: 0 | 1 | 2 | 3 = EMPTY_ARRAY;
  for (let i = 0; i < array.length && i < OBJECT_WIDTH_LIMIT; i += 1) {
    const value = array[i];
    if (typeof value === "object" && value !== null) {
      if (isArray(value) && value.length === 2 && typeof value[0] === "string") {
        if (kind !== EMPTY_ARRAY && kind !== ENTRIES_ARRAY) {
          return COMPLEX_ARRAY;
        }
        kind = ENTRIES_ARRAY;
      } else {
        return COMPLEX_ARRAY;
      }
    } else if (typeof value === "function") {
      return COMPLEX_ARRAY;
    } else if (typeof value === "string" && value.length > 50) {
      return COMPLEX_ARRAY;
    } else if (kind !== EMPTY_ARRAY && kind !== PRIMITIVE_ARRAY) {
      return COMPLEX_ARRAY;
    } else if (typeof value === "bigint") {
      return COMPLEX_ARRAY;
    } else {
      kind = PRIMITIVE_ARRAY;
    }
  }
  return kind;
}

export function addObjectToProperties(
  object: Record<string, unknown>,
  properties: PropertyEntry[],
  indent: number,
  prefix: string,
): void {
  let addedProperties = 0;
  for (const key in object) {
    if (hasOwnProperty.call(object, key) && key[0] !== "_") {
      addedProperties += 1;
      addValueToProperties(key, object[key], properties, indent, prefix);
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

function readReactElementTypeof(value: AnyRecord): unknown {
  return "$$typeof" in value && hasOwnProperty.call(value, "$$typeof")
    ? value.$$typeof
    : undefined;
}

function getObjectName(value: object): string {
  const objectToString = Object.prototype.toString.call(value);
  let objectName = objectToString.slice(8, objectToString.length - 1);
  if (objectName === "Object") {
    const proto = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null;
    if (proto && typeof proto.constructor === "function") {
      objectName = proto.constructor.name || objectName;
    }
  }
  return objectName;
}

/**
 * 把值展开成 performance track 属性行。与官方逻辑一致，ReactElement、Promise、
 * entries array、普通对象会被递归展开，过深或过宽时用省略号收敛。
 */
export function addValueToProperties(
  propertyName: string,
  value: unknown,
  properties: PropertyEntry[],
  indent: number,
  prefix: string,
): void {
  let desc: string;

  switch (typeof value) {
    case "object":
      if (value === null) {
        desc = "null";
        break;
      }

      if (readReactElementTypeof(value as AnyRecord) === REACT_ELEMENT_TYPE) {
        const element = value as AnyRecord;
        const typeName = getComponentNameFromType(element.type) || "\u2026";
        const key = element.key;
        const props = element.props ?? {};
        const propsKeys = Object.keys(props);
        if (key == null && propsKeys.length === 0) {
          desc = `<${typeName} />`;
          break;
        }
        if (indent < 3 || (propsKeys.length === 1 && propsKeys[0] === "children" && key == null)) {
          desc = `<${typeName} \u2026 />`;
          break;
        }

        properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, `<${typeName}`]);
        if (key !== null && key !== undefined) {
          addValueToProperties("key", key, properties, indent + 1, prefix);
        }
        let hasChildren = false;
        let addedProperties = 0;
        for (const propKey in props) {
          addedProperties += 1;
          if (propKey === "children") {
            if (props.children != null && (!isArray(props.children) || props.children.length > 0)) {
              hasChildren = true;
            }
          } else if (hasOwnProperty.call(props, propKey) && propKey[0] !== "_") {
            addValueToProperties(propKey, props[propKey], properties, indent + 1, prefix);
          }
          if (addedProperties >= OBJECT_WIDTH_LIMIT) {
            break;
          }
        }
        properties.push(["", hasChildren ? `>\u2026</${typeName}>` : "/>"]);
        return;
      }

      if (isArray(value)) {
        const array = value as unknown[];
        const didTruncate = array.length > OBJECT_WIDTH_LIMIT;
        const kind = getArrayKind(array);
        if (kind === PRIMITIVE_ARRAY || kind === EMPTY_ARRAY) {
          desc = JSON.stringify(
            didTruncate ? array.slice(0, OBJECT_WIDTH_LIMIT).concat("\u2026") : array,
          ) ?? "undefined";
          break;
        }
        if (kind === ENTRIES_ARRAY) {
          properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, ""]);
          for (let i = 0; i < array.length && i < OBJECT_WIDTH_LIMIT; i += 1) {
            const entry = array[i] as [string, unknown];
            addValueToProperties(entry[0], entry[1], properties, indent + 1, prefix);
          }
          if (didTruncate) {
            addValueToProperties(OBJECT_WIDTH_LIMIT.toString(), "\u2026", properties, indent + 1, prefix);
          }
          return;
        }
      }

      if (value instanceof Error) {
        properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, value.name || "Error"]);
        if (indent < 3) {
          addValueToProperties("message", value.message, properties, indent + 1, prefix);
        }
        return;
      }

      if (value instanceof Date) {
        desc = Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
        break;
      }

      if ((value as AnyRecord).status === "fulfilled") {
        const idx = properties.length;
        addValueToProperties(propertyName, (value as AnyRecord).value, properties, indent, prefix);
        if (properties.length > idx) {
          properties[idx][1] = `Promise<${properties[idx][1] || "Object"}>`;
        }
        return;
      }
      if ((value as AnyRecord).status === "rejected") {
        const idx = properties.length;
        addValueToProperties(propertyName, (value as AnyRecord).reason, properties, indent, prefix);
        if (properties.length > idx) {
          properties[idx][1] = `Rejected Promise<${properties[idx][1]}>`;
        }
        return;
      }

      properties.push([
        `${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`,
        getObjectName(value) === "Object" ? (indent < 3 ? "" : "\u2026") : getObjectName(value),
      ]);
      if (indent < 3) {
        addObjectToProperties(value as Record<string, unknown>, properties, indent + 1, prefix);
      }
      return;
    case "function": {
      const functionName = (value as Function).name;
      desc = functionName === "" || typeof functionName !== "string" ? "() => {}" : `${functionName}() {}`;
      break;
    }
    case "string":
      desc =
        value === OMITTED_PROP_ERROR
          ? "\u2026"
          : JSON.stringify(value.length >= 1024 ? `${value.slice(0, 1023)}\u2026` : value) ?? "\"\"";
      break;
    case "undefined":
      desc = "undefined";
      break;
    case "boolean":
      desc = value ? "true" : "false";
      break;
    default:
      desc = String(value);
  }

  properties.push([`${prefix}${"\xa0\xa0".repeat(indent)}${propertyName}`, desc]);
}

const REMOVED = "-\xa0";
const ADDED = "+\xa0";
const UNCHANGED = "\u2007\xa0";

export function addObjectDiffToProperties(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  properties: PropertyEntry[],
  indent: number,
): boolean {
  let isDeeplyEqual = true;
  let prevPropertiesChecked = 0;

  for (const key in prev) {
    if (prevPropertiesChecked > OBJECT_WIDTH_LIMIT) {
      properties.push([
        `Previous object has more than ${OBJECT_WIDTH_LIMIT} properties. React will not attempt to diff objects with too many properties.`,
        "",
      ]);
      isDeeplyEqual = false;
      break;
    }
    if (!(key in next)) {
      properties.push([`${REMOVED}${"\xa0\xa0".repeat(indent)}${key}`, "\u2026"]);
      isDeeplyEqual = false;
    }
    prevPropertiesChecked += 1;
  }

  let nextPropertiesChecked = 0;
  for (const key in next) {
    if (nextPropertiesChecked > OBJECT_WIDTH_LIMIT) {
      properties.push([
        `Next object has more than ${OBJECT_WIDTH_LIMIT} properties. React will not attempt to diff objects with too many properties.`,
        "",
      ]);
      isDeeplyEqual = false;
      break;
    }

    if (key in prev) {
      const prevValue = prev[key];
      const nextValue = next[key];
      if (prevValue !== nextValue) {
        if (indent === 0 && key === "children") {
          const line = `${"\xa0\xa0".repeat(indent)}${key}`;
          properties.push([`${REMOVED}${line}`, "\u2026"], [`${ADDED}${line}`, "\u2026"]);
          isDeeplyEqual = false;
          continue;
        }

        if (
          indent < 3 &&
          typeof prevValue === "object" &&
          typeof nextValue === "object" &&
          prevValue !== null &&
          nextValue !== null &&
          readReactElementTypeof(prevValue as AnyRecord) === readReactElementTypeof(nextValue as AnyRecord)
        ) {
          if (readReactElementTypeof(nextValue as AnyRecord) === REACT_ELEMENT_TYPE) {
            const prevElement = prevValue as AnyRecord;
            const nextElement = nextValue as AnyRecord;
            if (prevElement.type === nextElement.type && prevElement.key === nextElement.key) {
              const typeName = getComponentNameFromType(nextElement.type) || "\u2026";
              const line = `${"\xa0\xa0".repeat(indent)}${key}`;
              const desc = `<${typeName} \u2026 />`;
              properties.push([`${REMOVED}${line}`, desc], [`${ADDED}${line}`, desc]);
              isDeeplyEqual = false;
              continue;
            }
          } else if (
            Object.prototype.toString.call(prevValue) === Object.prototype.toString.call(nextValue) &&
            (Object.prototype.toString.call(nextValue) === "[object Object]" ||
              Object.prototype.toString.call(nextValue) === "[object Array]")
          ) {
            const entry: PropertyEntry = [
              `${UNCHANGED}${"\xa0\xa0".repeat(indent)}${key}`,
              isArray(nextValue) ? "Array" : "",
            ];
            properties.push(entry);
            const prevLength = properties.length;
            const nestedEqual = addObjectDiffToProperties(
              prevValue as Record<string, unknown>,
              nextValue as Record<string, unknown>,
              properties,
              indent + 1,
            );
            if (!nestedEqual) {
              isDeeplyEqual = false;
            } else if (prevLength === properties.length) {
              entry[1] = "Referentially unequal but deeply equal objects. Consider memoization.";
            }
            continue;
          }
        } else if (
          typeof prevValue === "function" &&
          typeof nextValue === "function" &&
          prevValue.name === nextValue.name &&
          prevValue.length === nextValue.length &&
          Function.prototype.toString.call(prevValue) === Function.prototype.toString.call(nextValue)
        ) {
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
    } else {
      properties.push([`${ADDED}${"\xa0\xa0".repeat(indent)}${key}`, "\u2026"]);
      isDeeplyEqual = false;
    }

    nextPropertiesChecked += 1;
  }

  return isDeeplyEqual;
}
