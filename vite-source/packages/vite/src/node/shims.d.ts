declare module 'node:fs' {
  const fs: any
  export default fs
  export const existsSync: any
  export const readFileSync: any
  export const writeFileSync: any
  export const statSync: any
  export const mkdirSync: any
  export const readdirSync: any
  export const rmSync: any
  export const watch: any
}

declare module 'node:fs/promises' {
  export const readFile: any
  export const writeFile: any
  export const mkdir: any
  export const stat: any
  export const readdir: any
  export const rm: any
  export const copyFile: any
}

declare module 'node:path' {
  const path: any
  export default path
}

declare module 'node:url' {
  export const pathToFileURL: any
  export const fileURLToPath: any
}

declare module 'node:http' {
  export const createServer: any
  export const request: any
}

declare module 'node:https' {
  export const request: any
}

declare module 'node:module' {
  export const builtinModules: string[]
}

declare module 'node:crypto' {
  export const createHash: any
}

declare module 'node:perf_hooks' {
  export const performance: { now(): number }
}

declare module 'less' {
  const less: any
  export default less
}

declare const process: {
  argv: string[]
  cwd(): string
  env: Record<string, string | undefined>
  exit(code?: number): never
  stdout: { write(chunk: string): void }
  stderr: { write(chunk: string): void }
  versions: { node: string }
}

declare const Buffer: {
  from(input: string | Uint8Array, encoding?: string): {
    toString(encoding?: string): string
  }
}

declare const __dirname: string
