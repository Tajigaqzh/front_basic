/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import * as ReactFeatureFlags from "../ReactFeatureFlags.js";

// @beginner: 声明 readonlyReactFeatureFlags：保存当前步骤需要读取或更新的数据。
const readonlyReactFeatureFlags = Object.freeze({ ...ReactFeatureFlags });

export default readonlyReactFeatureFlags;
