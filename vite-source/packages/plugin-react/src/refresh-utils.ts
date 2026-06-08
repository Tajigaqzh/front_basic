import { runtimePublicPath } from './constants.js'

const refreshContentRE = /\$Refresh(?:Reg|Sig)\$\(/
const reactCompRE = /extends\s+(?:React\.)?(?:Pure)?Component/

export function isRefreshCandidate(id: string, code: string): boolean {
  // 只对 JSX/TSX 做 Fast Refresh 候选判断，普通 .ts 工具函数不需要包 HMR。
  if (!/\.[jt]sx$/.test(id)) return false
  /**
   * 三种阅读版判定：
   * - Babel/React 编译产物里出现 $RefreshReg$/$RefreshSig$。
   * - class 组件继承 React.Component/PureComponent。
   * - 默认导出的大写函数组件。
   */
  return refreshContentRE.test(code) || reactCompRE.test(code) || /export\s+default\s+function\s+[A-Z]/.test(code)
}

export function addRefreshWrapper(code: string, id: string, reactRefreshHost: string): string {
  // id 写入 runtime registry，用来区分不同文件导出的组件。
  const escapedId = JSON.stringify(id)
  // 先保留 esbuild 转换后的原代码，再追加 HMR runtime 连接代码。
  let wrapped = code
  wrapped += `

import * as RefreshRuntime from "${reactRefreshHost}${runtimePublicPath}";
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  // preamble 会提前挂 window.$RefreshReg$；没有它说明 HTML 注入顺序不正确。
  if (!window.$RefreshReg$) {
    throw new Error("@vitejs/plugin-react can't detect preamble. Something is wrong.");
  }
  // 先拿当前模块 exports，注册里面的 React 组件。
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh(${escapedId}, currentExports);
    // 当前模块 self-accept；下一版代码加载后对比新旧 exports 是否仍是安全边界。
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate(${escapedId}, currentExports, nextExports);
      // 如果导出形状变化导致不能安全刷新，就退化成整页刷新。
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
`

  if (refreshContentRE.test(code)) {
    // 编译产物中引用了 $RefreshReg$/$RefreshSig$ 时，补局部代理函数。
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
