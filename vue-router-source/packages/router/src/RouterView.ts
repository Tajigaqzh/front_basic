import type {
  PropType,
  ComponentPublicInstance,
  VNodeProps,
  AllowedComponentProps,
  ComponentCustomProps,
  Slot,
  VNode,
  Component,
} from 'vue'
import {
  h,
  inject,
  provide,
  defineComponent,
  ref,
  unref,
  getCurrentInstance,
  computed,
  watch,
} from 'vue'
import type {
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
} from './typed-routes'
import type { RouteLocationMatched } from './types'
import {
  matchedRouteKey,
  viewDepthKey,
  routerViewLocationKey,
} from './injectionSymbols'
import { assign, isArray, isBrowser } from './utils'
import { warn } from './warning'
import { isSameRouteRecord } from './location'

export interface RouterViewProps {
  name?: string
  // allow looser type for user facing api
  route?: RouteLocationNormalized
}

export interface RouterViewDevtoolsContext extends Pick<
  RouteLocationMatched,
  'path' | 'name' | 'meta'
> {
  depth: number
}

export const RouterViewImpl = /*#__PURE__*/ defineComponent({
  name: 'RouterView',
  // #674 we manually inherit them
  inheritAttrs: false,
  props: {
    name: {
      type: String as PropType<string>,
      default: 'default',
    },
    route: Object as PropType<RouteLocationNormalizedLoaded>,
  },

  // Better compat for @vue/compat users
  // https://github.com/vuejs/router/issues/1315
  compatConfig: { MODE: 3 },

  setup(props, { attrs, slots }) {
    __DEV__ && warnDeprecatedUsage()

    const injectedRoute = inject(routerViewLocationKey)!
    // RouterView 默认渲染“当前全局 currentRoute”，
    // 但也允许通过 route prop 注入一条替代路线，用于高级场景或测试。
    const routeToDisplay = computed<RouteLocationNormalizedLoaded>(
      () => props.route || injectedRoute.value
    )
    const injectedDepth = inject(viewDepthKey, 0)
    // depth 不是简单地父 + 1。
    // 某些 route record 只负责占位或嵌套路由，本身没有 components，需要继续向下透传。
    // The depth changes based on empty components option, which allows passthrough routes e.g. routes with children
    // that are used to reuse the `path` property
    const depth = computed<number>(() => {
      let initialDepth = unref(injectedDepth)
      const { matched } = routeToDisplay.value
      let matchedRoute: RouteLocationMatched | undefined
      while (
        (matchedRoute = matched[initialDepth]) &&
        !matchedRoute.components
      ) {
        initialDepth++
      }
      return initialDepth
    })
    const matchedRouteRef = computed<RouteLocationMatched | undefined>(
      () => routeToDisplay.value.matched[depth.value]
    )

    // 这三次 provide 很关键：
    // 1. depth + 1 传给下一层 RouterView
    // 2. 当前 matched record 提供给组件级守卫 API
    // 3. 当前 route 提供给更深层 RouterView/useRoute 相关逻辑
    provide(
      viewDepthKey,
      computed(() => depth.value + 1)
    )
    provide(matchedRouteKey, matchedRouteRef)
    provide(routerViewLocationKey, routeToDisplay)

    const viewRef = ref<ComponentPublicInstance>()

    // watch at the same time the component instance, the route record we are
    // rendering, and the name
    watch(
      () => [viewRef.value, matchedRouteRef.value, props.name] as const,
      ([instance, to, name], [oldInstance, from, _oldName]) => {
        // RouterView 不只负责渲染组件，也负责把组件实例回填到 matched record，
        // 这样 beforeRouteEnter / leave / update 等守卫才能拿到正确实例。
        // copy reused instances
        if (to) {
          // this will update the instance for new instances as well as reused
          // instances when navigating to a new route
          to.instances[name] = instance
          // the component instance is reused for a different route or name, so
          // we copy any saved update or leave guards. With async setup, the
          // mounting component will mount before the matchedRoute changes,
          // making instance === oldInstance, so we check if guards have been
          // added before. This works because we remove guards when
          // unmounting/deactivating components
          if (from && from !== to && instance && instance === oldInstance) {
            if (!to.leaveGuards.size) {
              to.leaveGuards = from.leaveGuards
            }
            if (!to.updateGuards.size) {
              to.updateGuards = from.updateGuards
            }
          }
        }

        // trigger beforeRouteEnter next callbacks
        if (
          instance &&
          to &&
          // if there is no instance but to and from are the same this might be
          // the first visit
          (!from || !isSameRouteRecord(to, from) || !oldInstance)
        ) {
          ;(to.enterCallbacks[name] || []).forEach(callback =>
            callback(instance)
          )
        }
      },
      { flush: 'post' }
    )

    return () => {
      const route = routeToDisplay.value
      // we need the value at the time we render because when we unmount, we
      // navigated to a different location so the value is different
      const currentName = props.name
      const matchedRoute = matchedRouteRef.value
      const ViewComponent =
        matchedRoute && matchedRoute.components![currentName]

      if (!ViewComponent) {
        return normalizeSlot(slots.default, { Component: ViewComponent, route })
      }

      // props from route configuration
      const routePropsOption = matchedRoute.props[currentName]
      const routeProps = routePropsOption
        ? routePropsOption === true
          ? route.params
          : typeof routePropsOption === 'function'
            ? routePropsOption(route)
            : routePropsOption
        : null
      // route record 上声明的 props 会在这里被真正投递给页面组件。

      const onVnodeUnmounted: VNodeProps['onVnodeUnmounted'] = vnode => {
        // remove the instance reference to prevent leak
        if (vnode.component!.isUnmounted) {
          matchedRoute.instances[currentName] = null
        }
      }

      const component = h(
        ViewComponent,
        assign({}, routeProps, attrs, {
          onVnodeUnmounted,
          ref: viewRef,
        })
      )

      if (
        (__DEV__ || __FEATURE_PROD_DEVTOOLS__) &&
        isBrowser &&
        component.ref
      ) {
        // TODO: can display if it's an alias, its props
        const info: RouterViewDevtoolsContext = {
          depth: depth.value,
          name: matchedRoute.name,
          path: matchedRoute.path,
          meta: matchedRoute.meta,
        }

        const internalInstances = isArray(component.ref)
          ? component.ref.map(r => r.i)
          : [component.ref.i]

        internalInstances.forEach(instance => {
          // @ts-expect-error
          instance.__vrv_devtools = info
        })
      }

      return (
        // pass the vnode to the slot as a prop.
        // h and <component :is="..."> both accept vnodes
        normalizeSlot(slots.default, { Component: component, route }) ||
        component
      )
    }
  },
})

