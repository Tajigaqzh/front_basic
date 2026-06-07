import { isDataUrl, isExternalUrl, isRelativeUrl } from './templateUtils'

export interface AssetURLTagConfig {
  [name: string]: string[]
}

export interface AssetURLOptions {
  base?: string | null
  includeAbsolute?: boolean
  tags?: AssetURLTagConfig
}

export const defaultAssetUrlOptions: Required<AssetURLOptions> = {
  base: null,
  includeAbsolute: false,
  tags: {
    video: ['src', 'poster'],
    source: ['src'],
    img: ['src'],
    image: ['xlink:href', 'href'],
    use: ['xlink:href', 'href'],
  },
}

export function normalizeOptions(
  options: AssetURLOptions | AssetURLTagConfig,
): Required<AssetURLOptions> {
  const values = Object.values(options)
  if (values.some(value => Array.isArray(value))) {
    return {
      ...defaultAssetUrlOptions,
      tags: options as AssetURLTagConfig,
    }
  }
  return {
    ...defaultAssetUrlOptions,
    ...(options as AssetURLOptions),
    tags: {
      ...defaultAssetUrlOptions.tags,
      ...((options as AssetURLOptions).tags || {}),
    },
  }
}

export function collectAssetUrlTransforms(
  source: string,
  options: Required<AssetURLOptions>,
): string[] {
  const tips: string[] = []
  const tags = options.tags
  for (const [tag, attrs] of Object.entries(tags)) {
    if (tag === '*') continue
    for (const attr of attrs) {
      const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["']`, 'g')
      for (const match of source.matchAll(re)) {
        const url = match[1]
        if (isExternalUrl(url) || isDataUrl(url)) continue
        if (options.includeAbsolute ? url !== '#' : isRelativeUrl(url)) {
          tips.push(`transform asset url: <${tag} ${attr}="${url}">`)
        }
      }
    }
  }
  return tips
}
