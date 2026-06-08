/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 把内部实现重新导出，形成这个包对外可访问的 API。
export {
  createInstance,
  createTextInstance,
  hideDehydratedBoundary,
  hideInstance,
  hideTextInstance,
  setInitialProperties,
  unhideDehydratedBoundary,
  unhideInstance,
  unhideTextInstance,
  updateProperties,
} from "./ReactDOMComponent.js";
