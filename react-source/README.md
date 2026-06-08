# React TS Source

这是一个面向学习的 React TypeScript 源码复刻版本，按官方 React `packages/*` 的包边界组织。

`react-source/packages/*` 下的子包目录名与官方包名保持一致；根工程包名保留为 `@front/react-source`。

第一批纳入 client/runtime 核心包：

- `shared`
- `scheduler`
- `react`
- `react-dom`
- `react-dom-bindings`
- `react-reconciler`
- `react-is`
- `react-refresh`
- `react-cache`
- `use-sync-external-store`
- `use-subscription`

不纳入服务端渲染、RSC 服务端绑定、DevTools、测试/fixture 类包。

当前已实现并跑通的主链路：

- ReactElement / JSX runtime
- Fiber 数据结构与双缓存
- beginWork / completeWork / commitWork 三段式渲染
- 函数组件与 `useState/useReducer/useRef/useMemo/useCallback/useEffect`
- DOM 属性、事件、文本节点更新
- 根容器事件委托、DOM node 到 Fiber/props 映射
- 基于微任务的简化调度器
- `react-cache` 的官方 LRU 环形双向链表
- Context Provider/Consumer、`useContext` 与 context dependency 记录
- class component mount/update、`setState/forceUpdate` 更新队列
- Suspense/Offscreen fallback、wakeable ping retry、dehydrated hydration 主路径
- hidden Offscreen host instance 显隐与 detached host node 恢复
- Rollup 打包输出 `react`、`react-dom/client`、`react/jsx-runtime`、`react/jsx-dev-runtime` 等 playground 入口

## 实现进度清单

原则：先实现 client render 主流程依赖，再补实验特性和平台 fork；测试/fixture、SSR、RSC、DevTools 不纳入。

测试纪律：每完成一批源码实现，都要补充或更新对应 Vitest 用例，并执行 `pnpm --filter @front/react-source test`、`check`、`build`。

### 本轮已完成

