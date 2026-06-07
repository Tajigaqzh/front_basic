/**
 * 文件作用：提供组件性能打点辅助。
 *
 * 它负责在开启 `app.config.performance` 或 devtools 性能采集时，
 * 给组件挂载、更新等阶段打浏览器 Performance 标记，并同步上报给 devtools。
 */

/* eslint-disable no-restricted-globals */
import {
  type ComponentInternalInstance,
  formatComponentName,
} from './component'
import { devtoolsPerfEnd, devtoolsPerfStart } from './devtools'

let supported: boolean
let perf: Performance

/**
 * 作用：记录某个组件阶段开始时间。
 *
 * 参数说明：
 * - `instance`：当前组件实例
 * - `type`：阶段名，例如 mount / update
 */
export function startMeasure(
  instance: ComponentInternalInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && isSupported()) {
    perf.mark(`vue-${type}-${instance.uid}`)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfStart(instance, type, isSupported() ? perf.now() : Date.now())
  }
}

/**
 * 作用：记录某个组件阶段结束时间，并输出完整 measure。
 */
export function endMeasure(
  instance: ComponentInternalInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && isSupported()) {
    const startTag = `vue-${type}-${instance.uid}`
    const endTag = startTag + `:end`
    const measureName = `<${formatComponentName(instance, instance.type)}> ${type}`
    perf.mark(endTag)
    perf.measure(measureName, startTag, endTag)
    perf.clearMeasures(measureName)
    perf.clearMarks(startTag)
    perf.clearMarks(endTag)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfEnd(instance, type, isSupported() ? perf.now() : Date.now())
  }
}

/**
 * 作用：检测当前环境是否支持浏览器 Performance API，并做一次惰性缓存。
 */
function isSupported() {
  if (supported !== undefined) {
    return supported
  }
  if (typeof window !== 'undefined' && window.performance) {
    supported = true
    perf = window.performance
  } else {
    supported = false
  }
  return supported
}
