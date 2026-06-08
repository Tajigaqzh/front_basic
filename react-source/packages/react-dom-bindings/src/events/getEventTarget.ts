/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 事件系统，把浏览器原生事件转换并派发到 React listener。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
export default function getEventTarget(nativeEvent: Event): EventTarget | null {
  // Safari 可能把 target 暴露为文本节点；官方会规范化到父元素。
  // @beginner: 声明 target：保存当前步骤需要读取或更新的数据。
  const target = nativeEvent.target ?? nativeEvent.srcElement ?? window;
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return target instanceof Node && target.nodeType === 3 ? target.parentNode : target;
}
