// 构建工具注入的开发环境常量。
// 阅读版用它控制 dev 分支提示，避免在运行时代码里直接读取 process.env。
declare const __DEV__: boolean
// 预留 devtools 开关，保持和官方 Pinia 全局常量形状接近。
declare const __USE_DEVTOOLS__: boolean
