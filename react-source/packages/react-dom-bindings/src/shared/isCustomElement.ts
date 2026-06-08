/**
 * @beginner-module: 源码导读
 * 本文件属于 shared 公共工具/类型层，被 react、react-dom、reconciler 共同复用。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
export default function isCustomElement(tagName: string, props: Record<string, unknown> | null): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (tagName.indexOf("-") === -1) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }

  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (props !== null && props.is != null) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return true;
  }

  // 官方会排除 SVG/MathML 中少量带横线的保留标签。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}