- [x] `react-reconciler/src/ReactFiberStack.ts`：官方通用栈游标模型。
- [x] `react-reconciler/src/ReactFiberConfig.ts`：DOM renderer host config 入口。
- [x] `react-reconciler/src/ReactFiberHostContext.ts`：root/host context 入栈与出栈。
- [x] `react-reconciler/src/ReactFiberNewContext.ts`：Provider value 栈、Context dependency、变更传播。
- [x] `react/src/ReactHooks.ts`：补 `useContext` dispatcher 转发。
- [x] `shared/ReactInstanceMap.ts`：public class instance 到 Fiber 的映射。
- [x] `react-reconciler/src/ReactFiberClassUpdateQueue.ts`：class update pending 环形链表。
- [x] `react-reconciler/src/ReactFiberClassComponent.ts`：class instance 构造、更新与 shouldComponentUpdate。
- [x] `react-reconciler/src/ReactFiberThenable.ts`：ThenableState、三态 thenable unwrap、SuspenseException。
- [x] `react-reconciler/src/ReactFiberSuspenseComponent.ts`：SuspenseState、RetryQueue、findFirstSuspended。
- [x] `react-reconciler/src/ReactFiberThrow.ts`：Suspense wakeable 捕获、class/root error boundary 更新。
- [x] `react-reconciler/src/ReactFiberConcurrentUpdates.ts`：concurrent update 暂存队列与 lane 冒泡。
- [x] `react-reconciler/src/ReactFiberRootScheduler.ts`：root 链表调度、microtask 调度入口。
- [x] `react-reconciler/src/ReactFiberUnwindWork.ts`：unwind 弹栈与 ShouldCapture -> DidCapture。
- [x] `react-dom-bindings/src/events/EventRegistry.ts`：registrationName 到原生事件依赖映射。
- [x] `react-dom-bindings/src/events/DOMEventProperties.ts`：SimpleEventPlugin 事件名注册表。
- [x] `react-dom-bindings/src/events/plugins/SimpleEventPlugin.ts`：原生事件到 SyntheticEvent dispatchQueue。
- [x] `react-dom-bindings/src/events/getEventCharCode.ts`：keypress charCode 规范化。
- [x] `react-dom-bindings/src/events/plugins/ChangeEventPlugin.ts`：onChange 提取、文本输入/checkbox/select 主路径。
- [x] `react-dom-bindings/src/events/plugins/EnterLeaveEventPlugin.ts`：mouse/pointer enter leave 合成事件。
- [x] `react-dom-bindings/src/events/plugins/BeforeInputEventPlugin.ts`：composition/beforeinput 主路径。
- [x] `react-dom-bindings/src/events/plugins/SelectEventPlugin.ts`：selectionchange/onSelect 主路径。
- [x] `react-dom-bindings/src/events/ReactDOMControlledComponent.ts`：controlled state restore 队列入口。
- [x] `react-dom-bindings/src/events/FallbackCompositionState.ts`：IME fallback composition 文本差异提取。
- [x] `react-dom-bindings/src/events/isTextInputElement.ts`：文本输入元素判断。
- [x] `react-dom-bindings/src/events/isEventSupported.ts`：Modernizr 风格事件支持检测。
- [x] `react-dom-bindings/src/events/checkPassiveEvents.ts`：passive event listener 支持检测。
- [x] `react-dom-bindings/src/events/getVendorPrefixedEventName.ts`：animation/transition vendor event 映射。
- [x] `react-dom-bindings/src/events/CurrentReplayingEvent.ts`：当前 replay 事件标记。
- [x] `react-dom-bindings/src/events/plugins/ScrollEndEventPlugin.ts`：scrollend 原生事件与防抖 polyfill。
- [x] `react-dom-bindings/src/events/plugins/FormActionEventPlugin.ts`：form action submit 主路径。
- [x] `react-dom-bindings/src/events/ReactDOMEventReplaying.ts`：continuous event replay 队列。
- [x] `react-dom-bindings/src/client/ReactDOMComponentTree.ts`：DOM node 与 Fiber/props 映射。
- [x] `react-dom-bindings/src/shared/ReactDOMFormActions.ts`：FormStatus 类型。
- [x] `react-reconciler/src/ReactFiberSuspenseContext.ts`：Suspense handler/shell boundary 栈。
- [x] `react-reconciler/src/ReactFiberOffscreenComponent.ts`：Offscreen props/state/instance 类型。
- [x] `react-reconciler/src/ReactFiberHiddenContext.ts`：hidden tree context 与 entangled lanes。
- [x] `react-reconciler/src/ReactFiberCacheComponent.ts`：CacheContext、cache ref count、provider stack。
- [x] `react-reconciler/src/ReactCapturedValue.ts`：错误/thenable 捕获值与 object 弱缓存。
- [x] `react-reconciler/src/ReactPortal.ts`：ReactPortal 对象创建与 key 规范化。
- [x] `react-reconciler/src/ReactFiberComponentStack.ts`：沿 Fiber return 链生成组件栈。
- [x] `react-reconciler/src/clz32.ts`：`Math.clz32` 兼容实现。
- [x] `react-reconciler/src/ReactFiberMutationTracking.ts`：root/view-transition mutation 标记栈。
- [x] `react-reconciler/src/ReactProfilerTimer.ts`：commit/update/profiler 计时状态。
- [x] `react-reconciler/src/ReactFiberDevToolsHook.ts`：DevTools hook 注入与回调转发。
- [x] `react-reconciler/src/ReactFiberTreeContext.ts`：hydration/useId tree id fork 栈。
- [x] `react-reconciler/src/ReactFiberLegacyContext.ts`：legacy context mask/merge/provider 栈。
- [x] `react-reconciler/src/ReactFiberHydrationContext.ts`：hydration 状态机 API 与 recoverable error 队列。
- [x] `react-reconciler/src/ReactFiberShellHydration.ts`：root shell dehydrated 判断入口。
- [x] `react-reconciler/src/ReactFiberAsyncAction.ts`：async action 纠缠、thenable 链和默认 indicator 入口。
- [x] `react-reconciler/src/ReactFiberAsyncDispatcher.ts`：`cache()`/`cacheSignal()` 使用的默认 async dispatcher。
- [x] `react-reconciler/src/ReactFiberTransition.ts`：transition finish hook、cache pool 与 pending transition 栈。
- [x] `react-reconciler/src/ReactFiberTransitionTypes.ts`：view-transition type 队列和 async entangle type。
- [x] `react-reconciler/src/ReactFiberErrorLogger.ts`：uncaught/caught/recoverable error 默认处理与 root 回调转发。
- [x] `react-reconciler/src/ReactPostPaintCallback.ts`：paint 后回调合并调度。
- [x] `react-reconciler/src/ReactFiberCallUserSpace.ts`：函数组件、class lifecycle、effect destroy、lazy init 调用边界。
- [x] `react-reconciler/src/ReactFiberHydrationDiffs.ts`：hydration diff tree 描述输出。
- [x] `react-reconciler/src/ReactFiberConfigWithNoMutation.ts`：不支持 mutation renderer 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberConfigWithNoPersistence.ts`：不支持 persistence renderer 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberConfigWithNoHydration.ts`：不支持 hydration renderer 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberConfigWithNoResources.ts`：不支持 hoistable resources 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberConfigWithNoSingletons.ts`：不支持 singleton host instance 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberConfigWithNoMicrotasks.ts`：不支持 microtask host scheduler 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberConfigWithNoScopes.ts`：不支持 React Scopes 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberConfigWithNoTestSelectors.ts`：不支持 test selectors 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberScope.ts`：Scope instance 查询、contains、context value 收集。
- [x] `react-reconciler/src/ReactFiberActivityComponent.ts`：ActivityState 类型。
- [x] `react-reconciler/src/ReactFiberAct.ts`：legacy/concurrent act 环境判断。
- [x] `react-reconciler/src/ReactFiberPerformanceTrack.ts`：性能轨道事件记录入口。
- [x] `react-reconciler/src/ReactStrictModeWarnings.ts`：unsafe lifecycle / legacy context warning 队列。
- [x] `react-reconciler/src/ReactTestSelectors.ts`：component/role/text/testname selector 查询主路径。
- [x] `react-reconciler/src/ReactFiberHotReloading.ts`：React Refresh family resolve 与兼容性判断。
- [x] `react-reconciler/src/ReactFiberConfigWithNoViewTransition.ts`：不支持 view transition renderer 的官方 fallback。
- [x] `react-reconciler/src/ReactFiberViewTransitionComponent.ts`：ViewTransitionState、auto name、className 选择。
- [x] `react-reconciler/src/ReactFiberCommitViewTransitions.ts`：view transition commit/measure 状态记录。
- [x] `react-reconciler/src/ReactFiberDuplicateViewTransitions.ts`：同名 view transition Fiber 跟踪。
- [x] `react-reconciler/src/ReactFiberGestureScheduler.ts`：gesture 调度、启动、取消和 commit 状态。
- [x] `react-reconciler/src/ReactFiberApplyGesture.ts`：gesture 应用阶段记录入口。
- [x] `react-reconciler/src/ReactFiberTracingMarkerComponent.ts`：transition tracing marker 栈和 callback 派发。
- [x] `react-reconciler/src/forks/ReactFiberConfig.*.ts`：各 renderer fork 对齐当前 host config 出口。
- [x] `shared/ReactElementType.ts`：官方 ReactElement 调试字段类型。
- [x] `shared/ConsolePatchingDev.ts`：生成组件栈时静音 console 的嵌套 patch。
- [x] `shared/DefaultPrepareStackTrace.ts`、`DefaultPrepareStackTraceV8.ts`、`forks/DefaultPrepareStackTrace.*.ts`：默认/V8 stack formatter。
- [x] `shared/ReactOwnerStackFrames.ts`：JSX owner stack 哨兵帧裁剪。
- [x] `shared/ReactComponentStackFrame.ts`：sample/control stack 差分提取组件帧。
- [x] `shared/ReactComponentInfoStack.ts`：Server Component debugInfo owner stack 拼接。
- [x] `shared/ReactFlightPropertyAccess.ts`：Flight 省略 props 的错误提示常量。
- [x] `shared/ReactSerializationErrors.ts`：复杂对象/数组/JSX props 的错误消息片段生成。
- [x] `shared/ReactPerformanceTrackProperties.ts`：performance track 属性展开与对象 diff。
- [x] `shared/ReactIODescription.ts`：异步 I/O 描述提取。
- [x] `shared/binaryToComparableString.ts`：TypedArray 视图字节比较字符串。
- [x] `shared/normalizeConsoleFormat.ts`：console format specifier 数量规范化。
- [x] `shared/ReactDOMFragmentRefShared.ts`：空 Fragment 文档位置推断。
- [x] `shared/ReactOwnerStackReset.ts`：owner stack 创建计数节流重置。
- [x] `shared/forks/ReactFeatureFlags.*.ts`：各平台 feature flag fork 出口。
- [x] `react/src/ReactStartTransition.ts`：transition 对象注入、finish hook、thenable 追踪与错误上报。
- [x] `react/src/ReactTaint.ts`：taint value 生命周期计数、pending request cleanup、FinalizationRegistry 注册。
- [x] `react-dom/src/shared/ReactDOMFlushSync.ts`：临时清空 transition、切换离散事件优先级并触发同步 flush。
- [x] `use-sync-external-store/src/useSyncExternalStore.ts`：dispatcher 环境中的 effect 订阅与 snapshot 变化触发更新。
- [x] `react-cache/src/ReactCacheOld.ts`：按官方通过 `dispatcher.readContext` 限制 read/preload 调用阶段。
- [x] `react-dom-bindings/src/events/DOMPluginEventSystem.ts`：插件注册、根容器委托监听、selectionchange 文档监听与插件抽取桥接。
- [x] `react-dom-bindings/src/events/ReactDOMControlledComponent.ts`：事件批处理后的受控表单恢复队列。
- [x] `react-dom-bindings/src/client/ReactDOMComponent.ts`：`restoreControlledState` 分发 input/textarea/select 恢复逻辑。
- [x] `react/src/jsx-dev-runtime.ts` 与 Rollup bundle：补齐 Vite dev automatic JSX 入口。
- [x] `shared/ReactSharedInternals.ts`、`shared/ReactDOMSharedInternals.ts`：通过 `globalThis + Symbol.for` 共享 dispatcher/internal 单例，避免独立 bundle 之间 Hook dispatcher 断开。
- [x] `react-reconciler/src/ReactFiberCommitWork.ts`：删除提交后清理 `ChildDeletion/deletions`，并按真实 DOM parent 移除 host node，修复 playground “卸载 -> 重新挂载 -> 再卸载”后重复面板残留。
- [x] `__tests__/react-dom-events.test.ts`：新增 root 委托事件与功能面板条件卸载/重挂载回归用例。
- [x] `playground`：Vite playground 通过 alias 加载 `build/node_modules` 的 Rollup 产物验证核心能力。
- [x] `react-reconciler/src/ReactFiberBeginWork.ts`：对齐官方 `checkScheduledUpdateOrContext`、`attemptEarlyBailoutIfNoScheduledUpdate`、`bailoutOnAlreadyFinishedWork` 主路径。
- [x] `react-reconciler/src/ReactFiber.ts`：`createWorkInProgress` 复用 current child/sibling，并克隆 context dependencies，支撑 bailout 复用已完成子树。
- [x] `react-reconciler/src/ReactChildFiber.ts`：补 `cloneChildFibers`，支持父 fiber bailout 但子树仍有 lane/context 工作时继续下钻。
- [x] `react-reconciler/src/ReactFiberWorkLoop.ts`、`ReactFiberCompleteWork.ts`：补 update lane 冒泡、renderLanes 传递和 complete 阶段 `childLanes` 重算。
- [x] `react-reconciler/src/ReactFiberNewContext.ts`：补 `NeedsPropagation/DidPropagateContext` 控制，按官方 lazy propagation 避免重复扫描父链。
- [x] `__tests__/react-reconciler-bailout.test.ts`：覆盖 Provider value 变化穿透已 bailout 父组件并更新 `useContext` consumer。
- [x] `react-reconciler/src/ReactFiber.ts`、`ReactFiberBeginWork.ts`、`ReactChildFiber.ts`：接入 `ForwardRef`、`MemoComponent/SimpleMemoComponent`、`LazyComponent` 的 Fiber tag、beginWork 分支和 `elementType` 匹配。
- [x] `react-reconciler/src/ReactFiberHooks.ts`、`ReactFiberCommitEffects.ts`、`ReactFiberCommitWork.ts`：补 `useInsertionEffect/useLayoutEffect/useImperativeHandle/useTransition/useDeferredValue/useId` 的 dispatcher 与 commit 主路径。
- [x] `react/src/ReactHooks.ts`、`ReactClient.ts`、`shared/ReactTypes.ts`：补扩展 Hooks 公开 API 与 Dispatcher 类型。
- [x] `__tests__/react-reconciler-bailout.test.ts`：覆盖 `forwardRef/memo/lazy` 渲染、memo bailout、扩展 Hooks effect/ref/id/transition/deferred 主路径。
- [x] `react-reconciler/src/ReactWorkTags.ts`：修正 `Mode/Profiler/Scope/Activity` 编号，与官方 WorkTag 对齐。
- [x] `react-reconciler/src/ReactFiber.ts`、`ReactFiberBeginWork.ts`、`ReactFiberCompleteWork.ts`、`ReactFiberCommitWork.ts`：接入 `HostPortal`、`CacheComponent`、`Profiler`、`Mode` 的 Fiber 创建、begin/complete/commit 主路径。
- [x] `react-dom/src/shared/ReactDOM.ts`、`react-reconciler/src/ReactPortal.ts`：补 `createPortal` 在 `react-dom` 入口的导出和 portal 子树独立容器提交。
- [x] `react-reconciler/src/ReactFiberCacheComponent.ts`、`ReactFiberHooks.ts`：补默认 root cache 和 render 阶段 async cache dispatcher，支持 `cache(fn)` 读取 CacheContext。
- [x] `__tests__/react-reconciler-bailout.test.ts`：覆盖 `StrictMode/Profiler/Cache/Portal` wrapper、portal 容器提交和 CacheContext 复用。
- [x] `react-reconciler/src/ReactFiberHooks.ts`：补 Hooks update queue 的 `baseQueue/baseState`、pending/base 环形链表合并、按 `renderLanes` 跳过低优先级 update，以及 `NoLane` rebasing 克隆。
- [x] `react-reconciler/src/ReactFiberClassUpdateQueue.ts`：补 class update queue 按 lane 跳过、保留 `firstBaseUpdate/lastBaseUpdate/baseState`、后续已应用 update 用 `NoLane` 克隆重放且不重复 callback。
- [x] `react-reconciler/src/ReactFiberWorkLoop.ts`、`ReactFiberClassComponent.ts`、`ReactFiberBeginWork.ts`：打通 `requestUpdateLane()`、`startTransition` -> `TransitionLane`、`renderLanes` 传递到 hooks/class/context/cache 主路径。
- [x] `__tests__/react-reconciler-core.test.ts`：覆盖 hooks 与 class queue 的“Transition update 被 Sync render 跳过，下一轮 Transition render 从 baseQueue/baseState 重放”核心流程。
- [x] `react-reconciler/src/ReactInternalTypes.ts`、`ReactFiberHooks.ts`：补 hook update 的 `hasEagerState/eagerState`、`lastRenderedReducer/lastRenderedState`，支持 state 相等时 eager bailout：保留 pending update 但不调度 root。
- [x] `react-reconciler/src/ReactFiberHooks.ts`、`ReactInternalTypes.ts`：补 hook queue `lanes` 和 root `entangledLanes` 基础记录，`startTransition` 内 hook update 会进入 queue lane entanglement。
- [x] `__tests__/react-reconciler-core.test.ts`：覆盖 eager bailout 不调度 root、transition hook update 记录 `queue.lanes/root.entangledLanes`。
- [x] `react-reconciler/src/ReactFiberLane.ts`：补 `TransitionLanes/TransitionLane2/OffscreenLane`、`intersectLanes/isTransitionLane` 等 lane 集合工具。
- [x] `react-reconciler/src/ReactFiberWorkLoop.ts`：`requestUpdateLane()` 支持 pending async action 复用 entangled lane，并在隐藏树中叠加 `OffscreenLane`；commit 后清空 root `entangledLanes`。
- [x] `react-reconciler/src/ReactFiberClassUpdateQueue.ts`、`ReactFiberClassComponent.ts`：补 class/shared queue `shared.lanes`、transition entanglement、隐藏树 update 剥离 `OffscreenLane` 后按 renderLanes 处理、entangled async action thenable 挂起调用点。
- [x] `react-reconciler/src/ReactFiberHooks.ts`：hook queue 处理隐藏树 update 时剥离 `OffscreenLane`，transition entanglement 只记录真实 transition lane。
- [x] `__tests__/react-reconciler-core.test.ts`：覆盖 class/shared entanglement、hidden/offscreen lane、async action lane 复用、class queue thenable 挂起调用点。
- [x] `react-reconciler/src/ReactFiberRootScheduler.ts`、`ReactFiberLane.ts`：补多 transition lane 轮转分配，同一个 transition 对象复用同一 lane。
- [x] `react-reconciler/src/ReactFiberLane.ts`：`getNextLanes` 在选中 entangled lane 时会合并同组 pending entangled lanes 一起渲染。
- [x] `__tests__/react-reconciler-core.test.ts`：覆盖 transition lane 轮转/复用，以及 root entangled lanes 参与 `getNextLanes` 选择。
- [x] `react/src/jsx/ReactJSXElement.ts`、`ReactClient.ts`：补 `React.Suspense` 公开符号。
- [x] `react-reconciler/src/ReactFiber.ts`：补 `REACT_SUSPENSE_TYPE`、`REACT_OFFSCREEN_TYPE` 到 `SuspenseComponent/OffscreenComponent` Fiber tag 的创建映射。
- [x] `react-reconciler/src/ReactFiberBeginWork.ts`、`ReactFiberCompleteWork.ts`：接入 `SuspenseComponent` fallback/primary Offscreen 结构、`OffscreenComponent` hidden context 入栈/出栈。
- [x] `react-reconciler/src/ReactFiberCommitWork.ts`、`ReactFiberCompleteWork.ts`：hidden Offscreen 子树完成但跳过可见 host 挂载和 mutation traversal，避免 primary/fallback 同时插入可见 DOM。
- [x] `__tests__/react-reconciler-core.test.ts`：覆盖 Suspense `DidCapture` 下 hidden primary + visible fallback 结构，以及 Offscreen begin/complete hidden context。
- [x] `react-reconciler/src/ReactFiberWorkLoop.ts`、`ReactFiberThrow.ts`：wakeable 捕获后注册 ping listener，resolve 后把原 render lanes 标记为 `pingedLanes/pendingLanes` 并重新调度 root。
- [x] `react-reconciler/src/ReactFiberCommitWork.ts`、`ReactInternalTypes.ts`：Suspense commit retry listener 使用 boundary 级 `WeakSet` 去重，wakeable resolve 后以 `RetryLane` 调度边界。
- [x] `react-dom-bindings/src/client/ReactDOMComponent.ts`、`react-reconciler/src/ReactFiberCommitWork.ts`：补 `hideInstance/unhideInstance/hideTextInstance/unhideTextInstance`，Offscreen visible 恢复 detached host node，hidden 时隐藏 host instance/text。
- [x] `react-reconciler/src/ReactFiberBeginWork.ts`、`ReactFiberSuspenseComponent.ts`：补 dehydrated Suspense mount/update 主路径，hydration 初次 claim comment，后续 `OffscreenLane` re-enter hydration 并恢复 primary Offscreen。
- [x] `__tests__/react-reconciler-core.test.ts`：覆盖 wakeable ping、commit retry listener 去重、Offscreen 显隐恢复、dehydrated Suspense hydration/retry。
- [x] `react-reconciler/src/ReactFiberLane.ts`、`ReactFiberBeginWork.ts`：补选择性 hydration 的 lane bump，更新先于 hydration 时记录 `retryLane`、调度升级 lane 并抛出 `SelectiveHydrationException`。
- [x] `react-reconciler/src/ReactFiberSuspenseComponent.ts`：按 dehydrated comment data 区分 pending/queued/fallback，并读取服务端 fallback error dataset。
- [x] `react-reconciler/src/ReactFiberBeginWork.ts`、`ReactFiberHydrationContext.ts`：fallback dehydrated boundary 转 client render 时记录 recoverable hydration error，pending boundary 保留 dehydrated child 等待 retry。
- [x] `react-dom-bindings/src/client/ReactDOMComponent.ts`、`react-reconciler/src/ReactFiberCommitWork.ts`：补 dehydrated boundary DOM 范围 hide/unhide，并对 nested Offscreen/Portal 显隐边界按官方策略遍历。
- [x] `__tests__/react-reconciler-core.test.ts`：覆盖选择性 hydration lane bump、pending/fallback dehydrated 分支、recoverable error、nested Offscreen/Portal 显隐。

