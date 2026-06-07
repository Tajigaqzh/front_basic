// vue-router/auto/routes was more natural but didn't work well with TS
export const MODULE_ROUTES_PATH = `vue-router/auto-routes`
export const MODULE_RESOLVER_PATH = `vue-router/auto-resolver`
// 这两个路径是给用户 import 的“虚拟模块入口名”。

// NOTE: not sure if needed. Used for HMR the virtual routes
let time = Date.now()
/**
 * Last time the routes were loaded from MODULE_ROUTES_PATH
 */
export const ROUTES_LAST_LOAD_TIME = {
  // 用于 HMR / 虚拟模块重新加载时标记最新生成时间。
  get value() {
    return time
  },
  update(when = Date.now()) {
    time = when
  },
}

// we used to have `/__` because HMR didn't work with `\0` virtual modules
// but it seems to work now, so switching to the official Vite virtual module prefix
export const VIRTUAL_PREFIX = '\0'
// Vite 官方虚拟模块前缀。

// allows removing the route block from the code
export const ROUTE_BLOCK_ID = asVirtualId('vue-router/auto/route-block')
// 这个虚拟模块专门用于吞掉 <route> block 对应的原始模块请求。

export function getVirtualId(id: string) {
  // 把 \0virtual-id 还原成普通逻辑 id。
  return id.startsWith(VIRTUAL_PREFIX) ? id.slice(VIRTUAL_PREFIX.length) : null
}

export const routeBlockQueryRE = /\?vue&type=route/

export function asVirtualId(id: string) {
  // 把逻辑 id 包装成 bundler 识别的虚拟模块 id。
  return VIRTUAL_PREFIX + id
}

export const DEFINE_PAGE_QUERY_RE = /\?.*\bdefinePage&vue\b/
