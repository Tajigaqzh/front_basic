/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 possibleStandardNames：保存当前步骤需要读取或更新的数据。
const possibleStandardNames: Record<string, string> = {
  acceptcharset: "acceptCharset",
  classname: "className",
  htmlfor: "htmlFor",
  httpequiv: "httpEquiv",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  crossorigin: "crossOrigin",
};

export default possibleStandardNames;
