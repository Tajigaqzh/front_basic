# React 源码注释逐文件审查表

这份表用于记录 `react-source/packages` 下每个 TypeScript 源码文件的注释审查状态。

审查重点：文件是否有 `@beginner-module` 导读头、是否存在旧的机械误判句式、注释是否还绑定到错误语境。

## 汇总

- 已纳入审查文件：289 个。
- 带模块导读头文件：289 个。
- 当前高风险句式命中：0 处。
- 总 @beginner 注释数：6294 处。

## 人工复核记录

上一轮机械扫描只能发现固定句式问题，不能代表真正逐文件阅读。本轮已开始按文件人工复核，并对主链路文件做了单点修正。

已人工复核并修正的主链路文件：

- `react/src/jsx/ReactJSXElement.ts`：把 JSX 保留字段、内置元素类型、`key`、`props.children` 的注释改成 React 语义说明。
- `react/src/ReactHooks.ts`：把 dispatcher 相关注释改成 mount/update Hook 分发语义。
- `react-reconciler/src/ReactFiber.ts`：复核 Fiber 字段、双缓存、Element 到 Fiber 的转换注释。
- `react-reconciler/src/ReactFiberWorkLoop.ts`：复核 lane 分配、向上冒泡、DFS work loop、commitRoot 注释。
- `react-reconciler/src/ReactFiberBeginWork.ts`：复核 beginWork 分发、函数组件、memo、lazy、class、context、Suspense 入口注释。
- `react-reconciler/src/ReactFiberCompleteWork.ts`：复核 DOM 创建、appendAllChildren、bubbleProperties 注释。
- `react-reconciler/src/ReactFiberCommitWork.ts`：复核 Placement/Update/Deletion、Offscreen 可见性、Portal 删除、Suspense retry 注释。
- `react-reconciler/src/ReactFiberHooks.ts`：复核 Hook 链表、更新队列、effect 环、deps 比较、dispatch 调度注释。
- `react-reconciler/src/ReactChildFiber.ts`：复核 children diff、key/type 复用、Placement/Deletion 注释。

## 包级统计

| 包 | 文件数 | @beginner 注释数 | 高风险命中 |
| --- | ---: | ---: | ---: |
| react-cache | 3 | 96 | 0 |
| react-dom-bindings | 76 | 1091 | 0 |
| react-dom | 10 | 115 | 0 |
| react-is | 2 | 13 | 0 |
| react-reconciler | 88 | 3185 | 0 |
| react-refresh | 3 | 23 | 0 |
| react | 33 | 447 | 0 |
| scheduler | 12 | 277 | 0 |
| shared | 49 | 990 | 0 |
| use-subscription | 2 | 7 | 0 |
| use-sync-external-store | 11 | 50 | 0 |

## 逐文件结果

