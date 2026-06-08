/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 ViewTransitionClass：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type ViewTransitionClass = string | null | Record<string, string | null | undefined>;

// @beginner: 定义 ViewTransitionProps：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ViewTransitionProps {
  name?: string | null;
  className?: ViewTransitionClass;
  default?: ViewTransitionClass;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  update?: ViewTransitionClass;
}

// @beginner: 定义 ViewTransitionState：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface ViewTransitionState {
  autoName: string | null;
  paired: ViewTransitionState | null;
  clones: unknown[] | null;
  ref: unknown | null;
}

// @beginner: 声明 globalClientIdCounter：保存当前步骤需要读取或更新的数据。
let globalClientIdCounter = 0;
// @beginner: 声明 pendingTransitionTypes：保存当前步骤需要读取或更新的数据。
let pendingTransitionTypes: string[] | null = null;

// @beginner: 进入 setPendingTransitionTypesForTest：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function setPendingTransitionTypesForTest(types: string[] | null): void {
  pendingTransitionTypes = types;
}

// @beginner: 进入 createViewTransitionState：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createViewTransitionState(ref: unknown = null): ViewTransitionState {
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    autoName: null,
    paired: null,
    clones: null,
    ref,
  };
}

// @beginner: 进入 getViewTransitionName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getViewTransitionName(props: ViewTransitionProps, instance: ViewTransitionState): string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (props.name !== null && props.name !== undefined && props.name !== "auto") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return props.name;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (instance.autoName !== null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return instance.autoName;
  }

  // 官方会使用 root.identifierPrefix；当前复刻用稳定自增 id 保证同一 state 复用同名。
  // @beginner: 声明 name：保存当前步骤需要读取或更新的数据。
  const name = `_front_t_${(globalClientIdCounter++).toString(32)}_`;
  instance.autoName = name;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return name;
}

// @beginner: 进入 getClassNameByType：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
function getClassNameByType(classByType: ViewTransitionClass | undefined): string | null | undefined {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (classByType === undefined || classByType === null || typeof classByType === "string") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return classByType;
  }

  // @beginner: 声明 className：保存当前步骤需要读取或更新的数据。
  let className: string | null = null;
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (pendingTransitionTypes !== null) {
    // @beginner: 循环处理：逐个处理集合、链表或队列中的项目。
    for (const type of pendingTransitionTypes) {
      // @beginner: 声明 match：保存当前步骤需要读取或更新的数据。
      const match = classByType[type];
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (match === "none") {
        // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
        return "none";
      }
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (match != null) {
        className = className === null ? match : `${className} ${match}`;
      }
    }
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return className ?? classByType.default;
}

// @beginner: 进入 getViewTransitionClassName：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function getViewTransitionClassName(
  defaultClass: ViewTransitionClass | undefined,
  eventClass: ViewTransitionClass | undefined,
): string | null | undefined {
  // @beginner: 声明 className：保存当前步骤需要读取或更新的数据。
  const className = getClassNameByType(defaultClass);
  // @beginner: 声明 eventClassName：保存当前步骤需要读取或更新的数据。
  const eventClassName = getClassNameByType(eventClass);
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (eventClassName == null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return className === "auto" ? null : className;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return eventClassName === "auto" ? null : eventClassName;
}
