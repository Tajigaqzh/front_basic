# patchProp.ts 核心步骤

## 这份文件在做什么

`patchProp.ts` 是 DOM 属性更新总入口，负责判断一个 key 应该走哪一条写入路径。

## 分发顺序

1. `class`
2. `style`
3. 事件
4. DOM property
5. attribute
6. 自定义元素特例

## 最重要的点

同一个模板里的“属性”，在浏览器里并不总是同一种东西。Vue 需要决定：

- 是写到 `el.className`
- 还是写到 `setAttribute`
- 还是走事件系统
