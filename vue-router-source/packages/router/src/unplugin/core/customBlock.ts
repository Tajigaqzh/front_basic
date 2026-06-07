import type { SFCBlock } from '@vue/compiler-sfc'
import { parse as parseSFC } from '@vue/compiler-sfc'
import type { ResolvedOptions } from '../options'
import JSON5 from 'json5'
import { parse as parseYaml } from 'yaml'
import { warn } from './utils'
import type { DefinePageQueryParamOptions } from '../../experimental/runtime'
import type { RouteRecordRaw } from '../../types'

export function getRouteBlock(
  path: string,
  content: string,
  options: ResolvedOptions
) {
  // 从 SFC 里提取第一个 <route> 自定义块，并解析成可合并的 route override。
  const parsedSFC = parseSFC(content, { pad: 'space' }).descriptor
  const blockStr = parsedSFC?.customBlocks.find(b => b.type === 'route')

  if (blockStr) return parseCustomBlock(blockStr, path, options)
}

export interface CustomRouteBlock extends Partial<
  Omit<
    RouteRecordRaw,
    'components' | 'component' | 'children' | 'beforeEnter' | 'name' | 'alias'
  >
> {
  // 这是 <route> block / definePage 最终会收敛到的用户侧 override 形态。
  name?: string | undefined | false

  alias?: string[]

  params?: {
    /**
     * Override the parser for a given path param. Set to `null` to remove a
     * filename-based parser (e.g. revert `[id=int]` back to no parser).
     */
    path?: Record<string, string | null>

    /**
     * Declare query params for the route. The value is either a parser name
     * or an options object with `parser`, `format`, `default`, and `required`.
     */
    query?: Record<string, string | CustomRouteBlockQueryParamOptions>
  }
}

export interface CustomRouteBlockQueryParamOptions {
  parser?: string
  format?: DefinePageQueryParamOptions['format']
  // TODO: queryKey?: string
  default?: string
  required?: boolean
}

function parseCustomBlock(
  block: SFCBlock,
  filePath: string,
  options: ResolvedOptions
): CustomRouteBlock | void {
  // 支持 json5/json/yaml/yml 四种 route block 语言。
  const lang = block.lang ?? options.routeBlockLang

  if (lang === 'json5') {
    try {
      return JSON5.parse(block.content)
    } catch (err: any) {
      warn(
        `Invalid JSON5 format of <${block.type}> content in ${filePath}\n${err.message}`
      )
    }
  } else if (lang === 'json') {
    try {
      return JSON.parse(block.content)
    } catch (err: any) {
      warn(
        `Invalid JSON format of <${block.type}> content in ${filePath}\n${err.message}`
      )
    }
  } else if (lang === 'yaml' || lang === 'yml') {
    try {
      return parseYaml(block.content)
    } catch (err: any) {
      warn(
        `Invalid YAML format of <${block.type}> content in ${filePath}\n${err.message}`
      )
    }
  } else {
    warn(
      `Language "${lang}" for <${block.type}> is not supported. Supported languages are: json5, json, yaml, yml. Found in in ${filePath}.`
    )
  }
}
