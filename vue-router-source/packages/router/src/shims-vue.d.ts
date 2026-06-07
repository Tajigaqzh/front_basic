declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // 让 TS 把任意 .vue 文件视为标准组件模块，便于源码包在不同构建环境下直接消费。
  const component: DefineComponent<{}, {}, any>
  export default component
}
