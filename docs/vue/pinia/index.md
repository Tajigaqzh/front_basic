# Pinia

这组文档对应你现在本地复刻的源码目录：

`pinia-source/packages/pinia/src`

如果你的目标是把这套源码真正看通，而不是只记 API，建议按下面顺序读。

## 阅读顺序

1. [Pinia 源码阅读地图](./pinia-source-reading-map.md)
2. [createPinia 与 rootStore：根实例、注入、activePinia](./pinia-create-and-rootstore-flow.md)
3. [store.ts：defineStore、state 同步、订阅、插件、hydrate 主线](./pinia-store-source-walkthrough.md)
4. [mapHelpers / storeToRefs / subscriptions / types](./pinia-helpers-and-types.md)
5. [$patch / $subscribe / $onAction 专题](./pinia-subscribe-and-action-flow.md)
6. [setup store hydration：skipHydrate / shouldHydrate / 初始 state 回填](./pinia-setup-hydration-flow.md)
7. [types.ts 类型系统：Store、StoreDefinition、提取类型](./pinia-types-deep-dive.md)

## 这组文档解决什么问题

- `pinia-source-reading-map.md`
  解决“这套复刻源码应该先看哪几个文件，主线怎么串”
- `pinia-create-and-rootstore-flow.md`
  解决“Pinia 根实例怎么创建、怎么安装到 app、activePinia 怎么流转”
- `pinia-store-source-walkthrough.md`
  解决“defineStore 到 store 实例创建，再到 $patch / $subscribe / $onAction / plugin / hydrate 的完整数据流”
- `pinia-helpers-and-types.md`
  解决“mapState、mapActions、mapWritableState、storeToRefs、类型提取辅助到底在做什么”
- `pinia-subscribe-and-action-flow.md`
  解决“为什么 direct mutation、patch mutation、action hook 的触发路径不一样”
- `pinia-setup-hydration-flow.md`
  解决“setup store 初始化时怎么把现有 pinia state 回填到 ref/reactive/computed”
- `pinia-types-deep-dive.md`
  解决“这套复刻源码为什么能把 options store / setup store 推导成统一 Store”

## 对应源码文件

- `createPinia.ts`
- `rootStore.ts`
- `store.ts`
- `mapHelpers.ts`
- `storeToRefs.ts`
- `subscriptions.ts`
- `types.ts`
- `index.ts`

## 导航

- 返回 [Vue 模块](../index.md)
