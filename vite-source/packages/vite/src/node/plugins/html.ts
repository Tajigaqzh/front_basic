import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from '../plugin.js'

export function htmlPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:html',
    async transformIndexHtml(html, ctx) {
      /**
       * transformIndexHtml 在 dev/build 都可能执行。
       * 只有 dev server 场景 ctx.server 存在，才需要注入 HMR client。
       */
      const tags: HtmlTagDescriptor[] = ctx.server
        ? [
            {
              // <script type="module"> 会让浏览器用原生 ESM 加载 Vite client。
              tag: 'script',
              // config.base 可能是 /sub-app/，所以内部路径也要跟随 base。
              attrs: { type: 'module', src: `${config.base}@vite/client` },
              // 放在 head 可以尽早建立 WebSocket，页面脚本加载后即可热更新。
              injectTo: 'head',
            },
          ]
        : []

      // 先把插件生成的 HTML 标签注入到原 HTML 字符串。
      let transformed = injectTags(html, tags)

      /**
       * 官方 Vite 会在 HTML 中解析 <script type="module">、
       * <link>、资源 URL，并把它们放进模块图。这里保留最直观的一步：
       * 让 HTML 自动注入 dev client，使浏览器能接收 HMR/full-reload 消息。
       */
      transformed = transformed.replace(
        '</body>',
        `<!-- transformed by ${ctx.server ? 'dev server' : 'build'} -->\n</body>`,
      )
      return transformed
    },
  }
}

function injectTags(html: string, tags: HtmlTagDescriptor[]): string {
  // 多个 tag 依次注入，后一个 tag 基于前一个 tag 的结果继续处理。
  let result = html
  for (const tag of tags) {
    // attrs: { type: 'module', defer: true } -> type="module" defer
    const attrs = Object.entries(tag.attrs ?? {})
      .map(([key, value]) => (value === true ? key : `${key}="${value}"`))
      .join(' ')
    // 没有属性时生成 <script>，有属性时生成 <script type="module">。
    const open = attrs ? `<${tag.tag} ${attrs}>` : `<${tag.tag}>`
    // void tag 不能有 closing tag；script/style 这类普通 tag 需要闭合。
    const code = isVoidTag(tag.tag)
      ? open
      : `${open}${tag.children ?? ''}</${tag.tag}>`
    // injectTo 默认为 head；显式 body 时插到 </body> 前。
    const target = tag.injectTo === 'body' ? '</body>' : '</head>'
    // 找到目标闭合标签就插入；找不到时退化为插到文档最前面。
    result = result.includes(target) ? result.replace(target, `${code}\n${target}`) : `${code}\n${result}`
  }
  return result
}

function isVoidTag(tag: string): boolean {
  // HTML void elements 只能有开始标签，不能写 </meta> 这类结束标签。
  return ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'].includes(tag)
}
