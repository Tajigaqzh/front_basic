import type {
  RouterHistory,
  NavigationCallback,
  HistoryState,
  ValueContainer,
  HistoryLocation,
} from './common'
import {
  NavigationType,
  NavigationDirection,
  normalizeBase,
  createHref,
} from './common'
import type { _ScrollPositionNormalized } from '../scrollBehavior'
import { computeScrollPosition } from '../scrollBehavior'
import { warn } from '../warning'
import { stripBase } from '../location'
import { assign } from '../utils'

type PopStateListener = (this: Window, ev: PopStateEvent) => any

let createBaseLocation = () => location.protocol + '//' + location.host

interface StateEntry extends HistoryState {
  back: HistoryLocation | null
  current: HistoryLocation
  forward: HistoryLocation | null
  position: number
  replaced: boolean
  scroll: _ScrollPositionNormalized | null | false
}

/**
 * Creates a normalized history location from a window.location object
 * @param base - The base path
 * @param location - The window.location object
 */
function createCurrentLocation(
  base: string,
  location: Location
): HistoryLocation {
  const { pathname, search, hash } = location
  // allows hash bases like #, /#, #/, #!, #!/, /#!/, or even /folder#end
  const hashPos = base.indexOf('#')
  if (hashPos > -1) {
    let slicePos = hash.includes(base.slice(hashPos))
      ? base.slice(hashPos).length
      : 1
    let pathFromHash = hash.slice(slicePos)
    // prepend the starting slash to hash so the url starts with /#
    if (pathFromHash[0] !== '/') pathFromHash = '/' + pathFromHash
    return stripBase(pathFromHash, '')
  }
  const path = stripBase(pathname, base)
  return path + search + hash
}

function useHistoryListeners(
  base: string,
  historyState: ValueContainer<StateEntry>,
  currentLocation: ValueContainer<HistoryLocation>,
  replace: RouterHistory['replace']
) {
  // HTML5 history 模式下，浏览器是“地址先变，router 后感知”，
  // 所以这里负责把 popstate 事件翻译成 router 能理解的导航事件。
  let listeners: NavigationCallback[] = []
  let teardowns: Array<() => void> = []
  // TODO: should it be a stack? a Dict. Check if the popstate listener
  // can trigger twice
  let pauseState: HistoryLocation | null = null

  const popStateHandler: PopStateListener = ({
    state,
  }: {
    state: StateEntry | null
  }) => {
    const to = createCurrentLocation(base, location)
    const from: HistoryLocation = currentLocation.value
    const fromState: StateEntry = historyState.value
    let delta = 0

    if (state) {
      currentLocation.value = to
      historyState.value = state

      // ignore the popstate and reset the pauseState
      // routerHistory.go(delta, false) 会设置 pauseState，用来避免“回滚 URL”再次触发导航。
      if (pauseState && pauseState === from) {
        pauseState = null
        return
      }
      delta = fromState ? state.position - fromState.position : 0
    } else {
      // 没有 state 通常说明用户或第三方代码直接改了 history，先补一份 router 需要的 state。
      replace(to)
    }

    // Here we could also revert the navigation by calling history.go(-delta)
    // this listener will have to be adapted to not trigger again and to wait for the url
    // to be updated before triggering the listeners. Some kind of validation function would also
    // need to be passed to the listeners so the navigation can be accepted
    // call all listeners
    listeners.forEach(listener => {
      listener(currentLocation.value, from, {
        delta,
        type: NavigationType.pop,
        direction: delta
          ? delta > 0
            ? NavigationDirection.forward
            : NavigationDirection.back
          : NavigationDirection.unknown,
      })
    })
  }

  function pauseListeners() {
    pauseState = currentLocation.value
  }

  function listen(callback: NavigationCallback) {
    // set up the listener and prepare teardown callbacks
    // Router 层通过 listen 接入 popstate；history 层只负责派发标准化事件。
    listeners.push(callback)

    const teardown = () => {
      const index = listeners.indexOf(callback)
      if (index > -1) listeners.splice(index, 1)
    }

    teardowns.push(teardown)
    return teardown
  }

  function beforeUnloadListener() {
    // 页面进入隐藏态前，把当前位置滚动状态塞回 history.state，
    // 这样浏览器前进/后退时 scrollBehavior 才能拿到 savedPosition。
    if (document.visibilityState === 'hidden') {
      const { history } = window
      if (!history.state) return
      history.replaceState(
        assign({}, history.state, { scroll: computeScrollPosition() }),
        ''
      )
    }
  }

  function destroy() {
    for (const teardown of teardowns) teardown()
    teardowns = []
    window.removeEventListener('popstate', popStateHandler)
    window.removeEventListener('pagehide', beforeUnloadListener)
    document.removeEventListener('visibilitychange', beforeUnloadListener)
  }

  // set up the listeners and prepare teardown callbacks
  window.addEventListener('popstate', popStateHandler)
  // https://developer.chrome.com/blog/page-lifecycle-api/
  // note: iOS safari does not fire beforeunload, so we
  // use pagehide and visibilitychange instead
  window.addEventListener('pagehide', beforeUnloadListener)
  document.addEventListener('visibilitychange', beforeUnloadListener)

  return {
    pauseListeners,
    listen,
    destroy,
  }
}

/**
 * Creates a state object
 */
