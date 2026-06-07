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

/**
 * 作用：把组件实例登记到对应 hmr id 的记录里。
 */
export function registerHMR(instance: ComponentInternalInstance): void {
  const id = instance.type.__hmrId!
  let record = map.get(id)
  if (!record) {
    createRecord(id, instance.type as HMRComponent)
    record = map.get(id)!
  }
  record.instances.add(instance)
}

export function unregisterHMR(instance: ComponentInternalInstance): void {
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
  if (map.has(id)) {
    return false
  }
  map.set(id, {
    initialDef: normalizeClassComponent(initialDef),
    instances: new Set(),
  })
  return true
}

function normalizeClassComponent(component: HMRComponent): ComponentOptions {
  return isClassComponent(component) ? component.__vccOpts : component
}

/**
 * 作用：仅替换组件 render 函数，尽量保留实例状态。
 */
function rerender(id: string, newRender?: Function): void {
  const record = map.get(id)
  if (!record) {
    return
  }

  // 同步回初始定义，保证后续首次挂载的实例也会拿到新 render。
  record.initialDef.render = newRender

  // 先拍快照，避免更新过程中实例集合发生增删。
  ;[...record.instances].forEach(instance => {
    if (newRender) {
      instance.render = newRender as InternalRenderFunction
      normalizeClassComponent(instance.type as HMRComponent).render = newRender
    }
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
  extend(oldComp, newComp)
  for (const key in oldComp) {
    if (key !== '__file' && !(key in newComp)) {
      delete oldComp[key]
    }
  }
}

/**
 * 作用：统一包装 HMR runtime 对外方法，避免热更新异常直接打断工具链。
 */
function tryWrap(fn: (id: string, arg: any) => any): Function {
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
