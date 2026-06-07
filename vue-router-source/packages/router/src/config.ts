/**
 * Allows customizing existing types of the router that are used globally like `$router`, `<RouterLink>`, etc. **ONLY FOR INTERNAL USAGE**.
 *
 * - `Router` - swaps the public {@link Router} type (e.g. to `EXPERIMENTAL_Router`)
 * - `$router` - the router instance
 * - `$route` - the current route location
 * - `beforeRouteEnter` - Page component option
 * - `beforeRouteUpdate` - Page component option
 * - `beforeRouteLeave` - Page component option
 * - `RouterLink` - RouterLink Component
 * - `RouterView` - RouterView Component
 *
 * @internal
 */
export interface TypesConfig {}
// 这个接口本身是空的，设计目的是让用户或内部实验能力通过模块扩展注入类型槽位。
// 例如切换 Router 公共类型、覆盖 `$route` / `$router` 类型等。
