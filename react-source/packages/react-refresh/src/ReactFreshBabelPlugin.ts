/**
 * @beginner-module: 源码导读
 * 本文件是 React 复刻版源码的一部分，注释按小白读源码顺序解释关键代码。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 定义 BabelLike：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type BabelLike = {
  env?: () => string;
  types?: {
    identifier(name: string): unknown;
  };
};

// @beginner: 定义 ReactFreshBabelPluginOptions：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ReactFreshBabelPluginOptions = {
  skipEnvCheck?: boolean;
  refreshReg?: string;
  refreshSig?: string;
};

// @beginner: 定义 ProgramPathLike：给复杂数据结构起名字，后续代码会按这个形状传递数据。
type ProgramPathLike = {
  node?: {
    body?: unknown[];
  };
};

/**
 * React Refresh Babel 插件的轻量 TypeScript 入口。
 *
 * 官方实现会扫描组件声明并注入 `$RefreshReg$`/`$RefreshSig$` 调用。当前源码复刻
 * 已实现 runtime API，这里保留同名 Babel 插件、开发环境校验和 visitor 形态，
 * 方便调用方按官方包路径加载；完整 AST transform 后续可继续扩展。
 */
export default function ReactFreshBabelPlugin(
  babel: BabelLike,
  opts: ReactFreshBabelPluginOptions = {},
): {
  name: string;
  visitor: {
    Program: {
      exit(path: ProgramPathLike): void;
    };
  };
} {
  // @beginner: 条件分支：根据当前值选择不同处理路径。
  if (typeof babel.env === "function") {
    // @beginner: 声明 env：保存当前步骤需要读取或更新的数据。
    const env = babel.env();
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (env !== "development" && !opts.skipEnvCheck) {
      // @beginner: 抛出错误：当前流程无法继续，交给上层错误边界或调用者处理。
      throw new Error(
        `React Refresh Babel transform should only be enabled in development environment. Instead, the environment is: "${env}".`,
      );
    }
  }

  // @beginner: 声明 refreshReg：保存当前步骤需要读取或更新的数据。
  const refreshReg = opts.refreshReg || "$RefreshReg$";
  // @beginner: 声明 refreshSig：保存当前步骤需要读取或更新的数据。
  const refreshSig = opts.refreshSig || "$RefreshSig$";
  babel.types?.identifier(refreshReg);
  babel.types?.identifier(refreshSig);

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    name: "react-refresh",
    visitor: {
      Program: {
        exit(_path: ProgramPathLike): void {
          // AST 注入在完整 Babel 插件里完成；这里保留可组合 visitor 出口。
        },
      },
    },
  };
}