function buildState(
  back: HistoryLocation | null,
  current: HistoryLocation,
  forward: HistoryLocation | null,
  replaced: boolean = false,
  computeScroll: boolean = false
): StateEntry {
  // vue-router 自己维护 back/current/forward，
  // 目的是在原生 history API 之上补足导航方向和滚动恢复所需的信息。
  return {
    back,
    current,
    forward,
    replaced,
    position: window.history.length,
    scroll: computeScroll ? computeScrollPosition() : null,
  }
}

function useHistoryStateNavigation(base: string) {
  const { history, location } = window

  // private variables
  const currentLocation: ValueContainer<HistoryLocation> = {
    value: createCurrentLocation(base, location),
  }
  const historyState: ValueContainer<StateEntry> = { value: history.state }
  // build current history entry as this is a fresh navigation
  if (!historyState.value) {
    changeLocation(
      currentLocation.value,
      {
        back: null,
        current: currentLocation.value,
        forward: null,
        // the length is off by one, we need to decrease it
        position: history.length - 1,
        replaced: true,
        // don't add a scroll as the user may have an anchor, and we want
        // scrollBehavior to be triggered without a saved position
        scroll: null,
      },
      true
    )
  }

  function changeLocation(
    to: HistoryLocation,
    state: StateEntry,
    replace: boolean
  ): void {
    // 这里是唯一真正写入浏览器地址栏的位置。
    // router.push / router.replace 最终都会收敛到它。
    /**
     * if a base tag is provided, and we are on a normal domain, we have to
     * respect the provided `base` attribute because pushState() will use it and
     * potentially erase anything before the `#` like at
     * https://github.com/vuejs/router/issues/685 where a base of
     * `/folder/#` but a base of `/` would erase the `/folder/` section. If
     * there is no host, the `<base>` tag makes no sense and if there isn't a
     * base tag we can just use everything after the `#`.
     */
    const hashIndex = base.indexOf('#')
    const url =
      hashIndex > -1
        ? (location.host && document.querySelector('base')
            ? base
            : base.slice(hashIndex)) + to
        : createBaseLocation() + base + to
    try {
      // BROWSER QUIRK
      // NOTE: Safari throws a SecurityError when calling this function 100 times in 30 seconds
      history[replace ? 'replaceState' : 'pushState'](state, '', url)
      historyState.value = state
    } catch (err) {
      if (__DEV__) {
        warn('Error with push/replace State', err)
      } else {
        console.error(err)
      }
      // Force the navigation, this also resets the call count
      location[replace ? 'replace' : 'assign'](url)
    }
  }

  function replace(to: HistoryLocation, data?: HistoryState) {
    // replace 不新增 history 项，只覆盖当前项的 current / scroll / custom state。
    const state: StateEntry = assign(
      {},
      history.state,
      buildState(
        historyState.value.back,
        // keep back and forward entries but override current position
        to,
        historyState.value.forward,
        true
      ),
      data,
      { position: historyState.value.position }
    )

    changeLocation(to, state, true)
    currentLocation.value = to
  }

  function push(to: HistoryLocation, data?: HistoryState) {
    // push 会先补写“当前项的 forward 信息”，再创建“目标项”。
    // Add to current entry the information of where we are going
    // as well as saving the current position
    const currentState = assign(
      {},
      // use current history state to gracefully handle a wrong call to
      // history.replaceState
      // https://github.com/vuejs/router/issues/366
      historyState.value,
      history.state as Partial<StateEntry> | null,
      {
        forward: to,
        scroll: computeScrollPosition(),
      }
    )

    if (__DEV__ && !history.state) {
      warn(
        `history.state seems to have been manually replaced without preserving the necessary values. Make sure to preserve existing history state if you are manually calling history.replaceState:\n\n` +
          `history.replaceState(history.state, '', url)\n\n` +
          `You can find more information at https://router.vuejs.org/guide/migration/#Usage-of-history-state`
      )
    }

    changeLocation(currentState.current, currentState, true)

    const state: StateEntry = assign(
      {},
      buildState(currentLocation.value, to, null),
      { position: currentState.position + 1 },
      data
    )

    changeLocation(to, state, false)
    currentLocation.value = to
  }

  return {
    location: currentLocation,
    state: historyState,

    push,
    replace,
  }
}

/**
 * Creates an HTML5 history. Most common history for single page applications.
 *
 * @param base -
 */
export function createWebHistory(base?: string): RouterHistory {
  base = normalizeBase(base)

  const historyNavigation = useHistoryStateNavigation(base)
  const historyListeners = useHistoryListeners(
    base,
    historyNavigation.state,
    historyNavigation.location,
    historyNavigation.replace
  )
  function go(delta: number, triggerListeners = true) {
    // triggerListeners=false 常用于导航失败回滚 URL，但不想再次进入 router 导航流程。
    if (!triggerListeners) historyListeners.pauseListeners()
    history.go(delta)
  }

  const routerHistory: RouterHistory = assign(
    {
      // it's overridden right after
      location: '',
      base,
      go,
      createHref: createHref.bind(null, base),
    },

    historyNavigation,
    historyListeners
  )

  // 对外暴露的是只读 getter，内部则通过 ValueContainer 维持可变状态。
  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => historyNavigation.location.value,
  })

  Object.defineProperty(routerHistory, 'state', {
    enumerable: true,
    get: () => historyNavigation.state.value,
  })

  return routerHistory
}