### react-cache

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `react-cache/src/LRU.ts` | 179 | 38 | 有 | 已检查，未发现高风险句式 |
| `react-cache/src/ReactCacheOld.ts` | 207 | 56 | 有 | 已检查，未发现高风险句式 |
| `react-cache/src/index.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |

### react-dom-bindings

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `react-dom-bindings/src/client/CSSPropertyOperations.ts` | 37 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/CSSShorthandProperty.ts` | 21 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/DOMAccessibilityRoles.ts` | 64 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/DOMNamespaces.ts` | 10 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/DOMPropertyOperations.ts` | 22 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/HTMLNodeType.ts` | 16 | 6 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMComponent.ts` | 223 | 62 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMComponentTree.ts` | 115 | 33 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMContainer.ts` | 26 | 7 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMEventHandle.ts` | 21 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMEventHandleTypes.ts` | 15 | 4 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMInput.ts` | 120 | 25 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMOption.ts` | 17 | 4 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMSelect.ts` | 83 | 21 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMSelection.ts` | 28 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMSrcObject.ts` | 18 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMTextarea.ts` | 59 | 14 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactDOMUpdatePriority.ts` | 37 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactFiberConfigDOM.ts` | 19 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ReactInputSelection.ts` | 41 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/ToStringValue.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/escapeSelectorAttributeValueInsideDoubleQuotes.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/estimateBandwidth.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/getActiveElement.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/getNodeForCharacterOffset.ts` | 35 | 10 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/inputValueTracking.ts` | 88 | 25 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/setTextContent.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/client/validateDOMNesting.ts` | 48 | 14 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/CurrentReplayingEvent.ts` | 27 | 7 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/DOMEventNames.ts` | 23 | 9 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/DOMEventProperties.ts` | 125 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/DOMPluginEventSystem.ts` | 482 | 105 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/EventListener.ts` | 66 | 12 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/EventRegistry.ts` | 44 | 9 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/EventSystemFlags.ts` | 17 | 6 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/FallbackCompositionState.ts` | 76 | 23 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/PluginModuleType.ts` | 20 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/ReactDOMControlledComponent.ts` | 92 | 28 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/ReactDOMEventListener.ts` | 37 | 8 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/ReactDOMEventReplaying.ts` | 278 | 57 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/ReactDOMUpdateBatching.ts` | 33 | 10 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/ReactSyntheticEventType.ts` | 19 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/SyntheticEvent.ts` | 34 | 6 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/TopLevelEventTypes.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/checkPassiveEvents.ts` | 32 | 8 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/forks/EventListener-www.ts` | 14 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/getEventCharCode.ts` | 29 | 7 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/getEventTarget.ts` | 13 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/getListener.ts` | 15 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/getVendorPrefixedEventName.ts` | 78 | 19 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/isEventSupported.ts` | 32 | 9 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/isTextInputElement.ts` | 45 | 9 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/plugins/BeforeInputEventPlugin.ts` | 269 | 79 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/plugins/ChangeEventPlugin.ts` | 123 | 34 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/plugins/EnterLeaveEventPlugin.ts` | 96 | 27 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/plugins/FormActionEventPlugin.ts` | 176 | 50 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/plugins/ScrollEndEventPlugin.ts` | 193 | 50 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/plugins/SelectEventPlugin.ts` | 154 | 42 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/events/plugins/SimpleEventPlugin.ts` | 85 | 25 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/ReactControlledValuePropTypes.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/ReactDOMFormActions.ts` | 21 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/ReactDOMInvalidARIAHook.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/ReactDOMNullInputValuePropHook.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/ReactDOMResourceValidation.ts` | 98 | 27 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/ReactDOMUnknownPropertyHook.ts` | 14 | 4 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/ReactFlightClientConfigDOM.ts` | 128 | 37 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/crossOriginStrings.ts` | 37 | 12 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/getAttributeAlias.ts` | 19 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/hyphenateStyleName.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/isAttributeNameSafe.ts` | 37 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/isCustomElement.ts` | 23 | 6 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/isUnitlessNumber.ts` | 49 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/possibleStandardNames.ts` | 20 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/sanitizeURL.ts` | 19 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/validAriaProperties.ts` | 64 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom-bindings/src/shared/warnValidStyle.ts` | 9 | 1 | 有 | 已检查，未发现高风险句式 |

