/**
 * @beginner-module: 源码导读
 * 本文件属于 scheduler 调度器，负责按优先级安排任务执行。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 ImmediatePriority：保存当前步骤需要读取或更新的数据。
export const ImmediatePriority = 1;
// @beginner: 声明 UserBlockingPriority：保存当前步骤需要读取或更新的数据。
export const UserBlockingPriority = 2;
// @beginner: 声明 NormalPriority：保存当前步骤需要读取或更新的数据。
export const NormalPriority = 3;
// @beginner: 声明 LowPriority：保存当前步骤需要读取或更新的数据。
export const LowPriority = 4;
// @beginner: 声明 IdlePriority：保存当前步骤需要读取或更新的数据。
export const IdlePriority = 5;

// @beginner: 定义 PriorityLevel：给复杂数据结构起名字，后续代码会按这个形状传递数据。
export type PriorityLevel =
  | typeof ImmediatePriority
  | typeof UserBlockingPriority
  | typeof NormalPriority
  | typeof LowPriority
  | typeof IdlePriority;

// @beginner: 进入 timeoutForPriority：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function timeoutForPriority(priorityLevel: PriorityLevel): number {
  // @beginner: 多路分发：按枚举值或状态值选择具体处理逻辑。
  switch (priorityLevel) {
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case ImmediatePriority:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return -1;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case UserBlockingPriority:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return 250;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case NormalPriority:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return 5000;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case LowPriority:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return 10000;
    // @beginner: 匹配到这个 case 后，只处理这一类输入。
    case IdlePriority:
      // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
      return 1073741823;
  }
}
