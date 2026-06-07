/**
 * 文件作用：实现运行时调度器。
 *
 * 这份文件负责任务去重、排序、微任务刷新以及 pre / post 回调执行时机，
 * 是组件批量更新和 `nextTick` 的基础。
 *
 * 它在整个运行时里的角色可以理解为：
 * - 响应式副作用触发更新时，不立刻同步重渲染
 * - 先统一排队、去重、排序
 * - 再在合适的微任务时机批量刷新，降低重复渲染成本
 */

import { ErrorCodes, callWithErrorHandling, handleError } from './errorHandling'
import { NOOP, isArray } from '@vue-source/shared'
import { type ComponentInternalInstance, getComponentName } from './component'

export enum SchedulerJobFlags {
  QUEUED = 1 << 0,
  PRE = 1 << 1,
  /**
   * Indicates whether the effect is allowed to recursively trigger itself
   * when managed by the scheduler.
   *
   * By default, a job cannot trigger itself because some built-in method calls,
   * e.g. Array.prototype.push actually performs reads as well (#1740) which
   * can lead to confusing infinite loops.
   * The allowed cases are component update functions and watch callbacks.
   * Component update functions may update child component props, which in turn
   * trigger flush: "pre" watch callbacks that mutates state that the parent
   * relies on (#1801). Watch callbacks doesn't track its dependencies so if it
   * triggers itself again, it's likely intentional and it is the user's
   * responsibility to perform recursive state mutation that eventually
   * stabilizes (#1727).
   */
  ALLOW_RECURSE = 1 << 2,
  DISPOSED = 1 << 3,
}

export interface SchedulerJob extends Function {
  id?: number
  /**
   * flags can technically be undefined, but it can still be used in bitwise
   * operations just like 0.
   */
  flags?: SchedulerJobFlags
  /**
   * Attached by renderer.ts when setting up a component's render effect
   * Used to obtain component information when reporting max recursive updates.
   */
  i?: ComponentInternalInstance
}

export type SchedulerJobs = SchedulerJob | SchedulerJob[]

/**
 * 主任务队列。
 *
 * 作用：
 * - 存放“本轮需要执行的更新任务”
 * - 这些任务通常是组件更新函数，也可能是 watcher 调度任务
 *
 * 依赖关系：
 * - `queueJob()` 负责把任务塞进这里
 * - `flushJobs()` 负责顺序消费这里的任务
 */
const queue: SchedulerJob[] = []

/**
 * 当前正在刷新的任务下标。
 *
 * 作用：
 * - 标记 `flushJobs()` 现在执行到主队列的哪个位置
 * - 配合插队逻辑，避免在刷新过程中重复扫描已经执行过的任务
 */
let flushIndex = -1

/**
 * 后置回调队列。
 *
 * 作用：
 * - 存放要在主更新任务执行完成后再运行的回调
 * - 常见来源是组件渲染后的副作用、post watcher、部分生命周期钩子
 */
const pendingPostFlushCbs: SchedulerJob[] = []

/**
 * 当前这一轮正在执行的后置回调队列。
 *
 * 作用：
 * - 避免后置回调嵌套刷新时互相覆盖
 * - 让新的后置任务可以安全追加到当前活跃队列后面
 */
let activePostFlushCbs: SchedulerJob[] | null = null

/**
 * 当前执行到的后置回调下标。
 *
 * 作用：
 * - 配合 `activePostFlushCbs` 记录执行进度
 * - 支持在执行中插入新的后置任务
 */
let postFlushIndex = 0

/**
 * 复用的已解决 Promise。
 *
 * 作用：
 * - 用微任务触发本轮调度刷新
 * - 避免每次 `nextTick()` / `queueFlush()` 都重新创建 Promise
 */
const resolvedPromise = /*@__PURE__*/ Promise.resolve() as Promise<any>

/**
 * 当前这一轮调度刷新对应的 Promise。
 *
 * 作用：
 * - 如果它存在，说明刷新已经被安排进微任务队列
 * - `nextTick()` 会复用它，从而等待“这一轮刷新结束”
 */
let currentFlushPromise: Promise<void> | null = null

const RECURSION_LIMIT = 100
type CountMap = Map<SchedulerJob, number>

/**
 * 等待当前这轮调度刷新结束。
 *
 * 主要功能：
 * - 如果当前已经安排了刷新，则复用那次刷新的 Promise
 * - 如果还没安排刷新，则退化成等待一个已解决 Promise
 *
 * 参数：
 * - `fn`：可选回调；如果传入，会在刷新完成后的微任务阶段执行
 *
 * 依赖：
 * - `currentFlushPromise`
 * - `resolvedPromise`
 */
export function nextTick(): Promise<void>
export function nextTick<T, R>(
  this: T,
  fn: (this: T) => R | Promise<R>,
): Promise<R>
export function nextTick<T, R>(
  this: T,
  fn?: (this: T) => R | Promise<R>,
): Promise<void | R> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