### react-dom

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `react-dom/src/client/ReactDOMClient.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/client/ReactDOMClientFB.ts` | 17 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/client/ReactDOMDefaultTransitionIndicator.ts` | 121 | 27 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/client/ReactDOMRoot.ts` | 84 | 16 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/client/ReactDOMRootFB.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/shared/ReactDOM.ts` | 19 | 4 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/shared/ReactDOMFloat.ts` | 209 | 41 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/shared/ReactDOMFlushSync.ts` | 47 | 14 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/shared/ReactDOMTypes.ts` | 12 | 4 | 有 | 已检查，未发现高风险句式 |
| `react-dom/src/shared/ensureCorrectIsomorphicReactVersion.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |

### react-is

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `react-is/src/ReactIs.ts` | 43 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-is/src/index.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |

### react-reconciler

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `react-reconciler/src/ReactCapturedValue.ts` | 66 | 17 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactChildFiber.ts` | 266 | 70 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactCurrentFiber.ts` | 29 | 7 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactEventPriorities.ts` | 46 | 15 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiber.ts` | 278 | 40 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberAct.ts` | 40 | 14 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberActivityComponent.ts` | 21 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberApplyGesture.ts` | 35 | 8 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberAsyncAction.ts` | 246 | 64 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberAsyncDispatcher.ts` | 49 | 16 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberBeginWork.ts` | 1033 | 262 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberCacheComponent.ts` | 103 | 18 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberCallUserSpace.ts` | 137 | 33 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberClassComponent.ts` | 260 | 62 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberClassUpdateQueue.ts` | 401 | 99 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberCommitEffects.ts` | 83 | 24 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberCommitHostEffects.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberCommitViewTransitions.ts` | 135 | 32 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberCommitWork.ts` | 490 | 128 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberCompleteWork.ts` | 235 | 58 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberComponentStack.ts` | 48 | 17 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConcurrentUpdates.ts` | 191 | 48 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfig.ts` | 116 | 27 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoHydration.ts` | 103 | 47 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoMicrotasks.ts` | 18 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoMutation.ts` | 55 | 23 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoPersistence.ts` | 30 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoResources.ts` | 47 | 19 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoScopes.ts` | 18 | 5 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoSingletons.ts` | 26 | 9 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoTestSelectors.ts` | 30 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberConfigWithNoViewTransition.ts` | 57 | 23 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberDevToolsHook.ts` | 129 | 32 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberDuplicateViewTransitions.ts` | 69 | 23 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberErrorLogger.ts` | 126 | 33 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberFlags.ts` | 40 | 17 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberGestureScheduler.ts` | 121 | 27 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberHiddenContext.ts` | 68 | 19 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberHooks.ts` | 853 | 200 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberHostContext.ts` | 137 | 39 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberHotReloading.ts` | 206 | 64 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberHydrationContext.ts` | 299 | 78 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberHydrationDiffs.ts` | 255 | 80 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberLane.ts` | 150 | 55 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberLegacyContext.ts` | 334 | 95 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberMutationTracking.ts` | 40 | 10 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberNewContext.ts` | 357 | 95 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberOffscreenComponent.ts` | 75 | 18 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberPerformanceTrack.ts` | 164 | 46 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberReconciler.ts` | 13 | 4 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberRoot.ts` | 34 | 8 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberRootScheduler.ts` | 190 | 60 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberScope.ts` | 150 | 47 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberShellHydration.ts` | 23 | 6 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberStack.ts` | 56 | 14 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberSuspenseComponent.ts` | 152 | 41 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberSuspenseContext.ts` | 174 | 48 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberThenable.ts` | 225 | 62 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberThrow.ts` | 288 | 76 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberTracingMarkerComponent.ts` | 196 | 32 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberTransition.ts` | 261 | 73 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberTransitionTypes.ts` | 80 | 25 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberTreeContext.ts` | 216 | 59 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberTreeReflection.ts` | 66 | 21 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberUnwindWork.ts` | 113 | 36 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberViewTransitionComponent.ts` | 118 | 33 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactFiberWorkLoop.ts` | 323 | 79 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactHookEffectTags.ts` | 19 | 7 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactInternalTypes.ts` | 127 | 17 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactPortal.ts` | 34 | 7 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactPostPaintCallback.ts` | 36 | 9 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactProfilerTimer.ts` | 157 | 52 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactReconcilerConstants.ts` | 10 | 3 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactRootTags.ts` | 13 | 4 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactStrictModeWarnings.ts` | 99 | 19 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactTestSelectors.ts` | 343 | 119 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactTypeOfMode.ts` | 21 | 8 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/ReactWorkTags.ts` | 90 | 28 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/Scheduler.ts` | 16 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/clz32.ts` | 26 | 9 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/forks/ReactFiberConfig.art.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/forks/ReactFiberConfig.custom.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/forks/ReactFiberConfig.dom.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/forks/ReactFiberConfig.fabric.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/forks/ReactFiberConfig.markup.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/forks/ReactFiberConfig.noop.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/forks/ReactFiberConfig.test.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react-reconciler/src/getComponentNameFromFiber.ts` | 34 | 13 | 有 | 已检查，未发现高风险句式 |

