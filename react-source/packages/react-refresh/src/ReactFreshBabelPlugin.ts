type BabelLike = {
  env?: () => string;
  types?: {
    identifier(name: string): unknown;
  };
};

type ReactFreshBabelPluginOptions = {
  skipEnvCheck?: boolean;
  refreshReg?: string;
  refreshSig?: string;
};

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
  if (typeof babel.env === "function") {
    const env = babel.env();
    if (env !== "development" && !opts.skipEnvCheck) {
      throw new Error(
        `React Refresh Babel transform should only be enabled in development environment. Instead, the environment is: "${env}".`,
      );
    }
  }

  const refreshReg = opts.refreshReg || "$RefreshReg$";
  const refreshSig = opts.refreshSig || "$RefreshSig$";
  babel.types?.identifier(refreshReg);
  babel.types?.identifier(refreshSig);

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