### 下一步顺序

当前 `packages/*` 下已经没有 `TODO: 按源码阅读顺序` 或 `占位模块` 文件。后续建议按“接近 1:1 细节”继续增强：

1. [ ] 继续把 `SuspenseComponent`、`OffscreenComponent` 分支与官方源码逐文件 diff，补 hydration mismatch diff 输出、hydration parent/next sibling 的更完整 DOM claim 规则、选择性 hydration 被 work loop 捕获后的恢复路径。
2. [ ] 继续对齐 update queue / lanes 细节：transition lane 过期时间/重试 lane、Suspense fallback 隐藏树的 retry 恢复策略和 hidden updates 队列。
3. [ ] 精修 DOM：style diff、controlled input/textarea/select 边界、selection restore、portal 事件边界、resource hoisting。
4. [ ] 扩展 `docs` 图解：Fiber render/commit、事件插件、context propagation、cache/act/scheduler、resource hint。
5. [ ] 增加 package 级入口测试，覆盖更多 Rollup 输出的 `build/node_modules/*`。
6. [ ] 对明确排除的 SSR/RSC/DevTools 文件在 README 中保持排除说明，避免和 client/runtime 目标混淆。

### 剩余占位统计

最近一次统计：剩余 0 个带 `TODO: 按源码阅读顺序` 或 `占位模块` 标记的文件；剩余 0 个纯 `export {};` 空导出文件。

