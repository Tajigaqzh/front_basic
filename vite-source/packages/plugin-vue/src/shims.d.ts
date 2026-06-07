declare module 'node:fs' {
  const fs: any
  export default fs
}

declare module 'node:path' {
  const path: any
  export default path
}

declare module 'node:crypto' {
  export const createHash: any
}

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}
