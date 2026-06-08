export const ImmediatePriority = 1;
export const UserBlockingPriority = 2;
export const NormalPriority = 3;
export const LowPriority = 4;
export const IdlePriority = 5;

export type PriorityLevel =
  | typeof ImmediatePriority
  | typeof UserBlockingPriority
  | typeof NormalPriority
  | typeof LowPriority
  | typeof IdlePriority;

export function timeoutForPriority(priorityLevel: PriorityLevel): number {
  switch (priorityLevel) {
    case ImmediatePriority:
      return -1;
    case UserBlockingPriority:
      return 250;
    case NormalPriority:
      return 5000;
    case LowPriority:
      return 10000;
    case IdlePriority:
      return 1073741823;
  }
}
