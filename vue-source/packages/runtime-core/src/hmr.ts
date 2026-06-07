/**
 * 文件作用：实现运行时热更新（HMR）桥接逻辑。
 *
 * 它维护 “hmr id -> 初始组件定义 / 活跃实例集合” 的映射，
 * 并在构建工具通知组件变更时，决定走仅替换 render，还是整组件 reload。
 */

/* eslint-disable no-restricted-globals */
import {
  type ClassComponent,
  type ComponentInternalInstance,
  type ComponentOptions,
  type ConcreteComponent,
  type InternalRenderFunction,
  isClassComponent,
} from './component'
import { SchedulerJobFlags, queueJob, queuePostFlushCb } from './scheduler'
import { extend, getGlobalThis } from '@vue-source/shared'

type HMRComponent = ComponentOptions | ClassComponent

// 当前是否正处于 HMR 驱动的更新流程中；渲染器和组件更新逻辑会据此调整行为。
export let isHmrUpdating = false

/**
 * 作用：切换 HMR 更新标记，并返回切换前的旧值。
 */
export const setHmrUpdating = (v: boolean): boolean => {
  /**
   * 切换“当前是否处于 HMR 更新期”的全局标记。
   *
   * 返回值：
   * - 返回切换前的旧值，方便外层在必要时做成对恢复
   *
   * 为什么需要这个标记：
   * - 渲染器、slot 更新、组件比对逻辑在 HMR 期间要走更保守路径
   * - 否则某些本可跳过的优化会把热更新内容错误复用掉
   */
  try {
    return isHmrUpdating
  } finally {
    isHmrUpdating = v
  }
}

export const hmrDirtyComponents: Map<
  ConcreteComponent,
  Set<ComponentInternalInstance>
> = new Map<ConcreteComponent, Set<ComponentInternalInstance>>()
// `hmrDirtyComponents` 记录“本轮 HMR 中必须强制按替换组件处理”的组件及实例集合。
// 渲染器命中这些组件时不会走普通更新优化，而会更激进地刷新定义与子树。

/**
 * 作用：暴露给外部 HMR 工具链的运行时接口。
 */
export interface HMRRuntime {
  createRecord: typeof createRecord
  rerender: typeof rerender
  reload: typeof reload
}

// Expose the HMR runtime on the global object
// This makes it entirely tree-shakable without polluting the exports and makes
// it easier to be used in toolings like vue-loader
// Note: for a component to be eligible for HMR it also needs the __hmrId option
// to be set so that its instances can be registered / removed.
if (__DEV__) {
  // 把运行时能力挂到全局对象，构建工具拿到更新通知后就能直接调用这里的接口。
  getGlobalThis().__VUE_HMR_RUNTIME__ = {
    createRecord: tryWrap(createRecord),
    rerender: tryWrap(rerender),
    reload: tryWrap(reload),
  } as HMRRuntime
}

const map: Map<
  string,
  {
    // `initialDef` 记录首次导入时的组件定义，哪怕当前没有实例，也能把更新补到定义本身。
    initialDef: ComponentOptions
    // `instances` 保存当前页面里所有活跃实例，方便批量触发更新。
    instances: Set<ComponentInternalInstance>
  }
> = new Map()
// `map` 是 HMR 主索引：
// - key: 组件的 `__hmrId`
// - value: 该组件当前基准定义 + 页面上所有活跃实例
// 后续 rerender/reload 都会先从这里找到受影响目标。

/**
 * 作用：把组件实例登记到对应 hmr id 的记录里。
 */
export function registerHMR(instance: ComponentInternalInstance): void {
  /**
   * 把一个活跃组件实例注册到对应的 HMR 记录中。
   *
   * 主要功能：
   * - 依据组件的 `__hmrId` 找到或创建记录
   * - 把当前实例放进该记录的实例集合
   *
   * 这样后续收到热更新通知时，运行时才能批量找到所有受影响实例。
   */
  const id = instance.type.__hmrId!
  let record = map.get(id)
  if (!record) {
    createRecord(id, instance.type as HMRComponent)
    record = map.get(id)!
  }
  record.instances.add(instance)
}

