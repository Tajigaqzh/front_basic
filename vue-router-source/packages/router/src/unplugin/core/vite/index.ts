import { type ViteDevServer } from 'vite'
import { type ServerContext } from '../../options'
import {
  MODULE_RESOLVER_PATH,
  MODULE_ROUTES_PATH,
  asVirtualId,
} from '../moduleConstants'

export function createViteContext(server: ViteDevServer): ServerContext {
  function invalidate(path: string): false | Promise<void> {
    const foundModule = server.moduleGraph.getModuleById(path)
    // console.log(`🟣 Invalidating module: ${path}, found: ${!!foundModule}`)
    if (foundModule) {
      return server.reloadModule(foundModule)
    }
    return !!foundModule
  }

  function invalidatePage(filepath: string): Promise<void> | false {
    const pageModules = server.moduleGraph.getModulesByFile(filepath)
    // console.log(`🟣 Invalidating page: ${filepath}, found: ${!!pageModule}`)
    if (pageModules) {
      return Promise.all(
        [...pageModules].map(mod => server.reloadModule(mod))
      ).then(() => {})
    }
    return false
  }

  function reload() {
    // 某些结构性变化无法靠单模块 HMR 修复时，直接整页刷新更可靠。
    server.ws.send({
      type: 'full-reload',
      path: '*',
    })
  }

  /**
   * Triggers HMR for the vue-router/auto-routes module.
   */
  async function updateRoutes() {
    // 两个虚拟模块一个产出 routes，一个产出 resolver，改路由时都要同步失效。
    const autoRoutesMod = server.moduleGraph.getModuleById(
      asVirtualId(MODULE_ROUTES_PATH)
    )
    const autoResolvedMod = server.moduleGraph.getModuleById(
      asVirtualId(MODULE_RESOLVER_PATH)
    )

    await Promise.all([
      autoRoutesMod && server.reloadModule(autoRoutesMod),
      autoResolvedMod && server.reloadModule(autoResolvedMod),
    ])
  }

  return {
    // 对外暴露一组与 bundler 无关的上下文能力，供 watcher / codegen 统一调用。
    invalidate,
    invalidatePage,
    updateRoutes,
    reload,
  }
}
