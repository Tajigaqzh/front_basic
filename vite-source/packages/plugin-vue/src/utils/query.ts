export interface VueQuery {
  vue?: boolean
  type?: 'template' | 'script' | 'style' | 'custom'
  index?: number
  id?: string
  scoped?: boolean
  blockType?: string
}

/**
 * 官方 utils/query.ts 用 URLSearchParams 把 .vue 子请求拆成
 * filename + query。这个信息决定后续走 template/style/script 哪条编译分支。
 */
export function parseVueRequest(id: string): { filename: string; query: VueQuery } {
  const [filename, rawQuery = ''] = id.split('?', 2)
  const params = new URLSearchParams(rawQuery)
  return {
    filename,
    query: {
      vue: params.has('vue'),
      type: params.get('type') as VueQuery['type'] | undefined,
      index: params.has('index') ? Number(params.get('index')) : undefined,
      id: params.get('id') ?? undefined,
      scoped: params.has('scoped'),
      blockType: params.get('blockType') ?? undefined,
    },
  }
}