// Use binary-search to find a suitable position in the queue. The queue needs
// to be sorted in increasing order of the job ids. This ensures that:
// 1. Components are updated from parent to child. As the parent is always
//    created before the child it will always have a smaller id.
// 2. If a component is unmounted during a parent component's update, its update
//    can be skipped.
// A pre watcher will have the same id as its component's update job. The
// watcher should be inserted immediately before the update job. This allows
// watchers to be skipped if the component is unmounted by the parent update.
/**
 * 用二分法找到任务应当插入到主队列的哪个位置。
 *
 * 主要功能：
 * - 保证主队列整体按 `job.id` 递增排列
 * - 让父组件更新先于子组件更新
 * - 让 pre watcher 插在所属组件更新任务前面
 *
 * 参数：
 * - `id`：当前待插入任务的优先级 id
 *
 * 返回值：
 * - 返回主队列中适合插入的数组下标
 */
function findInsertionIndex(id: number) {
  let start = flushIndex + 1
  let end = queue.length

  while (start < end) {
    const middle = (start + end) >>> 1
    const middleJob = queue[middle]
    const middleJobId = getId(middleJob)
    if (
      middleJobId < id ||
      (middleJobId === id && middleJob.flags! & SchedulerJobFlags.PRE)
    ) {
      start = middle + 1
    } else {
      end = middle
    }
  }

  return start
}

/**
 * 把一个主任务加入调度队列。
 *
 * 主要功能：
 * - 去重：同一个任务在一轮刷新里只会入队一次
 * - 排序：保证父先子后、pre watcher 提前
 * - 安排刷新：如果本轮还没开始刷新，就挂一个微任务
 *
 * 参数：
 * - `job`：待执行任务，通常是组件更新函数或 watcher 调度任务
 *
 * 依赖：
 * - `getId()`：读取任务优先级
 * - `findInsertionIndex()`：在队列中找到插入位置
 * - `queueFlush()`：真正安排微任务刷新
 */
export function queueJob(job: SchedulerJob): void {
  if (!(job.flags! & SchedulerJobFlags.QUEUED)) {
    const jobId = getId(job)
    const lastJob = queue[queue.length - 1]
    if (
      !lastJob ||
      // fast path when the job id is larger than the tail
      (!(job.flags! & SchedulerJobFlags.PRE) && jobId >= getId(lastJob))
    ) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(jobId), 0, job)
    }

    job.flags! |= SchedulerJobFlags.QUEUED

    queueFlush()
  }
}

/**
 * 安排一次调度刷新。
 *
 * 主要功能：
 * - 保证同一轮状态变化只安排一次 `flushJobs()`
 * - 通过微任务把同步阶段的多次变更合并起来
 */
