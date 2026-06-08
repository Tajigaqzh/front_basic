import { runtimePublicPath } from './constants.js'

const refreshContentRE = /\$Refresh(?:Reg|Sig)\$\(/
const reactCompRE = /extends\s+(?:React\.)?(?:Pure)?Component/

export function isRefreshCandidate(id: string, code: string): boolean {
  if (!/\.[jt]sx$/.test(id)) return false
  return refreshContentRE.test(code) || reactCompRE.test(code) || /export\s+default\s+function\s+[A-Z]/.test(code)
}

export function addRefreshWrapper(code: string, id: string, reactRefreshHost: string): string {
  const escapedId = JSON.stringify(id)
  let wrapped = code
  wrapped += `

import * as RefreshRuntime from "${reactRefreshHost}${runtimePublicPath}";
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error("@vitejs/plugin-react can't detect preamble. Something is wrong.");
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh(${escapedId}, currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate(${escapedId}, currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
`

  if (refreshContentRE.test(code)) {
    wrapped += `
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, ${escapedId} + ' ' + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}
`
  }

  return wrapped
}

