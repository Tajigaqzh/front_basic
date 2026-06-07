# patchProp.ts 常见面试题

## 1. 为什么 Vue 需要区分 prop 和 attribute？

因为两者在浏览器里行为不同。某些 key 写 property 才生效，某些 key 写 attribute 才安全或符合语义。

## 2. 为什么事件更新要单独走一套逻辑？

因为事件绑定不仅是“赋值”，还涉及缓存 invoker、替换回调、解绑旧事件等细节。
