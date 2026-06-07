/**
 * 文件作用：runtime-dom 的辅助模块。
 *
 * 当前文件 useCssModule.ts 负责读取 SFC 注入到组件定义上的 CSS Modules 映射表。
 *
 * 它本身不生成样式，只负责把编译阶段挂到 `__cssModules` 上的 class 映射暴露给 setup 使用。
 */

import { getCurrentInstance, warn } from '@vue-source/runtime-core'
import { EMPTY_OBJ } from '@vue-source/shared'

/**
 * 作用：返回当前组件绑定的某个 CSS Module 对象。
 *
 * 参数说明：
 * - `name`：CSS Module 名称，默认读取最常见的 `$style`。
 */
export function useCssModule(name = '$style'): Record<string, string> {
  /**
   * 读取当前组件注入的 CSS Modules 映射表。
   *
   * 主要功能：
   * - 从当前组件定义的 `__cssModules` 中取出指定模块
   * - 默认返回最常见的 `$style`
   * - 找不到当前实例、模块容器或具体模块名时在开发环境给出提示
   *
   * 参数：
   * - `name`：要读取的 CSS Module 名称
   */
  if (!__GLOBAL__) {
    const instance = getCurrentInstance()!
    if (!instance) {
      __DEV__ && warn(`useCssModule must be called inside setup()`)
      return EMPTY_OBJ
    }
    // `__cssModules` 挂在组件定义对象上，按模块名保存 class 名映射表。
    const modules = instance.type.__cssModules
    if (!modules) {
      __DEV__ && warn(`Current instance does not have CSS modules injected.`)
      return EMPTY_OBJ
    }
    // `mod` 就是当前请求名称对应的那一份 class 映射。
    const mod = modules[name]
    if (!mod) {
      __DEV__ &&
        warn(`Current instance does not have CSS module named "${name}".`)
      return EMPTY_OBJ
    }
    return mod as Record<string, string>
  } else {
    /* v8 ignore start */
    if (__DEV__) {
      warn(`useCssModule() is not supported in the global build.`)
    }
    return EMPTY_OBJ
    /* v8 ignore stop */
  }
}
