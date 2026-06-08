/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 VALID_ATTRIBUTE_NAME_REGEX：保存当前步骤需要读取或更新的数据。
const VALID_ATTRIBUTE_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
// @beginner: 声明 illegalAttributeNameCache：保存当前步骤需要读取或更新的数据。
const illegalAttributeNameCache = new Set<string>();
// @beginner: 声明 validatedAttributeNameCache：保存当前步骤需要读取或更新的数据。
const validatedAttributeNameCache = new Set<string>();

export default function isAttributeNameSafe(attributeName: string): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (validatedAttributeNameCache.has(attributeName)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (illegalAttributeNameCache.has(attributeName)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName)) {
    validatedAttributeNameCache.add(attributeName);
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }

  illegalAttributeNameCache.add(attributeName);
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return false;
}
