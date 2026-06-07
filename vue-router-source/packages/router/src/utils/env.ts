export const isBrowser = typeof document !== 'undefined'
// 这是最基础的环境分支信号。
// history、scroll、devtools 等浏览器专属逻辑都会先看它。
// SSR、测试、node 构建场景下它通常为 false。
