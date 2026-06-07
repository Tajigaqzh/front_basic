# pinia-source

这个目录用于分阶段复刻 Pinia 核心源码。

当前已完成的第一阶段：

- `createPinia()`
- `disposePinia()`
- `activePinia` / `setActivePinia()` / `getActivePinia()`
- Pinia 根实例类型与插件注册基础结构
- `defineStore()`
- `$reset()`
- `storeToRefs()`
- `mapHelpers()`
- `$onAction()`
- 基础插件扩展

下一阶段计划：

- 更完整的类型系统
- `$subscribe()`
- HMR / devtools
- 更完整的 setup store / options store 行为细节

参考源码目录：

- `/Users/nwyzx/Desktop/project/source/pinia/packages/pinia/src`
