#!/usr/bin/env node
import { performance } from 'node:perf_hooks'
import { VERSION } from './constants.js'
import { build } from './build.js'
import { createServer } from './server/index.js'
import { preview } from './preview.js'
import type { InlineConfig } from './config.js'

interface ParsedCli {
  command: 'serve' | 'build' | 'preview'
  root?: string
  options: Record<string, string | boolean | number>
}

async function main(): Promise<void> {
  const started = performance.now()
  const parsed = parseCli(process.argv.slice(2))
  const inlineConfig = toInlineConfig(parsed)

  if (parsed.options.version) {
    process.stdout.write(`vite-source/${VERSION}\n`)
    return
  }

  if (parsed.options.help) {
    printHelp()
    return
  }

  if (parsed.command === 'build') {
    await build(inlineConfig)
    return
  }

  if (parsed.command === 'preview') {
    const server = await preview(inlineConfig)
    server.printUrls()
    return
  }

  const server = await createServer(inlineConfig)
  await server.listen()
  server.config.logger.info(`\n  VITE-SOURCE v${VERSION} ready in ${Math.ceil(performance.now() - started)} ms`)
  server.printUrls()
}

function parseCli(args: string[]): ParsedCli {
  const command = normalizeCommand(args[0])
  const rest = command === 'serve' ? args : args.slice(1)
  const options: ParsedCli['options'] = {}
  let root: string | undefined

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('-')) {
      root = arg
      continue
    }

    const key = arg.replace(/^--?/, '')
    const next = rest[i + 1]
    if (!next || next.startsWith('-')) {
      options[key] = true
    } else {
      options[key] = /^\d+$/.test(next) ? Number(next) : next
      i++
    }
  }

  return { command, root, options }
}

function normalizeCommand(command?: string): ParsedCli['command'] {
  if (command === 'build' || command === 'preview') return command
  return 'serve'
}

function toInlineConfig(parsed: ParsedCli): InlineConfig {
  const options = parsed.options
  return {
    root: parsed.root,
    base: typeof options.base === 'string' ? options.base : undefined,
    mode: typeof options.mode === 'string' ? options.mode : undefined,
    configFile: typeof options.config === 'string' ? options.config : undefined,
    server: {
      port: typeof options.port === 'number' ? options.port : undefined,
      host: typeof options.host === 'string' ? options.host : undefined,
      strictPort: Boolean(options.strictPort),
      open: readOpenOption(options.open),
    },
    build: {
      outDir: typeof options.outDir === 'string' ? options.outDir : undefined,
      emptyOutDir: options.emptyOutDir === false ? false : undefined,
    },
    preview: {
      port: typeof options.port === 'number' ? options.port : undefined,
      host: typeof options.host === 'string' ? options.host : undefined,
      outDir: typeof options.outDir === 'string' ? options.outDir : undefined,
      open: readOpenOption(options.open),
    },
  }
}

function readOpenOption(value: string | boolean | number | undefined): string | boolean | undefined {
  return typeof value === 'string' || typeof value === 'boolean' ? value : undefined
}

function printHelp(): void {
  process.stdout.write(`
vite-source/${VERSION}

Usage:
  vite-source [root] [--port 5173]
  vite-source build [root] [--outDir dist]
  vite-source preview [root] [--port 4173]

This is a source-reading clone focused on Vite's core execution flow.
`)
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exit(1)
})
