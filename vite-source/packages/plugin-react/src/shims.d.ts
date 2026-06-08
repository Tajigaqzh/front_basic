declare module 'node:fs/promises' {
  const fs: any
  export default fs
}

declare module 'node:path' {
  const path: any
  export default path
}

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}