### react-refresh

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `react-refresh/src/ReactFreshBabelPlugin.ts` | 78 | 11 | 有 | 已检查，未发现高风险句式 |
| `react-refresh/src/ReactFreshRuntime.ts` | 37 | 10 | 有 | 已检查，未发现高风险句式 |
| `react-refresh/src/index.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |

### react

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `react/src/BadMapPolyfill.ts` | 19 | 5 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactAct.ts` | 289 | 76 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactBaseClasses.ts` | 39 | 4 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactCacheClient.ts` | 30 | 10 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactCacheImpl.ts` | 152 | 46 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactCacheServer.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactChildren.ts` | 105 | 29 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactClient.ts` | 66 | 15 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactCompilerRuntime.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactContext.ts` | 34 | 6 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactCreateRef.ts` | 17 | 4 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactForwardRef.ts` | 26 | 5 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactHooks.ts` | 193 | 54 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactLazy.ts` | 72 | 15 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactMemo.ts` | 29 | 5 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactNoopUpdateQueue.ts` | 32 | 4 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactOwnerStack.ts` | 16 | 5 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactServer.experimental.development.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactServer.experimental.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactServer.fb.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactServer.ts` | 28 | 12 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactSharedInternalsClient.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactSharedInternalsServer.ts` | 44 | 5 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactStartTransition.ts` | 117 | 28 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactTaint.ts` | 139 | 40 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactTaintRegistry.ts` | 26 | 8 | 有 | 已检查，未发现高风险句式 |
| `react/src/ReactTransitionType.ts` | 50 | 16 | 有 | 已检查，未发现高风险句式 |
| `react/src/index.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react/src/jsx-dev-runtime.ts` | 27 | 6 | 有 | 已检查，未发现高风险句式 |
| `react/src/jsx-runtime.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `react/src/jsx/ReactJSX.ts` | 26 | 7 | 有 | 已检查，未发现高风险句式 |
| `react/src/jsx/ReactJSXElement.ts` | 116 | 23 | 有 | 已检查，未发现高风险句式 |
| `react/src/jsx/ReactJSXServer.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |

