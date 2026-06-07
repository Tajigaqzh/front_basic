export type LogLevel = 'info' | 'warn' | 'error' | 'silent'

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string | Error): void
}

const levelWeight: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
  silent: 3,
}

/**
 * Vite 官方源码里 logger 会处理 clearScreen、颜色、错误栈和 debug。
 * 这里保留同一个职责边界：调用方只关心“记录什么”，不关心输出到 stdout
 * 还是 stderr，也不需要到处判断 logLevel。
 */
export function createLogger(level: LogLevel = 'info'): Logger {
  const enabled = (target: LogLevel) => levelWeight[level] <= levelWeight[target]

  return {
    info(message) {
      if (enabled('info')) process.stdout.write(`${message}\n`)
    },
    warn(message) {
      if (enabled('warn')) process.stderr.write(`[vite-source] ${message}\n`)
    },
    error(message) {
      if (!enabled('error')) return
      const text = message instanceof Error ? message.stack || message.message : message
      process.stderr.write(`[vite-source] ${text}\n`)
    },
  }
}
