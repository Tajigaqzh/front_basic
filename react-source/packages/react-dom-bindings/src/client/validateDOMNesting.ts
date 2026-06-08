/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 specialTags：保存当前步骤需要读取或更新的数据。
const specialTags = new Set(["address", "article", "aside", "blockquote", "center", "details", "dialog", "dir", "div", "dl", "fieldset", "figcaption", "figure", "footer", "header", "hgroup", "main", "menu", "nav", "ol", "p", "section", "summary", "ul"]);

// @beginner: 定义 AncestorInfoDev：描述对象需要具备哪些字段，方便读者理解数据形状。
export interface AncestorInfoDev {
  current: string | null;
  pTagInButtonScope: string | null;
}

// @beginner: 进入 updatedAncestorInfoDev：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function updatedAncestorInfoDev(oldInfo: AncestorInfoDev | null, tag: string): AncestorInfoDev {
  // @beginner: 声明 info：保存当前步骤需要读取或更新的数据。
  const info: AncestorInfoDev = {
    current: tag,
    pTagInButtonScope: oldInfo?.pTagInButtonScope ?? null,
  };
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (tag === "p") {
    info.pTagInButtonScope = tag;
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (specialTags.has(tag)) {
    info.pTagInButtonScope = null;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return info;
}

// @beginner: 进入 validateDOMNesting：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function validateDOMNesting(childTag: string, ancestorInfo: AncestorInfoDev | null): boolean {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (childTag === "tr" && ancestorInfo?.current === "table") {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (ancestorInfo?.pTagInButtonScope && specialTags.has(childTag)) {
    // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
    return false;
  }
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return true;
}
