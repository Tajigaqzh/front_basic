# 源码关键流程图

这一页用于配合源码阅读，关注 Vue Router 内部几个最核心的执行链路。图中的函数名都可以在 `packages/router/src` 下找到。

## 路由器初始化

`createRouter()` 会把用户传入的路由表、history 实现、全局守卫集合和当前路由状态组织到同一个 router 实例中。应用调用 `app.use(router)` 后，router 才会注册组件、注入依赖，并在浏览器端触发首轮导航。

```mermaid
flowchart LR
  routes["options.routes<br/>用户路由表"] --> matcher["createRouterMatcher()<br/>编译、排序、按 name 建索引"]
  history["options.history<br/>web / hash / memory"] --> routerHistory["routerHistory<br/>负责 URL 与 history.state"]
  matcher --> guards["beforeGuards<br/>全局 beforeEach 集合"]
  matcher --> current["currentRoute<br/>响应式当前路由"]
  routerHistory --> pending["pendingLocation<br/>取消旧导航的依据"]
  guards --> router["router 对象<br/>push / replace / resolve<br/>beforeEach / afterEach<br/>install(app)"]
  current --> router
  pending --> router
  router --> install["app.use(router)<br/>注册 RouterLink / RouterView<br/>provide 依赖<br/>浏览器端触发初始导航"]
```

相关源码：

- `packages/router/src/router.ts`
- `packages/router/src/matcher/index.ts`
- `packages/router/src/history/html5.ts`
- `packages/router/src/history/memory.ts`

## 一次 `router.push()` 导航

编程式导航和 `<RouterLink>` 点击最终都会收敛到 `pushWithRedirect()`。它先标准化目标地址，再处理 route record 上的 `redirect`，随后串行执行导航守卫。只有守卫全部通过后，才会进入 `finalizeNavigation()` 更新 URL、`currentRoute` 和滚动位置。

```mermaid
flowchart TD
  entry["RouterLink 点击<br/>或 router.push(to)"] --> resolve["resolve(to)<br/>标准化目标地址"]
  resolve --> redirect{"命中 route record<br/>redirect?"}
  redirect -- 是 --> restart["合并 query / hash / state<br/>递归 pushWithRedirect()"]
  restart --> resolve
  redirect -- 否 --> duplicated{"目标与当前<br/>是否相同?"}
  duplicated -- 是 --> duplicatedFailure["返回 duplicated failure<br/>仍可触发同锚点滚动"]
  duplicated -- 否 --> navigate["navigate(to, from)<br/>串行执行守卫队列"]
  navigate --> guardResult{"守卫结果"}
  guardResult -- "返回新地址" --> guardRedirect["NAVIGATION_GUARD_REDIRECT<br/>重开一轮导航"]
  guardRedirect --> restart
  guardResult -- "false / Error / 被取消" --> failure["产生 navigation failure<br/>或进入 onError"]
  guardResult -- "全部通过" --> finalize["finalizeNavigation()<br/>写 history<br/>更新 currentRoute<br/>处理滚动"]
  duplicatedFailure --> afterEach["triggerAfterEach(to, from, failure)"]
  failure --> afterEach
  finalize --> afterEach
```

相关源码：

- `packages/router/src/router.ts`
- `packages/router/src/location.ts`
- `packages/router/src/errors.ts`

## 导航守卫队列

导航守卫不是一起执行的，而是按固定阶段串行执行。每个阶段之间都会插入取消检查，用来发现当前导航是否已经被新的导航打断。

```mermaid
flowchart LR
  leave["beforeRouteLeave<br/>离开组件，反向"] --> c1["取消检查"]
  c1 --> beforeEach["全局 beforeEach"]
  beforeEach --> c2["取消检查"]
  c2 --> update["beforeRouteUpdate<br/>复用组件"]
  update --> c3["取消检查"]
  c3 --> beforeEnter["beforeEnter<br/>路由独享"]
  beforeEnter --> c4["取消检查"]
  c4 --> enter["beforeRouteEnter<br/>新组件，含异步加载"]
  enter --> c5["取消检查"]
  c5 --> beforeResolve["全局 beforeResolve<br/>确认前最后关口"]
  beforeResolve --> c6["取消检查"]
  c6 --> done["守卫通过<br/>进入 finalizeNavigation()"]
```

相关源码：

- `packages/router/src/router.ts`
- `packages/router/src/navigationGuards.ts`

## Matcher 编译与解析

