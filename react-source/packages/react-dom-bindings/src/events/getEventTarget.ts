export default function getEventTarget(nativeEvent: Event): EventTarget | null {
  // Safari 可能把 target 暴露为文本节点；官方会规范化到父元素。
  const target = nativeEvent.target ?? nativeEvent.srcElement ?? window;
  return target instanceof Node && target.nodeType === 3 ? target.parentNode : target;
}
