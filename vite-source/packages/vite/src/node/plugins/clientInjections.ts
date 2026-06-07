import type { Plugin, ResolvedConfig } from '../plugin.js'
import { CLIENT_PUBLIC_PATH, ENV_PUBLIC_PATH, HMR_WS_PATH } from '../constants.js'

export function clientInjectionsPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite-source:client-injections',
    resolveId(id) {
      if (id === CLIENT_PUBLIC_PATH || id === ENV_PUBLIC_PATH) return { id }
      return null
    },
    load(id) {
      if (id === ENV_PUBLIC_PATH) {
        return `export const MODE = ${JSON.stringify(config.mode)};\nexport const BASE_URL = ${JSON.stringify(config.base)};`
      }

      if (id !== CLIENT_PUBLIC_PATH) return null

      /**
       * 官方 client.ts 包含错误浮层、CSS HMR、React Refresh 辅助等逻辑。
       * 这里保留最核心的 HMR 通道：连接服务端 WebSocket，收到
       * full-reload 时刷新页面，收到 update 时动态 import 新模块。
       */
      return [
        `const hotModulesMap = new Map();`,
        `const dataMap = new Map();`,
        `const customListenersMap = new Map();`,
        `function normalizeHmrUrl(dep, ownerPath) {`,
        `  if (dep[0] === '.') return new URL(dep, location.origin + ownerPath).pathname;`,
        `  return dep;`,
        `}`,
        `export function createHotContext(ownerPath) {`,
        `  const mod = hotModulesMap.get(ownerPath) || { callbacks: [], pruneCallbacks: [] };`,
        `  hotModulesMap.set(ownerPath, mod);`,
        `  const data = dataMap.get(ownerPath) || {};`,
        `  dataMap.set(ownerPath, data);`,
        `  return {`,
        `    data,`,
        `    accept(deps, callback) {`,
        `      if (typeof deps === 'function') { callback = deps; deps = [ownerPath]; }`,
        `      else if (typeof deps === 'string') deps = [deps];`,
        `      else if (!Array.isArray(deps)) deps = [ownerPath];`,
        `      mod.callbacks.push({ deps: deps.map((dep) => normalizeHmrUrl(dep, ownerPath)), callback });`,
        `    },`,
        `    dispose(callback) { mod.dispose = callback; },`,
        `    prune(callback) { mod.pruneCallbacks.push(callback); },`,
        `    invalidate() { location.reload(); },`,
        `    on(event, callback) {`,
        `      const listeners = customListenersMap.get(event) || [];`,
        `      listeners.push(callback);`,
        `      customListenersMap.set(event, listeners);`,
        `    },`,
        `    off(event, callback) {`,
        `      const listeners = customListenersMap.get(event) || [];`,
        `      customListenersMap.set(event, listeners.filter((item) => item !== callback));`,
        `    },`,
        `    send(event, data) { socket.send(JSON.stringify({ type: 'custom', event, data })); },`,
        `  };`,
        `}`,
        `const socket = new WebSocket('ws://' + location.host + ${JSON.stringify(HMR_WS_PATH)});`,
        `socket.addEventListener('message', async (event) => {`,
        `  const payload = JSON.parse(event.data);`,
        `  if (payload.type === 'connected') console.debug('[vite-source] connected');`,
        `  if (payload.type === 'full-reload') location.reload();`,
        `  if (payload.type === 'custom') {`,
        `    for (const listener of customListenersMap.get(payload.event) || []) listener(payload.data);`,
        `  }`,
        `  if (payload.type === 'prune') {`,
        `    for (const path of payload.paths || []) {`,
        `      const mod = hotModulesMap.get(path);`,
        `      mod?.dispose?.(dataMap.get(path));`,
        `      for (const cb of mod?.pruneCallbacks || []) cb(dataMap.get(path));`,
        `      hotModulesMap.delete(path);`,
        `      dataMap.delete(path);`,
        `    }`,
        `  }`,
        `  if (payload.type === 'update') {`,
        `    for (const update of payload.updates) {`,
        `      const mod = hotModulesMap.get(update.path);`,
        `      mod?.dispose?.(dataMap.get(update.path));`,
        `      const next = await import(update.path + '?t=' + (update.timestamp || Date.now()));`,
        `      const callbacks = mod?.callbacks || [];`,
        `      for (const cb of callbacks) {`,
        `        if (cb.deps.includes(update.acceptedPath) || cb.deps.includes(update.path)) {`,
        `          cb.callback?.(next);`,
        `        }`,
        `      }`,
        `    }`,
        `  }`,
        `});`,
        `window.__VITE_SOURCE_HMR__ = socket;`,
      ].join('\n')
    },
  }
}