matcher 的核心职责是把用户写的 `RouteRecordRaw` 编译成内部 matcher，并在导航时把 `path`、`name + params` 或相对地址解析成 `matched` 渲染链。

```mermaid
flowchart TD
  raw["RouteRecordRaw<br/>用户配置"] --> normalize["normalizeRouteRecord()<br/>统一 components / props / guards 容器"]
  normalize --> alias["alias 展开<br/>生成平行 matcher"]
  alias --> recordMatcher["createRouteRecordMatcher()<br/>path 转正则和 score"]
  recordMatcher --> matchers["matchers[]<br/>按 score 排序<br/>path 扫描命中"]
  recordMatcher --> matcherMap["matcherMap<br/>按 name 直接查找<br/>只存原始记录"]

  resolve["resolve(location)<br/>导航时解析地址"] --> byName{"name + params?"}
  byName -- 是 --> namePath["查 matcherMap<br/>筛选/继承 params<br/>stringify 得到 path"]
  byName -- 否 --> byPath{"path?"}
  byPath -- 是 --> pathMatch["按 matchers 顺序<br/>正则 find + parse params"]
  byPath -- 否 --> relative["相对导航<br/>复用 currentLocation 的 matcher<br/>合并 params"]

  namePath --> result["MatcherLocation<br/>path / name / params<br/>matched 父到子链<br/>meta 浅合并"]
  pathMatch --> result
  relative --> result
```

相关源码：

- `packages/router/src/matcher/index.ts`
- `packages/router/src/matcher/pathMatcher.ts`
- `packages/router/src/matcher/pathParserRanker.ts`
- `packages/router/src/matcher/pathTokenizer.ts`

## History 与浏览器地址同步

HTML5 history 模式负责把 router 的导航提交写入浏览器地址栏，也负责把浏览器前进、后退产生的 `popstate` 事件反向交给 router。导航失败时，router 会通过 `go(-delta, false)` 回滚 URL，并暂停这一次回滚事件的监听。

```mermaid
flowchart TD
  push["routerHistory.push()<br/>或 replace()"] --> change["changeLocation()<br/>拼 base 和目标 URL"]
  change --> state["history.state<br/>back / current / forward<br/>position / scroll"]
  state --> address["history.pushState / replaceState<br/>地址栏变化"]

  address --> pop["浏览器前进 / 后退<br/>popstate"]
  pop --> listener["history.listen()<br/>计算 delta 和方向"]
  listener --> routerNav["router 导航<br/>resolve + guards"]
  routerNav --> ok{"导航成功?"}
  ok -- 是 --> accept["更新 currentRoute<br/>触发 afterEach"]
  ok -- 否 --> rollback["routerHistory.go(-delta, false)<br/>回滚 URL，暂停下一次 listener"]
  rollback --> address

  state --> scroll["pagehide / visibilitychange<br/>保存滚动位置到 history.state"]
```

相关源码：

- `packages/router/src/history/html5.ts`
- `packages/router/src/history/common.ts`
- `packages/router/src/scrollBehavior.ts`

## RouterLink 与 RouterView

`RouterLink` 主要负责把 `to` 解析成 `href`、判断 active 状态，并在点击时触发导航。`RouterView` 则根据当前 route 的 `matched` 链和嵌套深度找到要渲染的组件，同时维护组件实例与组件级守卫回调。

```mermaid
flowchart TD
  link["RouterLink<br/>接收 to / replace"] --> useLink["useLink()<br/>inject router / route"]
  useLink --> resolveLink["router.resolve(to)<br/>生成 href 和 route"]
  useLink --> active["active 计算<br/>matched record + params"]
  resolveLink --> click["点击事件"]
  active --> click
  click --> guardEvent{"guardEvent 通过?"}
  guardEvent -- 否 --> native["保留原生链接行为<br/>新标签页 / 右键 / 组合键"]
  guardEvent -- 是 --> push["router.push()<br/>或 replace()"]

  current["currentRoute"] --> view["RouterView<br/>inject route / depth"]
  view --> depth["计算 depth<br/>跳过无组件 record"]
  depth --> matched["matchedRoute<br/>按 name 取组件"]
  matched --> render["渲染组件<br/>props + attrs + slot"]
  matched --> instance["实例回填<br/>instances / enterCallbacks"]
  instance --> guards["组件级守卫<br/>leave / update / enter callback"]
```

相关源码：

- `packages/router/src/RouterLink.ts`
- `packages/router/src/RouterView.ts`
- `packages/router/src/injectionSymbols.ts`
- `packages/router/src/navigationGuards.ts`