export function unregisterHMR(instance: ComponentInternalInstance): void {
  /**
   * 从 HMR 记录中移除一个即将卸载或已失效的组件实例。
   */
  // 组件卸载后必须及时移除，否则热更新时会错误地尝试更新已销毁实例。
  map.get(instance.type.__hmrId!)!.instances.delete(instance)
}

/**
 * 作用：为一个 hmr id 建立初始记录。
 *
 * 返回值：
 * - `true`：新建成功
 * - `false`：记录已存在
 */
function createRecord(id: string, initialDef: HMRComponent): boolean {
  /**
   * 为某个 `__hmrId` 建立 HMR 记录。
   *
   * 记录里保存两类信息：
   * - `initialDef`：当前组件定义基准版本
   * - `instances`：页面上所有活跃实例
   */
  if (map.has(id)) {
    return false
  }
  map.set(id, {
    // `initialDef` 会被后续热更新原地改写，保证未来新实例也能拿到最新定义。
    initialDef: normalizeClassComponent(initialDef),
    // `instances` 保存当前页面上所有同 hmr id 的活跃实例。
    instances: new Set(),
  })
  return true
}

function normalizeClassComponent(component: HMRComponent): ComponentOptions {
  /**
   * 把 class 组件统一转成内部真正可更新的 options 对象。
   *
   * HMR 后续所有“覆盖定义 / 替换 render”操作，
   * 都希望落在统一的对象形态上。
   */
  return isClassComponent(component) ? component.__vccOpts : component
}

/**
 * 作用：仅替换组件 render 函数，尽量保留实例状态。
 */
function rerender(id: string, newRender?: Function): void {
  /**
   * 仅热替换组件 render 函数。
   *
   * 使用场景：
   * - 组件脚本状态结构没变
   * - 只需要让视图重新渲染即可
   *
   * 这一条路径会尽量保留现有组件实例和本地状态。
   */
  const record = map.get(id)
  if (!record) {
    return
  }

  // 同步回初始定义，保证后续首次挂载的实例也会拿到新 render。
  record.initialDef.render = newRender

  // 先拍快照，避免更新过程中实例集合发生增删。
  ;[...record.instances].forEach(instance => {
    if (newRender) {
      // 既要更新实例上的 render，也要更新组件定义上的 render，覆盖当前与未来实例两条链路。
      instance.render = newRender as InternalRenderFunction
      normalizeClassComponent(instance.type as HMRComponent).render = newRender
    }
    // render 缓存基于旧渲染函数生成，热替换后必须清空。
    instance.renderCache = []
    // 这个标记会让带 slot 的子组件也进入强制更新链路。
    isHmrUpdating = true
    // 已处置的更新任务不应再次执行。
    if (!(instance.job.flags! & SchedulerJobFlags.DISPOSED)) {
      instance.update()
    }
    isHmrUpdating = false
  })
}

/**
 * 作用：当组件定义整体变化时，强制让实例按“替换组件定义”的语义刷新。
 *
 * 与 `rerender` 的区别：
 * - `rerender` 只换 render
 * - `reload` 会清理缓存并促使父级重新 patch 当前组件
 */
