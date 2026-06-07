import { type FSWatcher, watch as fsWatch } from 'chokidar'
import picomatch from 'picomatch'
import { resolve } from 'pathe'
import type {
  ResolvedOptions,
  RoutesFolderOption,
  RoutesFolderOptionResolved,
} from '../options'
import { _OverridableOption } from '../options'
import { appendExtensionListToPattern, asRoutePath } from './utils'
import path from 'pathe'

// TODO: export an implementable interface to create a watcher and let users provide a different watcher than chokidar to improve performance on windows

export class RoutesFolderWatcher {
  src: string
  path: string | ((filepath: string) => string)
  extensions: string[]
  filePatterns: string[]
  exclude: string[]

  watcher: FSWatcher

  constructor(folderOptions: RoutesFolderOptionResolved) {
    // 每个 routes folder 都会对应一个 watcher，独立负责自己的文件变化流。
    this.src = folderOptions.src
    this.path = folderOptions.path
    this.exclude = folderOptions.exclude
    this.extensions = folderOptions.extensions
    // the pattern includes the extenions, so we leverage picomatch check
    this.filePatterns = folderOptions.pattern

    const isMatch = picomatch(this.filePatterns, {
      ignore: this.exclude,
      // it seems like cwd isn't used by picomatch
      // so we need to use path.relative to get the relative path
      // cwd: this.src,
    })

    this.watcher = fsWatch('.', {
      // watcher 只监听匹配 pages 模式的文件，其他文件一律忽略。
      cwd: this.src,
      ignoreInitial: true,
      ignorePermissionErrors: true,
      // usePolling: !!process.env.CI,
      // interval: process.env.CI ? 100 : undefined,
      awaitWriteFinish: !!process.env.CI,
      ignored: (filePath, stats) => {
        // let folders pass, they are ignored by the glob pattern
        if (!stats || stats.isDirectory()) {
          return false
        }

        return !isMatch(path.relative(this.src, filePath))
      },

      // TODO: allow user options
    })
  }

  on(
    event: 'add' | 'change' | 'unlink' | 'unlinkDir',
    handler: (context: HandlerContext) => void
  ) {
    // 对外统一暴露 { filePath, routePath }，把文件系统事件转成路由语义事件。
    this.watcher.on(event, (filePath: string) => {
      // console.log('📦 Event', event, filePath)

      // ensure consistent absolute path for Windows and Unix
      filePath = resolve(this.src, filePath)

      handler({
        filePath,
        routePath: asRoutePath(
          {
            src: this.src,
            path: this.path,
            extensions: this.extensions,
          },
          filePath
        ),
      })
    })
    return this
  }

  close() {
    return this.watcher.close()
  }
}

export interface HandlerContext {
  // resolved path
  filePath: string
  // routePath
  routePath: string
}

export function resolveFolderOptions(
  globalOptions: ResolvedOptions,
  folderOptions: RoutesFolderOption
): RoutesFolderOptionResolved {
  // routesFolder 级配置会在这里和全局配置合并，得到真正可扫描的 resolved 结构。
  const extensions = overrideOption(
    globalOptions.extensions,
    folderOptions.extensions
  )
  const filePatterns = overrideOption(
    globalOptions.filePatterns,
    folderOptions.filePatterns
  )

  return {
    src: path.resolve(globalOptions.root, folderOptions.src),
    pattern: appendExtensionListToPattern(
      filePatterns,
      // also override the extensions if the folder has a custom extensions
      extensions
    ),
    path: folderOptions.path || '',
    extensions,
    filePatterns,
    exclude: overrideOption(globalOptions.exclude, folderOptions.exclude).map(
      p => (p.startsWith('**') ? p : resolve(p))
    ),
  }
}

function overrideOption(
  existing: string[] | string,
  newValue: undefined | string[] | string | ((existing: string[]) => string[])
): string[] {
  // 这里是局部 folder 配置覆盖全局配置的核心逻辑。
  const asArray = typeof existing === 'string' ? [existing] : existing
  // allow extending when a function is passed
  if (typeof newValue === 'function') {
    return newValue(asArray)
  }
  // override if passed
  if (typeof newValue !== 'undefined') {
    return typeof newValue === 'string' ? [newValue] : newValue
  }
  // fallback to existing
  return asArray
}
