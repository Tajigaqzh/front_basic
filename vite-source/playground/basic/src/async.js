export function createMessage(count) {
  return `动态模块已加载，当前 count = ${count}，时间 = ${new Date().toLocaleTimeString()}`
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