function reload(id: string, newComp: HMRComponent): void {
  /**
   * 热替换整个组件定义。
   *
   * 使用场景：
   * - 不只是 render 变了
   * - props / emits / setup / 选项等任一部分可能都发生了变化
   *
   * 这一条路径会：
   * - 更新定义对象
   * - 清空归一化缓存
   * - 借父组件重新 patch，迫使当前组件整段替换
   */
  const record = map.get(id)
  if (!record) return

  newComp = normalizeClassComponent(newComp)
  // 先更新初始定义，保证未来新创建的实例也是新版本。
  updateComponentDef(record.initialDef, newComp)

  // 同样先拍快照，避免遍历期间实例集合被修改。
  const instances = [...record.instances]

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]
    const oldComp = normalizeClassComponent(instance.type as HMRComponent)

    let dirtyInstances = hmrDirtyComponents.get(oldComp)
    if (!dirtyInstances) {
      // 1. Update existing comp definition to match new one
      if (oldComp !== record.initialDef) {
        // 某些实例持有的可能不是最初那份定义对象，也要同步原地改写。
        updateComponentDef(oldComp, newComp)
      }
      // 这个脏标记会被渲染器读取；命中后 patch 会走组件替换，而不是普通更新。
      hmrDirtyComponents.set(oldComp, (dirtyInstances = new Set()))
    }
    dirtyInstances.add(instance)

    // 旧的 props/emits/options 归一化结果已经过期，必须全部清掉。
    instance.appContext.propsCache.delete(instance.type as any)
    instance.appContext.emitsCache.delete(instance.type as any)
    instance.appContext.optionsCache.delete(instance.type as any)

    // 按不同宿主场景执行真正更新。
    if (instance.ceReload) {
      // 自定义元素有独立的重载逻辑，例如样式热替换。
      dirtyInstances.add(instance)
      instance.ceReload((newComp as any).styles)
      dirtyInstances.delete(instance)
    } else if (instance.parent) {
      // 借父组件重新渲染触发当前子组件整段替换，这是普通组件 reload 的核心路径。
      queueJob(() => {
        // 已处置任务不再执行，避免无效更新和递归问题。
        if (!(instance.job.flags! & SchedulerJobFlags.DISPOSED)) {
          isHmrUpdating = true
          instance.parent!.update()
          isHmrUpdating = false
          // #6930, #11248 avoid infinite recursion
          dirtyInstances.delete(instance)
        }
      })
    } else if (instance.appContext.reload) {
      // `createApp()` 挂载的根实例自带 reload，直接走应用级刷新。
      instance.appContext.reload()
    } else if (typeof window !== 'undefined') {
      // 裸 render 根节点没有 app 级 reload 时，只能退化成整页刷新。
      window.location.reload()
    } else {
      console.warn(
        '[HMR] Root or manually mounted instance modified. Full reload required.',
      )
    }

    // 若当前实例位于自定义元素内部子树，还要顺手清理旧组件遗留样式。
    if (instance.root.ce && instance !== instance.root) {
      instance.root.ce._removeChildStyle(oldComp)
    }
  }

  // 等本轮 patch 完成后再清理脏标记，避免渲染器读取不到。
  queuePostFlushCb(() => {
    hmrDirtyComponents.clear()
  })
}

/**
 * 作用：把新组件定义原地覆盖到旧定义对象上，并删除已不存在的旧字段。
 */
function updateComponentDef(
  oldComp: ComponentOptions,
  newComp: ComponentOptions,
) {
  /**
   * 原地把新组件定义覆盖到旧定义对象上。
   *
   * 为什么要“原地改”：
   * - 当前页面里很多地方可能还持有旧定义对象引用
   * - 直接替换引用会让这些旧引用失效
   * - 原地覆盖才能让现有实例、缓存和注册表都看到最新定义
   */
  extend(oldComp, newComp)
  for (const key in oldComp) {
    // 新版本里已经删除的字段也要从旧定义上移除，避免旧选项继续残留生效。
    if (key !== '__file' && !(key in newComp)) {
      delete oldComp[key]
    }
  }
}

/**
 * 作用：统一包装 HMR runtime 对外方法，避免热更新异常直接打断工具链。
 */
function tryWrap(fn: (id: string, arg: any) => any): Function {
  /**
   * 给对外暴露的 HMR runtime 方法套一层兜底异常处理。
   *
   * 目标不是吞掉错误，而是：
   * - 避免工具链调用链直接崩掉
   * - 明确提示开发者退回整页刷新
   */
  return (id: string, arg: any) => {
    try {
      return fn(id, arg)
    } catch (e: any) {
      console.error(e)
      console.warn(
        `[HMR] Something went wrong during Vue component hot-reload. ` +
          `Full reload required.`,
      )
    }
  }
}
