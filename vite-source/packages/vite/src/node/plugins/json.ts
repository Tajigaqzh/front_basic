import fs from 'node:fs'
import type { Plugin } from '../plugin.js'
import { cleanUrl, isJson } from '../utils.js'

export function jsonPlugin(): Plugin {
  return {
    name: 'vite-source:json',
    load(id) {
      if (!isJson(id)) return null
      const filename = cleanUrl(id)
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return null
      const raw = fs.readFileSync(filename, 'utf-8')
      return `export default ${raw.trim()};`
    },
  }
}