function normalizeSlot(slot: Slot | undefined, data: any) {
  if (!slot) return null
  const slotContent = slot(data)
  return slotContent.length === 1 ? slotContent[0] : slotContent
}

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
/**
 * Component to display the current route the user is at.
 */
export const RouterView = RouterViewImpl as unknown as {
  new (): {
    $props: AllowedComponentProps &
      ComponentCustomProps &
      VNodeProps &
      RouterViewProps

    $slots: {
      default?: ({
        Component,
        route,
      }: {
        Component: VNode
        route: RouteLocationNormalizedLoaded
      }) => VNode[]
    }
  }
}

// warn against deprecated usage with <transition> & <keep-alive>
// due to functional component being no longer eager in Vue 3
function warnDeprecatedUsage() {
  const instance = getCurrentInstance()!
  const parentName = instance.parent && instance.parent.type.name
  const parentSubTreeType =
    instance.parent && instance.parent.subTree && instance.parent.subTree.type
  if (
    parentName &&
    (parentName === 'KeepAlive' || parentName.includes('Transition')) &&
    typeof parentSubTreeType === 'object' &&
    (parentSubTreeType as Component).name === 'RouterView'
  ) {
    const comp = parentName === 'KeepAlive' ? 'keep-alive' : 'transition'
    warn(
      `<router-view> can no longer be used directly inside <${comp}>.\n` +
        `Use slot props instead:\n\n` +
        `<router-view v-slot="{ Component }">\n` +
        `  <${comp}>\n` +
        `    <component :is="Component" />\n` +
        `  </${comp}>\n` +
        `</router-view>`
    )
  }
}
