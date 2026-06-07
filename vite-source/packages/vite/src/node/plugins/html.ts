import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from '../plugin.js'

export function htmlPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:html',
    async transformIndexHtml(html, ctx) {
      const tags: HtmlTagDescriptor[] = ctx.server
        ? [
            {
              tag: 'script',
              attrs: { type: 'module', src: `${config.base}@vite/client` },
              injectTo: 'head',
            },
          ]
        : []

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
  let result = html
  for (const tag of tags) {
    const attrs = Object.entries(tag.attrs ?? {})
      .map(([key, value]) => (value === true ? key : `${key}="${value}"`))
      .join(' ')
    const open = attrs ? `<${tag.tag} ${attrs}>` : `<${tag.tag}>`
    const code = isVoidTag(tag.tag)
      ? open
      : `${open}${tag.children ?? ''}</${tag.tag}>`
    const target = tag.injectTo === 'body' ? '</body>' : '</head>'
    result = result.includes(target) ? result.replace(target, `${code}\n${target}`) : `${code}\n${result}`
  }
  return result
}

function isVoidTag(tag: string): boolean {
  return ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'].includes(tag)
}
