// 判断当前运行环境是否有 window。
// Pinia 在 SSR 和浏览器端的错误提示、devtools 接入等逻辑会走不同分支。
export const IS_CLIENT = typeof window !== 'undefined'
