/**
 * 文件作用：兼容层能力实现。
 *
 * 当前文件 globalConfig.ts 服务于 compat 模式，
 * 用来兼容 Vue 2 时代的部分运行时行为或 API 语义。
 */

import type { AppConfig } from '../apiCreateApp'
import {
  DeprecationTypes,
  softAssertCompatEnabled,
  warnDeprecation,
} from './compatConfig'
import { isCopyingConfig } from './global'
import { internalOptionMergeStrats } from '../componentOptions'

// legacy config warnings
export type LegacyConfig = {
  /**
   * @deprecated `config.silent` option has been removed
   */
  silent?: boolean
  /**
   * @deprecated use __VUE_PROD_DEVTOOLS__ compile-time feature flag instead
   * https://github.com/vuejs/core/tree/main/packages/vue#bundler-build-feature-flags
   */
  devtools?: boolean
  /**
   * @deprecated use `config.isCustomElement` instead
   * https://v3-migration.vuejs.org/breaking-changes/global-api.html#config-ignoredelements-is-now-config-iscustomelement
   */
  ignoredElements?: (string | RegExp)[]
  /**
   * @deprecated
   * https://v3-migration.vuejs.org/breaking-changes/keycode-modifiers.html
   */
  keyCodes?: Record<string, number | number[]>
  /**
   * @deprecated
   * https://v3-migration.vuejs.org/breaking-changes/global-api.html#config-productiontip-removed
   */
  productionTip?: boolean
}

/**
 * 作用：给 `app.config` 安装 Vue 2 时代遗留配置项的开发期 warning 拦截。
 *
 * 参数说明：
 * - `config`：当前应用的 `app.config` 对象。
 *
 * 依赖关系：
 * - 通过 `Object.defineProperty` 拦截旧字段的读写。
 * - 配合 `isCopyingConfig` 避免在内部复制配置时产生误报。
 */
export function installLegacyConfigWarnings(config: AppConfig): void {
  // 这张映射表定义了“某个旧 config 字段”对应哪一种废弃告警类型。
  const legacyConfigOptions: Record<string, DeprecationTypes> = {
    silent: DeprecationTypes.CONFIG_SILENT,
    devtools: DeprecationTypes.CONFIG_DEVTOOLS,
    ignoredElements: DeprecationTypes.CONFIG_IGNORED_ELEMENTS,
    keyCodes: DeprecationTypes.CONFIG_KEY_CODES,
    productionTip: DeprecationTypes.CONFIG_PRODUCTION_TIP,
  }

  Object.keys(legacyConfigOptions).forEach(key => {
    let val = (config as any)[key]
    Object.defineProperty(config, key, {
      enumerable: true,
      get() {
        return val
      },
      set(newVal) {
        // 只有用户显式改写这些旧配置时才提示；内部复制配置时跳过。
        if (!isCopyingConfig) {
          warnDeprecation(legacyConfigOptions[key], null)
        }
        val = newVal
      },
    })
  })
}

/**
 * 作用：给 `app.config.optionMergeStrategies` 安装 Vue 2 兼容代理。
 *
 * 核心行为：
 * - 用户自定义 merge strategy 仍优先返回。
 * - 当访问 Vue 内置合并策略时，compat 模式下允许读取，并给出迁移 warning。
 */
export function installLegacyOptionMergeStrats(config: AppConfig): void {
  config.optionMergeStrategies = new Proxy({} as any, {
    get(target, key) {
      if (key in target) {
        return target[key]
      }
      if (
        key in internalOptionMergeStrats &&
        softAssertCompatEnabled(
          DeprecationTypes.CONFIG_OPTION_MERGE_STRATS,
          null,
        )
      ) {
        // 兼容模式下把内部合并策略暴露出来，尽量维持 Vue 2 插件的可运行性。
        return internalOptionMergeStrats[
          key as keyof typeof internalOptionMergeStrats
        ]
      }
    },
  })
}