### 1. shared 基础层

- [x] `shared/ReactSymbols.ts`：React 内置 `$$typeof` 符号。
- [x] `shared/ReactTypes.ts`：ReactElement、ReactNode、Dispatcher、Hook 类型。
- [x] `shared/ReactSharedInternals.ts`：Hook dispatcher 共享入口。
- [x] `shared/ReactDOMSharedInternals.ts`：ReactDOM 共享入口。
- [x] `shared/assign.ts`、`isArray.ts`、`objectIs.ts`、`shallowEqual.ts`、`hasOwnProperty.ts`、`noop.ts`。
- [x] `shared/getComponentNameFromType.ts`、`ExecutionEnvironment.ts`、`ReactFeatureFlags.ts`。
- [x] `shared/ReactInstanceMap.ts`：class public instance 与 Fiber 互查。
- [x] `shared/ReactElementType.ts`、`ReactComponentStackFrame.ts`、`ReactOwnerStackFrames.ts`、`ReactComponentInfoStack.ts`。
- [x] `shared/ConsolePatchingDev.ts`、`DefaultPrepareStackTrace*.ts`：开发态组件栈与 owner stack 辅助。
- [x] `shared/ReactSerializationErrors.ts`、`ReactPerformanceTrackProperties.ts`、`ReactIODescription.ts`。
- [x] `shared/ReactFlightPropertyAccess.ts`、`binaryToComparableString.ts`、`normalizeConsoleFormat.ts`。
- [x] `shared/ReactDOMFragmentRefShared.ts`、`ReactOwnerStackReset.ts`、`forks/ReactFeatureFlags.*.ts`。
- [x] `shared` 当前无占位文件。

