/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 isJavaScriptProtocol：保存当前步骤需要读取或更新的数据。
const isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;

export default function sanitizeURL<T>(url: T): T | string {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof url === "string" && isJavaScriptProtocol.test(url)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return "javascript:throw new Error('React has blocked a javascript: URL for security.')";
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return url;
}
