export const refreshRuntimeCode = `
const noop = () => {};
let runtime = window.__vite_plugin_react_preamble_installed__ ? window.$RefreshRuntime$ : null;

export function injectIntoGlobalHook(window) {
  if (!window.__vite_plugin_react_preamble_installed__) {
    window.__vite_plugin_react_preamble_installed__ = true;
  }
  window.$RefreshReg$ = window.$RefreshReg$ || noop;
  window.$RefreshSig$ = window.$RefreshSig$ || (() => type => type);
  window.$RefreshRuntime$ = window.$RefreshRuntime$ || {
    register: noop,
    createSignatureFunctionForTransform: () => type => type,
    performReactRefresh: noop,
  };
  runtime = window.$RefreshRuntime$;
}

export function register(type, id) {
  runtime?.register?.(type, id);
}

export function createSignatureFunctionForTransform() {
  return runtime?.createSignatureFunctionForTransform?.() || (type => type);
}

export function registerExportsForReactRefresh(id, currentExports) {
  for (const key in currentExports) {
    if (key === '__esModule') continue;
    const value = currentExports[key];
    if (typeof value === 'function' || typeof value === 'object') {
      register(value, id + ' export ' + key);
    }
  }
}

export async function __hmr_import(url) {
  return import(url);
}

export function validateRefreshBoundaryAndEnqueueUpdate() {
  runtime?.performReactRefresh?.();
  return '';
}
`