### 2. react 包公开 API

- [x] `react/src/jsx/ReactJSXElement.ts`、`ReactJSX.ts`：元素创建与 JSX runtime。
- [x] `react/src/ReactHooks.ts`：Hook dispatcher 转发，含 `useContext`。
- [x] `react/src/ReactCreateRef.ts`、`ReactBaseClasses.ts`、`ReactNoopUpdateQueue.ts`。
- [x] `react/src/ReactContext.ts`、`ReactForwardRef.ts`、`ReactMemo.ts`、`ReactLazy.ts`。
- [x] `react/src/ReactChildren.ts`、`ReactStartTransition.ts`：transition 共享状态、finish hook 与 thenable 错误上报。
- [x] `react/src/ReactAct.ts`、`ReactCacheImpl.ts`、`ReactCacheClient.ts`、`ReactOwnerStack.ts`、`ReactTransitionType.ts`。
- [x] `react/src/ReactServer*.ts`、`ReactTaint*.ts`、`ReactCompilerRuntime.ts`、`BadMapPolyfill.ts`。
- [x] `react` 当前无占位文件。

### 3. scheduler 包

- [x] `scheduler/src/SchedulerMinHeap.ts`、`SchedulerPriorities.ts`。
- [x] `scheduler/src/forks/Scheduler.ts`：任务队列与优先级调度。
- [x] `SchedulerFeatureFlags.ts`、`SchedulerProfiling.ts`、`SchedulerMock.ts`、`SchedulerPostTask.ts`、native/www forks。
- [x] `scheduler` 当前无占位文件。

