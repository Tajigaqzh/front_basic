export type ViewTransitionClass = string | null | Record<string, string | null | undefined>;

export interface ViewTransitionProps {
  name?: string | null;
  className?: ViewTransitionClass;
  default?: ViewTransitionClass;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  update?: ViewTransitionClass;
}

export interface ViewTransitionState {
  autoName: string | null;
  paired: ViewTransitionState | null;
  clones: unknown[] | null;
  ref: unknown | null;
}

let globalClientIdCounter = 0;
let pendingTransitionTypes: string[] | null = null;

export function setPendingTransitionTypesForTest(types: string[] | null): void {
  pendingTransitionTypes = types;
}

export function createViewTransitionState(ref: unknown = null): ViewTransitionState {
  return {
    autoName: null,
    paired: null,
    clones: null,
    ref,
  };
}

export function getViewTransitionName(props: ViewTransitionProps, instance: ViewTransitionState): string {
  if (props.name !== null && props.name !== undefined && props.name !== "auto") {
    return props.name;
  }
  if (instance.autoName !== null) {
    return instance.autoName;
  }

  // 官方会使用 root.identifierPrefix；当前复刻用稳定自增 id 保证同一 state 复用同名。
  const name = `_front_t_${(globalClientIdCounter++).toString(32)}_`;
  instance.autoName = name;
  return name;
}

function getClassNameByType(classByType: ViewTransitionClass | undefined): string | null | undefined {
  if (classByType === undefined || classByType === null || typeof classByType === "string") {
    return classByType;
  }

  let className: string | null = null;
  if (pendingTransitionTypes !== null) {
    for (const type of pendingTransitionTypes) {
      const match = classByType[type];
      if (match === "none") {
        return "none";
      }
      if (match != null) {
        className = className === null ? match : `${className} ${match}`;
      }
    }
  }

  return className ?? classByType.default;
}

export function getViewTransitionClassName(
  defaultClass: ViewTransitionClass | undefined,
  eventClass: ViewTransitionClass | undefined,
): string | null | undefined {
  const className = getClassNameByType(defaultClass);
  const eventClassName = getClassNameByType(eventClass);
  if (eventClassName == null) {
    return className === "auto" ? null : className;
  }
  return eventClassName === "auto" ? null : eventClassName;
}