### scheduler

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `scheduler/src/SchedulerFeatureFlags.ts` | 20 | 8 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/SchedulerMinHeap.ts` | 113 | 33 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/SchedulerPriorities.ts` | 51 | 19 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/SchedulerProfiling.ts` | 167 | 48 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/forks/Scheduler.ts` | 219 | 57 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/forks/SchedulerFeatureFlags.native-fb.ts` | 20 | 8 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/forks/SchedulerFeatureFlags.www-dynamic.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/forks/SchedulerFeatureFlags.www.ts` | 21 | 8 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/forks/SchedulerMock.ts` | 288 | 80 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/forks/SchedulerNative.ts` | 39 | 9 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/forks/SchedulerPostTask.ts` | 27 | 2 | 有 | 已检查，未发现高风险句式 |
| `scheduler/src/index.ts` | 24 | 3 | 有 | 已检查，未发现高风险句式 |

### shared

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `shared/CheckStringCoercion.ts` | 27 | 5 | 有 | 已检查，未发现高风险句式 |
| `shared/ConsolePatchingDev.ts` | 99 | 18 | 有 | 已检查，未发现高风险句式 |
| `shared/DefaultPrepareStackTrace.ts` | 20 | 3 | 有 | 已检查，未发现高风险句式 |
| `shared/DefaultPrepareStackTraceV8.ts` | 39 | 8 | 有 | 已检查，未发现高风险句式 |
| `shared/ExecutionEnvironment.ts` | 11 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactComponentInfoStack.ts` | 67 | 21 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactComponentStackFrame.ts` | 389 | 107 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactDOMFragmentRefShared.ts` | 58 | 15 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactDOMSharedInternals.ts` | 55 | 8 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactElementType.ts` | 40 | 4 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactFeatureFlags.ts` | 48 | 22 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactFlightPropertyAccess.ts` | 11 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactIODescription.ts` | 151 | 51 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactInstanceMap.ts` | 21 | 5 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactOwnerStackFrames.ts` | 62 | 14 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactOwnerStackReset.ts` | 35 | 8 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactPerformanceTrackProperties.ts` | 497 | 135 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactSerializationErrors.ts` | 454 | 152 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactSharedInternals.ts` | 73 | 9 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactSymbols.ts` | 69 | 30 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactTypes.ts` | 284 | 35 | 有 | 已检查，未发现高风险句式 |
| `shared/ReactVersion.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/assign.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/binaryToComparableString.ts` | 20 | 3 | 有 | 已检查，未发现高风险句式 |
| `shared/enqueueTask.ts` | 9 | 1 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/DefaultPrepareStackTrace.dom-edge.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/DefaultPrepareStackTrace.dom-node.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/DefaultPrepareStackTrace.markup.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.eslint-plugin.www.ts` | 16 | 4 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.native-fb-dynamic.ts` | 29 | 12 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.native-fb.ts` | 69 | 30 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.native-oss.ts` | 61 | 26 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.readonly.ts` | 13 | 3 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.test-renderer.native-fb.ts` | 59 | 25 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.test-renderer.ts` | 65 | 28 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.test-renderer.www.ts` | 61 | 26 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.www-dynamic.ts` | 55 | 25 | 有 | 已检查，未发现高风险句式 |
| `shared/forks/ReactFeatureFlags.www.ts` | 61 | 26 | 有 | 已检查，未发现高风险句式 |
| `shared/formatProdErrorMessage.ts` | 16 | 4 | 有 | 已检查，未发现高风险句式 |
| `shared/getComponentNameFromType.ts` | 109 | 36 | 有 | 已检查，未发现高风险句式 |
| `shared/getPrototypeOf.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/hasOwnProperty.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/index.ts` | 68 | 31 | 有 | 已检查，未发现高风险句式 |
| `shared/isArray.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/noop.ts` | 7 | 1 | 有 | 已检查，未发现高风险句式 |
| `shared/normalizeConsoleFormat.ts` | 74 | 19 | 有 | 已检查，未发现高风险句式 |
| `shared/objectIs.ts` | 10 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/reportGlobalError.ts` | 12 | 2 | 有 | 已检查，未发现高风险句式 |
| `shared/shallowEqual.ts` | 50 | 16 | 有 | 已检查，未发现高风险句式 |

### use-subscription

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `use-subscription/src/index.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `use-subscription/src/useSubscription.ts` | 24 | 5 | 有 | 已检查，未发现高风险句式 |

### use-sync-external-store

| 文件 | 行数 | 注释数 | 导读头 | 审查结论 |
| --- | ---: | ---: | --- | --- |
| `use-sync-external-store/src/forks/isServerEnvironment.native.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/forks/useSyncExternalStore.forward-to-built-in.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/forks/useSyncExternalStore.forward-to-shim.ts` | 11 | 3 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/index.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/isServerEnvironment.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/useSyncExternalStore.ts` | 82 | 23 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/useSyncExternalStoreShim.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/useSyncExternalStoreShimClient.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/useSyncExternalStoreShimServer.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/useSyncExternalStoreWithSelector.ts` | 27 | 7 | 有 | 已检查，未发现高风险句式 |
| `use-sync-external-store/src/with-selector.ts` | 8 | 2 | 有 | 已检查，未发现高风险句式 |
