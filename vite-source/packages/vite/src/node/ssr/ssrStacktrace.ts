export interface SsrStacktraceFrame {
  file: string
  line?: number
  column?: number
}

/**
 * 对齐官方 ssr/ssrStacktrace.ts。
 *
 * 官方会使用 sourcemap 把运行时错误栈还原到源码位置。阅读版保留两个
 * 同名职责函数：rewrite 用于生成展示栈，fix 用于就地修正 Error.stack。
 */
export function ssrRewriteStacktrace(stack: string): string {
  return stack
    .split('\n')
    .filter((line) => !line.includes('__vite_ssr_import__'))
    .join('\n')
}

export function ssrFixStacktrace(error: Error): void {
  if (error.stack) error.stack = ssrRewriteStacktrace(error.stack)
}
