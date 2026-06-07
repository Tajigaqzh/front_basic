import type {
  NavigationGuard,
  NavigationGuardNextCallback,
  _RouteRecordProps,
} from '../typed-routes'
import type {
  RouteRecordMultipleViews,
  _RouteRecordBase,
  RouteRecordRaw,
} from '../types'
import type { ComponentPublicInstance } from 'vue'

// 这里把用户写的多种 RouteRecordRaw 形态压平成统一结构，方便 matcher/router 运行时处理。
/**
 * Normalized version of a {@link RouteRecord | route record}.
 */
export interface RouteRecordNormalized {
  /**
   * {@inheritDoc _RouteRecordBase.path}
   */
  path: _RouteRecordBase['path']
  /**
   * {@inheritDoc _RouteRecordBase.redirect}
   */
  redirect: _RouteRecordBase['redirect'] | undefined
  /**
   * {@inheritDoc _RouteRecordBase.name}
   */
  name: _RouteRecordBase['name']
  /**
   * {@inheritDoc RouteRecordMultipleViews.components}
   */
  components: RouteRecordMultipleViews['components'] | null | undefined

  /**
   * Contains the original modules for lazy loaded components.
   * @internal
   */
  mods: Record<string, unknown>

  /**
   * Nested route records.
   */
  // children 仍保留 raw 形态，后续会递归再走一次 normalize 流程。
  children: RouteRecordRaw[]
  /**
   * {@inheritDoc _RouteRecordBase.meta}
   */
  meta: Exclude<_RouteRecordBase['meta'], void>
  /**
   * {@inheritDoc RouteRecordMultipleViews.props}
   */
  props: Record<string, _RouteRecordProps>
  /**
   * Registered beforeEnter guards
   */
  // beforeEnter 不像 leave/update 那样按实例动态注册，因此直接保留原定义值。
  beforeEnter: _RouteRecordBase['beforeEnter']
  /**
   * Registered leave guards
   *
   * @internal
   */
  leaveGuards: Set<NavigationGuard>
  /**
   * Registered update guards
   *
   * @internal
   */
  updateGuards: Set<NavigationGuard>
  /**
   * Registered beforeRouteEnter callbacks passed to `next` or returned in guards
   *
   * @internal
   */
  enterCallbacks: Record<string, NavigationGuardNextCallback[]>
  /**
   * Mounted route component instances
   * Having the instances on the record mean beforeRouteUpdate and
   * beforeRouteLeave guards can only be invoked with the latest mounted app
   * instance if there are multiple application instances rendering the same
   * view, basically duplicating the content on the page, which shouldn't happen
   * in practice. It will work if multiple apps are rendering different named
   * views.
   */
  instances: Record<string, ComponentPublicInstance | undefined | null>
  // can only be of the same type as this record
  /**
   * Defines if this record is the alias of another one. This property is
   * `undefined` if the record is the original one.
   */
  // alias 记录与原记录共享大部分运行时状态，但 name/matched 会折叠回原记录。
  aliasOf: RouteRecordNormalized | undefined
}

/**
 * {@inheritDoc RouteRecordNormalized}
 */
export type RouteRecord = RouteRecordNormalized