function queueFlush() {
  // `currentFlushPromise` 充当“本轮是否已经预约刷新”的锁。
  // 只要它存在，说明当前同步阶段再多次触发状态变更，也不会重复挂微任务。
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

/**
 * 把后置回调加入 post 队列。
 *
 * 主要功能：
 * - 收集要在主任务执行完之后再执行的回调
 * - 对单个回调做去重
 * - 对生命周期数组跳过去重检查以减少额外开销
 *
 * 参数：
 * - `cb`：单个回调或回调数组
 */
export function queuePostFlushCb(cb: SchedulerJobs): void {
  if (!isArray(cb)) {
    if (activePostFlushCbs && cb.id === -1) {
      // `id === -1` 的 post 回调允许在当前活跃 post 队列中就近插入，常见于某些立即后置任务。
      activePostFlushCbs.splice(postFlushIndex + 1, 0, cb)
    } else if (!(cb.flags! & SchedulerJobFlags.QUEUED)) {
      pendingPostFlushCbs.push(cb)
      cb.flags! |= SchedulerJobFlags.QUEUED
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    pendingPostFlushCbs.push(...cb)
  }
  queueFlush()
}

/**
 * 刷新主队列中的 pre 回调。
 *
 * 主要功能：
 * - 在组件正式更新前，优先执行 pre watcher
 * - 支持只刷新某个组件实例对应的 pre 回调
 *
 * 参数：
 * - `instance`：可选；如果传入，只处理这个组件对应的 pre 任务
 * - `seen`：递归更新检测表
 * - `i`：从主队列哪个位置开始扫描，默认跳过当前正在执行的 job
 */
export function flushPreFlushCbs(
  instance?: ComponentInternalInstance,
  seen?: CountMap,
  // skip the current job
  i: number = flushIndex + 1,
): void {
  if (__DEV__) {
    seen = seen || new Map()
  }
  for (; i < queue.length; i++) {
    const cb = queue[i]
    if (cb && cb.flags! & SchedulerJobFlags.PRE) {
      // 传入 instance 时，只清这个组件自己的 pre watcher。
      // 这通常发生在组件更新前，需要先把自己相关的 pre 副作用跑完。
      if (instance && cb.id !== instance.uid) {
        continue
      }
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      queue.splice(i, 1)
      i--
      if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
        // 允许递归的 pre watcher 在执行前先清掉 QUEUED，避免它自触发时被错误拦掉。
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
      cb()
      if (!(cb.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }
  }
}

/**
 * 刷新 post 回调队列。
 *
 * 主要功能：
 * - 在主任务执行完成后，统一执行后置副作用
 * - 先去重，再按任务 id 排序
 * - 处理 post 回调内部继续注册 post 回调的嵌套场景
 *
 * 参数：
 * - `seen`：递归更新检测表
 */
export function flushPostFlushCbs(seen?: CountMap): void {
  if (pendingPostFlushCbs.length) {
    // post 队列允许被多处重复收集，这里统一去重并排序，
    // 保证最终执行顺序仍然尽量接近组件更新顺序。
    const deduped = [...new Set(pendingPostFlushCbs)].sort(
      (a, b) => getId(a) - getId(b),
    )
    pendingPostFlushCbs.length = 0

    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostFlushCbs) {
      // post 回调执行过程中又注册 post 回调时，直接拼到当前活跃队列尾部，避免丢失。
      activePostFlushCbs.push(...deduped)
      return
    }

    activePostFlushCbs = deduped
    if (__DEV__) {
      seen = seen || new Map()
    }

    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      const cb = activePostFlushCbs[postFlushIndex]
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
      // 已处置回调不再执行，常见于组件/副作用在排队后又被卸载的情况。
      if (!(cb.flags! & SchedulerJobFlags.DISPOSED)) cb()
      cb.flags! &= ~SchedulerJobFlags.QUEUED
    }
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}

/**
 * 读取任务优先级 id。
 *
 * 作用：
 * - 普通组件更新任务通常会带组件 uid
 * - PRE 任务在没有显式 id 时会被视为 `-1`，保证更早执行
 * - 其他无 id 任务会被放到队尾
 */
const getId = (job: SchedulerJob): number =>
  job.id == null ? (job.flags! & SchedulerJobFlags.PRE ? -1 : Infinity) : job.id
// 这个规则保证：
// - pre 任务默认最靠前
// - 普通无 id 任务默认落到最后
// - 有显式组件 uid 的任务则按父先子后的稳定顺序执行

/**
 * 刷新整轮调度任务。
 *
 * 主要功能：
 * - 顺序执行主任务队列
 * - 清理 QUEUED 标记
 * - 主任务结束后继续刷新 post 队列
 * - 如果 post 队列执行时又产生新任务，会继续递归刷新
 *
 * 参数：
 * - `seen`：仅用于递归更新检测
 *
 * 依赖：
 * - `callWithErrorHandling()`：包装任务执行，避免单个任务错误破坏整个刷新流程
 * - `flushPostFlushCbs()`：执行后置回调
 */
function flushJobs(seen?: CountMap) {
  if (__DEV__) {
    seen = seen || new Map()
  }

  // conditional usage of checkRecursiveUpdate must be determined out of
  // try ... catch block since Rollup by default de-optimizes treeshaking
  // inside try-catch. This can leave all warning code unshaked. Although
  // they would get eventually shaken by a minifier like terser, some minifiers
  // would fail to do that (e.g. https://github.com/evanw/esbuild/issues/1610)
  const check = __DEV__
    ? (job: SchedulerJob) => checkRecursiveUpdates(seen!, job)
    : NOOP

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job && !(job.flags! & SchedulerJobFlags.DISPOSED)) {
        if (__DEV__ && check(job)) {
          continue
        }
        if (job.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
          job.flags! &= ~SchedulerJobFlags.QUEUED
        }
        // 组件更新任务和普通调度任务共用一套执行循环，
        // 这里只是根据 `job.i` 是否存在区分错误码，便于上层报错定位。
        callWithErrorHandling(
          job,
          job.i,
          job.i ? ErrorCodes.COMPONENT_UPDATE : ErrorCodes.SCHEDULER,
        )
        if (!(job.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
          job.flags! &= ~SchedulerJobFlags.QUEUED
        }
      }
    }
  } finally {
    // If there was an error we still need to clear the QUEUED flags
    for (; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job) {
        job.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }

    flushIndex = -1
    queue.length = 0

    flushPostFlushCbs(seen)

    currentFlushPromise = null
    // If new jobs have been added to either queue, keep flushing
    if (queue.length || pendingPostFlushCbs.length) {
      // 刷新过程中继续产生的新任务不能留到下一轮事件循环，否则会打乱“同轮状态变更批处理”的语义。
      flushJobs(seen)
    }
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob) {
  /**
   * 检测同一个调度任务是否在一轮刷新里递归触发过多次。
   *
   * 为什么需要它：
   * - 响应式副作用里如果又去写回自己的依赖，很容易形成死循环
   * - 调度器需要在真正把浏览器拖死之前提前中断并报出组件上下文
   */
  const count = seen.get(fn) || 0
  if (count > RECURSION_LIMIT) {
    const instance = fn.i
    const componentName = instance && getComponentName(instance.type)
    handleError(
      `Maximum recursive updates exceeded${
        componentName ? ` in component <${componentName}>` : ``
      }. ` +
        `This means you have a reactive effect that is mutating its own ` +
        `dependencies and thus recursively triggering itself. Possible sources ` +
        `include component template, render function, updated hook or ` +
        `watcher source function.`,
      null,
      ErrorCodes.APP_ERROR_HANDLER,
    )
    return true
  }
  seen.set(fn, count + 1)
  return false
}
