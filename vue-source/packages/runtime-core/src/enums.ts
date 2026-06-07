/**
 * 文件作用：集中定义 runtime-core 内部枚举常量。
 *
 * 当前文件主要暴露生命周期在组件实例上的短字段编码，
 * 这样既能减少运行时字段体积，也能让不同模块用同一套常量索引生命周期数组。
 */

// 这些短字符串会直接作为 `ComponentInternalInstance` 上的属性键使用。
export enum LifecycleHooks {
  // 之所以用短字段编码，而不是完整字符串，是为了减少每个组件实例上生命周期数组键的体积。
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
  DEACTIVATED = 'da',
  ACTIVATED = 'a',
  RENDER_TRIGGERED = 'rtg',
  RENDER_TRACKED = 'rtc',
  ERROR_CAPTURED = 'ec',
  SERVER_PREFETCH = 'sp',
}