### 4. react-reconciler 主流程

- [x] `ReactFiber.ts`、`ReactFiberRoot.ts`、`ReactFiberLane.ts`、`ReactFiberFlags.ts`、`ReactWorkTags.ts`。
- [x] `ReactChildFiber.ts`、`ReactFiberBeginWork.ts`、`ReactFiberCompleteWork.ts`。
- [x] `ReactFiberWorkLoop.ts`、`ReactFiberCommitWork.ts`、`ReactFiberCommitEffects.ts`。
- [x] `ReactFiberHooks.ts`：state/reducer/ref/memo/callback/effect。
- [x] `ReactEventPriorities.ts`、`ReactRootTags.ts`、`ReactTypeOfMode.ts`、`Scheduler.ts`。
- [x] `ReactFiberStack.ts`：通用栈游标。
- [x] `ReactFiberConfig.ts`：renderer host config 汇总出口。
- [x] `ReactFiberHostContext.ts`：宿主上下文栈。
- [x] `ReactFiberNewContext.ts`：新版 Context 读写。
- [x] `ReactFiberClassUpdateQueue.ts`、`ReactFiberClassComponent.ts`：class component 更新。
- [x] `ReactFiberThenable.ts`、`ReactFiberSuspenseComponent.ts`：ThenableState、SuspenseState、findFirstSuspended。
- [x] `ReactFiberThrow.ts`、`ReactFiberUnwindWork.ts`：Suspense/error unwind。
- [x] `ReactFiberConcurrentUpdates.ts`、`ReactFiberRootScheduler.ts`：并发更新队列与 root 调度。
- [x] `ReactCapturedValue.ts`、`ReactPortal.ts`、`ReactFiberComponentStack.ts`、`clz32.ts`：错误捕获、Portal 与组件栈辅助。
- [x] `ReactFiberMutationTracking.ts`、`ReactProfilerTimer.ts`、`ReactFiberDevToolsHook.ts`：mutation/profiler/devtools 辅助主路径。
- [x] `ReactFiberTreeContext.ts`、`ReactFiberLegacyContext.ts`、`ReactFiberHydrationContext.ts`、`ReactFiberShellHydration.ts`：tree id、legacy context、hydration 状态 API。
- [x] `ReactFiberAsyncAction.ts`、`ReactFiberAsyncDispatcher.ts`、`ReactFiberTransition.ts`、`ReactFiberTransitionTypes.ts`：async action、cache dispatcher、transition 栈和 transition type 队列。
- [x] `ReactFiberErrorLogger.ts`、`ReactPostPaintCallback.ts`、`ReactFiberCallUserSpace.ts`、`ReactFiberHydrationDiffs.ts`：错误日志、post-paint、用户代码调用边界、hydration diff。
- [x] `ReactFiberConfigWithNo*.ts`：不支持 mutation/persistence/hydration/resources/singletons/microtasks/scopes/test-selectors 的 host config fallback。
- [x] `ReactFiberScope.ts`、`ReactFiberActivityComponent.ts`、`ReactFiberAct.ts`、`ReactFiberPerformanceTrack.ts`、`ReactStrictModeWarnings.ts`、`ReactTestSelectors.ts`、`ReactFiberHotReloading.ts`：scope/activity/act/performance/strict/test-selector/hot-reload 辅助。
- [x] `ReactFiberConfigWithNoViewTransition.ts`、`ReactFiberViewTransitionComponent.ts`、`ReactFiberCommitViewTransitions.ts`、`ReactFiberDuplicateViewTransitions.ts`、`ReactFiberGestureScheduler.ts`、`ReactFiberApplyGesture.ts`、`ReactFiberTracingMarkerComponent.ts`、`forks/ReactFiberConfig.*.ts`：view-transition、gesture、tracing marker 和 host config forks。
- [x] `react-reconciler` 当前无占位文件。

