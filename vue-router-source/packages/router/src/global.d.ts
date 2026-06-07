// Global compile-time constants
// 这些常量不是运行时变量，而是打包阶段注入的编译期开关。
declare var __DEV__: boolean
declare var __TEST__: boolean
// TODO: refactor all these feature flags
declare var __FEATURE_PROD_DEVTOOLS__: boolean
// iifee build cannot have v8 devtools because they are too heavy
declare var __STRIP_DEVTOOLS__: boolean
declare var __BROWSER__: boolean
// 这些开关配合 bundler 的 dead code elimination，可以把开发分支和特性分支裁掉。
