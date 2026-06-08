/**
 * 官方 @vitejs/plugin-react 会导出 React Compiler preset。
 * 当前 vite-source 阅读版没有接入 Babel/Rolldown compiler 管线，
 * 这里保留同名导出，避免使用方导入时报错。
 */
export function reactCompilerPreset(): never {
  throw new Error('reactCompilerPreset is not implemented in vite-source plugin-react.')
}