### 5. react-dom 与 react-dom-bindings

- [x] `react-dom/src/client/ReactDOMRoot.ts`、`ReactDOMClient.ts`。
- [x] `react-dom/src/shared/ReactDOM.ts`、`ReactDOMFlushSync.ts`、`ReactDOMTypes.ts`。
- [x] `react-dom-bindings/src/client/ReactDOMComponent.ts`、`ReactFiberConfigDOM.ts`。
- [x] `CSSPropertyOperations.ts`、`DOMPropertyOperations.ts`、`setTextContent.ts`。
- [x] `events/EventListener.ts`、`ReactDOMEventListener.ts`、`DOMPluginEventSystem.ts`、`SyntheticEvent.ts`。
- [x] DOM 属性安全与规范化：`isAttributeNameSafe.ts`、`sanitizeURL.ts`、`getAttributeAlias.ts`、`isUnitlessNumber.ts`。
- [x] 表单控件细节：`ReactDOMInput.ts`、`ReactDOMTextarea.ts`、`ReactDOMSelect.ts`、`inputValueTracking.ts`。
- [x] DOM client 辅助：container/event handle/update priority/selection/srcObject/DOM nesting/ARIA role/shorthand 等空导出文件已补实现。
- [x] 事件插件主路径：`EventRegistry.ts`、`DOMEventProperties.ts`、`SimpleEventPlugin.ts`、根容器委托监听。
- [x] 事件插件补充：`ChangeEventPlugin.ts`、`BeforeInputEventPlugin.ts`、`EnterLeaveEventPlugin.ts`、`SelectEventPlugin.ts`。
- [x] 事件 replay/passive/vendor/form action/controlled restore：`ReactDOMEventReplaying.ts`、`checkPassiveEvents.ts`、`getVendorPrefixedEventName.ts`、`FormActionEventPlugin.ts`、`ReactDOMControlledComponent.ts`。

