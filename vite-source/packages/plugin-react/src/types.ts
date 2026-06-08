export type Awaitable<T> = T | Promise<T>

export interface ConfigEnv {
  command: 'serve' | 'build'
  mode: string
}

export interface UserConfig {
  define?: Record<string, unknown>
  esbuild?: Record<string, unknown> | false
  optimizeDeps?: {
    include?: string[]
    exclude?: string[]
  }
}

export interface ResolvedConfig {
  command: 'serve' | 'build'
  mode: string
  root: string
  base: string
  define: Record<string, unknown>
  isProduction: boolean
  server: {
    hmr?: boolean | Record<string, unknown>
  }
  resolve: {
    mainFields?: string[]
    conditions?: string[]
  }
}

export interface HtmlTagDescriptor {
  tag: string
  attrs?: Record<string, string | boolean>
  children?: string
  injectTo?: 'head' | 'body'
}

export interface Plugin {
  name: string
  enforce?: 'pre' | 'post'
  config?: (config: UserConfig, env: ConfigEnv) => Awaitable<UserConfig | void>
  configResolved?: (config: ResolvedConfig) => Awaitable<void>
  resolveId?: (id: string) => Awaitable<string | { id: string } | null | undefined>
  load?: (id: string) => Awaitable<string | { code: string; map?: unknown } | null | undefined>
  transform?: (
    code: string,
    id: string,
  ) => Awaitable<string | { code: string; map?: unknown } | null | undefined>
  transformIndexHtml?: (
    html: string,
    ctx: { path: string; server?: unknown },
  ) => Awaitable<string | HtmlTagDescriptor[] | null | undefined>
}

export interface Options {
  include?: string | RegExp | Array<string | RegExp>
  exclude?: string | RegExp | Array<string | RegExp>
  jsxImportSource?: string
  jsxRuntime?: 'classic' | 'automatic'
  reactRefreshHost?: string
  fastRefresh?: boolean
}
