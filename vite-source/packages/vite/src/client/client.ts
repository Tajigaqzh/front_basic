const hotModulesMap = new Map()

type HotCallback = (mod: unknown) => void

interface HotModule {
  callbacks: Array<{ deps: string[]; callback?: HotCallback }>
  dispose?: () => void
}

function normalizeHmrUrl(dep: string, ownerPath: string): string {
  if (dep[0] === '.') return new URL(dep, location.origin + ownerPath).pathname
  return dep
}

export function createHotContext(ownerPath: string) {
  const mod: HotModule = hotModulesMap.get(ownerPath) || { callbacks: [] }
  hotModulesMap.set(ownerPath, mod)
  return {
    accept(deps?: string | string[] | HotCallback, callback?: HotCallback) {
      if (typeof deps === 'function') {
        callback = deps
        deps = [ownerPath]
      } else if (typeof deps === 'string') {
        deps = [deps]
      } else if (!Array.isArray(deps)) {
        deps = [ownerPath]
      }
      mod.callbacks.push({
        deps: deps.map((dep) => normalizeHmrUrl(dep, ownerPath)),
        callback,
      })
    },
    dispose(callback: () => void) {
      mod.dispose = callback
    },
    invalidate() {
      location.reload()
    },
  }
}

const socket = new WebSocket(`ws://${location.host}/@vite/ws`)

socket.addEventListener('message', async (event) => {
  const payload = JSON.parse(event.data)
  if (payload.type === 'connected') {
    console.debug('[vite-source] websocket connected')
  }
  if (payload.type === 'full-reload') {
    location.reload()
  }
  if (payload.type === 'update') {
    for (const update of payload.updates) {
      const mod = hotModulesMap.get(update.path)
      mod?.dispose?.()
      const next = await import(`${update.path}?t=${update.timestamp || Date.now()}`)
      for (const cb of mod?.callbacks || []) {
        if (cb.deps.includes(update.acceptedPath) || cb.deps.includes(update.path)) {
          cb.callback?.(next)
        }
      }
    }
  }
})
