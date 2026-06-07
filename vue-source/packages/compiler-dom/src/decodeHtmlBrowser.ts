/* eslint-disable no-restricted-globals */

// 复用一个隐藏的 div，避免每次解码都重复创建 DOM 节点。
let decoder: HTMLDivElement

// 在浏览器环境下解码 HTML 实体。
export function decodeHtmlBrowser(raw: string, asAttr = false): string {
  // 首次调用时延迟创建解码容器。
  if (!decoder) {
    decoder = document.createElement('div')
  }
  if (asAttr) {
    // 按属性值语义解码时，先把原始内容塞进一个虚拟属性里再取回。
    // 这里先转义双引号，避免拼接出的 HTML 属性结构被破坏。
    decoder.innerHTML = `<div foo="${raw.replace(/"/g, '&quot;')}">`
    // 读取解析后的属性值，得到浏览器标准解码结果。
    return decoder.children[0].getAttribute('foo')!
  } else {
    // 按普通文本节点语义解码时，直接写入 innerHTML 再读 textContent。
    decoder.innerHTML = raw
    return decoder.textContent!
  }
}
