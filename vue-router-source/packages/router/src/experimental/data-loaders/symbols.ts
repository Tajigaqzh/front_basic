/**
 * Retrieves the internal version of loaders.
 * @internal
 */
export const LOADER_SET_KEY = Symbol('loaders')
// 挂在 route meta 上，表示当前 record/导航关联到的 loader 集合。

/**
 * Retrieves the internal version of loader entries.
 * @internal
 */
export const LOADER_ENTRIES_KEY = Symbol('loaderEntries')
// 挂在 router 上，保存所有 loader -> entry 的运行时映射。

/**
 * Added to the loaders returned by `defineLoader()` to identify them.
 * Allows to extract exported useData() from a component.
 * @internal
 */
export const IS_USE_DATA_LOADER_KEY = Symbol()
// 挂在 loader composable 上，用于运行时类型识别。

/**
 * Symbol used to save the pending location on the router.
 * @internal
 */
export const PENDING_LOCATION_KEY = Symbol()
// 挂在 router 上，标记“当前仍在等待 loaders 结束的导航目标”。

/**
 * Symbol used to know there is no value staged for the loader and that commit should be skipped.
 * @internal
 */
export const STAGED_NO_VALUE = Symbol()
// staged 区域的专用哨兵值，区分“还没出结果”与“结果就是 undefined/null”。

/**
 * Gives access to the current app and it's `runWithContext` method.
 * @internal
 */
export const APP_KEY = Symbol()
// 保存 app 实例，便于 loader 在 app.runWithContext 中执行。

/**
 * Gives access to an AbortController that aborts when the navigation is canceled.
 * @internal
 */
export const ABORT_CONTROLLER_KEY = Symbol()
// 挂在 route meta 上，为当前导航的 loaders 提供统一 abort signal。

/**
 * Symbol used to save the initial data on the router.
 * @internal
 */
export const IS_SSR_KEY = Symbol()
// 挂在 router 上，标记当前 data loader 执行环境是否是 SSR。

/**
 * Symbol used to get the effect scope used for data loaders.
 * @internal
 */
export const DATA_LOADERS_EFFECT_SCOPE_KEY = Symbol()
// 保存数据加载器运行使用的 effect scope，便于和缓存/副作用系统配合。