### 6. 其他运行时包

- [x] `react-cache/src/LRU.ts`：官方环形双向链表 LRU。
- [x] `react-cache/src/ReactCacheOld.ts`：resource/read/preload/cache limit/render 阶段限制。
- [x] `react-is/src/ReactIs.ts`。
- [x] `react-refresh/src/ReactFreshRuntime.ts` 基础 runtime API。
- [x] `use-sync-external-store/src/useSyncExternalStore*.ts` 基础 API 与 dispatcher 订阅主路径。
- [x] `use-subscription/src/useSubscription.ts`。

## 构建

```bash
pnpm --filter @front/react-source check
pnpm --filter @front/react-source build
```

`build` 现在分两步：

1. `tsc -p tsconfig.json`：生成 `dist/packages/*` 下的 JS 与 `.d.ts`。
2. `node scripts/rollup/build.js`：参考官方 React Rollup 构建方式，把核心入口打包到 `build/node_modules/*`。

当前 Rollup 输出入口：

- `build/node_modules/react/index.js`
- `build/node_modules/react/jsx-runtime.js`
- `build/node_modules/react-dom/index.js`
- `build/node_modules/react-dom/client.js`
- `build/node_modules/scheduler/index.js`
- `build/node_modules/react-reconciler/index.js`
- `build/node_modules/react-is/index.js`
- `build/node_modules/react-cache/index.js`
- `build/node_modules/react-refresh/index.js`
- `build/node_modules/use-sync-external-store/index.js`
- `build/node_modules/use-sync-external-store/with-selector.js`
- `build/node_modules/use-subscription/index.js`

每个入口同时生成 `cjs/*.development.cjs`、sourcemap 和对应 `.d.ts`，构建摘要写入 `build/build-info.json`。

## 使用示例

```ts
import { createElement, createRoot, useState } from "@front/react-source";

function Counter() {
  const [count, setCount] = useState(0);

  return createElement(
    "button",
    { onClick: () => setCount((value) => value + 1) },
    `count: ${count}`,
  );
}

createRoot(document.getElementById("app")!).render(createElement(Counter, null));
```

更多源码流程说明见 `docs/react/source/react-ts-source.md`，复刻范围见 `REPLICA_SCOPE.md`。
