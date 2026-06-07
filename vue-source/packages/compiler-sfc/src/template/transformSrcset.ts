import { isDataUrl, isExternalUrl, isRelativeUrl } from './templateUtils'
import type { AssetURLOptions } from './transformAssetUrl'

export function collectSrcsetTransforms(
  source: string,
  options: Required<AssetURLOptions>,
): string[] {
  const tips: string[] = []
  const re = /<(img|source)\b[^>]*\bsrcset=["']([^"']+)["']/g
  for (const match of source.matchAll(re)) {
    const tag = match[1]
    const value = match[2]
    const items = value.split(',').map(item => item.trim()).filter(Boolean)
    for (const item of items) {
      const url = item.split(/\s+/, 1)[0]
      if (!url || isExternalUrl(url) || isDataUrl(url)) continue
      if (options.includeAbsolute || isRelativeUrl(url)) {
        tips.push(`transform srcset candidate: <${tag} srcset="${url}">`)
      }
    }
  }
  return tips
}
