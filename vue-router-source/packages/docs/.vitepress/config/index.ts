import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { enConfig } from './en'
import { sharedConfig } from './shared'
import { zhConfig } from './zh'

export default withMermaid(
  defineConfig({
    ...sharedConfig,
    mermaid: {
      startOnLoad: false,
    },

    locales: {
      root: { label: 'English', lang: 'en-US', link: '/', ...enConfig },
      zh: { label: '简体中文', lang: 'zh-CN', link: '/zh/', ...zhConfig },
      ko: { label: '한국어', lang: 'ko-KR', link: 'https://router.vuejs.kr/' },
      pt: {
        label: 'Português',
        lang: 'pt-PT',
        link: 'https://vue-router-docs-pt.netlify.app/',
      },
      ru: {
        label: 'Русский',
        lang: 'ru-RU',
        link: 'https://vue-router-ru.netlify.app',
      },
    },
  })
)
