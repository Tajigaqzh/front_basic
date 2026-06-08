export const defaultIncludeRE = /\.[tj]sx?$/
export const defaultExcludeRE = /\/node_modules\//
export const runtimePublicPath = '/@react-refresh'

export const preambleCode = `import { injectIntoGlobalHook } from "__BASE__${runtimePublicPath.slice(1)}";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;`

export function getPreambleCode(base: string): string {
  return preambleCode.replace('__BASE__', base)
}

