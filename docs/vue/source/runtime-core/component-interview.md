# component.ts 常见面试题

## 1. `setup()` 返回对象和返回函数有什么区别？

- 返回对象：对象会挂到 `setupState`，供模板和代理层访问
- 返回函数：这个函数直接作为组件 render

## 2. 组件实例里最重要的字段有哪些？

- `vnode`
- `type`
- `props`
- `slots`
- `setupState`
- `proxy`
- `subTree`
- `effect`

## 3. 为什么组件初始化要分成这么多步骤？

因为 props、slots、setup、render、生命周期注册不是一个时机完成的，拆开后更容易支持不同组件形态。
