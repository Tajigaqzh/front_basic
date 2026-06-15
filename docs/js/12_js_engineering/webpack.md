# Webpack 深入理解

## 1. Webpack 是什么

Webpack 是一个面向现代 JavaScript 应用的静态模块打包器。它会从一个或多个入口文件开始，分析 `import`、`require`、动态 `import()`、CSS 引用、图片引用等依赖关系，构建出一张模块依赖图，然后把应用需要的模块转换、合并、拆分，最终输出浏览器或其他运行环境可以加载的静态资源。

可以把 webpack 理解成三个角色的组合：

| 角色 | 说明 |
| --- | --- |
| 模块分析器 | 从入口开始递归分析依赖，生成 module graph。 |
| 转换流水线 | 通过 loader 把 TypeScript、JSX、CSS、图片、字体等资源转换成 webpack 能理解的模块。 |
| 打包调度器 | 通过 plugin 和内置优化，把模块组织成 chunk、bundle、runtime 和最终产物。 |

webpack 的核心特点不是“最快”，而是“能力最完整、配置最灵活、生态最成熟”。它适合复杂应用、历史项目、大型企业工程、多入口页面、复杂资源处理、微前端、Module Federation、深度自定义构建链路等场景。

## 2. 为什么需要 Webpack

浏览器原生只能直接执行 JavaScript、CSS、HTML、图片等静态资源，但真实前端项目会遇到很多工程问题：

| 问题 | webpack 的处理方式 |
| --- | --- |
| 模块化 | 支持 ESM、CommonJS、AMD、动态导入等模块形式。 |
| 资源依赖 | CSS、图片、字体、SVG、JSON 等都可以作为模块被引用。 |
| 代码转换 | 通过 loader 支持 TypeScript、JSX、Vue SFC、Sass、Less、PostCSS 等。 |
| 兼容性 | 配合 Babel、SWC、Browserslist 把新语法转换成目标浏览器可运行代码。 |
| 代码拆分 | 把代码拆成多个 chunk，减少首屏加载体积。 |
| 生产优化 | 压缩、tree shaking、scope hoisting、splitChunks、contenthash 缓存。 |
| 开发体验 | dev server、watch、HMR、source map。 |
| 构建扩展 | loader 和 plugin 生态可以深度介入构建流程。 |

webpack 最重要的思想是：**所有资源都可以是模块**。不是只有 JS 文件能进入依赖图，CSS、图片、字体、Worker、WASM 也可以通过模块依赖关系被统一处理。

## 3. 最小配置长什么样

webpack 5 在简单场景下可以零配置运行，但真实项目通常会显式配置入口、输出、loader、plugin 和优化项。

```js
// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],
  devtool: 'eval-cheap-module-source-map',
};
```

这份配置背后的含义：

| 配置项 | 作用 |
| --- | --- |
| `mode` | 决定开发或生产内置优化策略。 |
| `entry` | 构建入口，webpack 从这里开始生成依赖图。 |
| `output` | 控制产物目录、文件名、hash、publicPath 等。 |
| `module.rules` | 配置不同文件类型使用哪些 loader 转换。 |
| `plugins` | 扩展构建流程，例如生成 HTML、抽离 CSS、注入环境变量。 |
| `devtool` | 控制 source map 类型。 |

## 4. 核心概念

### 4.1 Entry

`entry` 是依赖图的起点。单页应用通常只有一个入口，多页应用或复杂工程可以有多个入口。

```js
module.exports = {
  entry: {
    main: './src/main.js',
    admin: './src/admin.js',
  },
};
```

多入口会生成多个入口 chunk，常见于后台系统、多页应用、低代码平台、多租户控制台等。

### 4.2 Output

`output` 决定最终文件输出到哪里、叫什么、如何被浏览器加载。

```js
module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    publicPath: '/',
    clean: true,
  },
};
```

常见字段：

| 字段 | 说明 |
| --- | --- |
| `path` | 输出目录的绝对路径。 |
| `filename` | 入口 chunk 文件名。 |
| `chunkFilename` | 非入口 chunk 文件名，例如动态导入生成的 chunk。 |
| `publicPath` | 运行时加载资源的基础路径，CDN 部署时非常关键。 |
| `clean` | 构建前清理输出目录。 |

### 4.3 Module

webpack 里的 module 不只等于 JS 模块。任何进入依赖图的文件都可以成为 module：

| 类型 | 例子 |
| --- | --- |
| JavaScript | `.js`、`.mjs`、`.cjs` |
| TypeScript | `.ts`、`.tsx` |
| 样式 | `.css`、`.scss`、`.less` |
| 静态资源 | `.png`、`.jpg`、`.svg`、`.woff2` |
| 数据 | `.json`、`.yaml` |
| 框架文件 | `.vue`、`.svelte` |
| 运行时资源 | Web Worker、WASM |

webpack 的模块化能力强，是因为它不只处理 JS，还把资源依赖纳入统一依赖图。

### 4.4 Loader

loader 用来转换模块内容。webpack 默认主要理解 JavaScript 和 JSON，其他文件类型需要 loader 或 webpack 5 内置 Asset Modules 处理。

典型 loader：

| loader | 作用 |
| --- | --- |
| `babel-loader` | 用 Babel 转换 JS/JSX。 |
| `swc-loader` | 用 SWC 转换 JS/TS/JSX，速度通常更快。 |
| `ts-loader` | 调用 TypeScript 编译器处理 TS。 |
| `css-loader` | 解析 CSS 中的 `@import` 和 `url()`。 |
| `style-loader` | 把 CSS 注入到页面 `<style>`。 |
| `sass-loader` | 把 Sass/SCSS 编译成 CSS。 |
| `postcss-loader` | 接入 PostCSS、Autoprefixer、Tailwind 等。 |
| `vue-loader` | 处理 Vue 单文件组件。 |
| `thread-loader` | 把部分 loader 处理放到 worker 池中。 |

loader 的执行顺序很重要：

```js
{
  test: /\.scss$/,
  use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader'],
}
```

普通 loader 从右到左执行：

```text
sass-loader -> postcss-loader -> css-loader -> style-loader
```

也就是先把 SCSS 编译成 CSS，再做 PostCSS 处理，再解析 CSS 依赖，最后注入页面。

### 4.5 Plugin

plugin 用来扩展 webpack 构建流程。loader 面向“单个模块转换”，plugin 面向“整个构建生命周期”。

常见 plugin：

| plugin | 作用 |
| --- | --- |
| `HtmlWebpackPlugin` | 生成 HTML 并自动注入构建产物。 |
| `MiniCssExtractPlugin` | 把 CSS 从 JS 中抽离成独立 CSS 文件。 |
| `DefinePlugin` | 在编译阶段替换全局常量。 |
| `CopyWebpackPlugin` | 复制静态资源。 |
| `WebpackManifestPlugin` | 生成资源清单，方便服务端或框架读取。 |
| `ModuleFederationPlugin` | 实现模块联邦和微前端远程模块加载。 |
| `BundleAnalyzerPlugin` | 分析 bundle 体积。 |
| `ESLintWebpackPlugin` | 构建时执行 ESLint。 |

插件的本质是注册 webpack 生命周期 hook：

```js
class MyPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('MyPlugin', (stats) => {
      console.log('build done');
    });
  }
}

module.exports = {
  plugins: [new MyPlugin()],
};
```

webpack 的插件系统基于 Tapable。很多构建能力不是写死的，而是在不同 hook 上挂载逻辑完成。

### 4.6 Mode

`mode` 有三个值：

| mode | 说明 |
| --- | --- |
| `development` | 面向开发体验，构建更快，默认开启更适合调试的配置。 |
| `production` | 面向生产优化，默认开启压缩、tree shaking 等优化。 |
| `none` | 不启用内置默认优化。 |

生产项目通常会拆成公共配置、开发配置、生产配置：

```text
webpack.common.js
webpack.dev.js
webpack.prod.js
```

### 4.7 Chunk、Bundle、Runtime

这几个概念容易混：

| 概念 | 说明 |
| --- | --- |
| module | 源码层面的模块，例如一个 JS 文件、CSS 文件、图片。 |
| chunk | webpack 对一组 module 的组织单位，常由入口、动态导入或 splitChunks 产生。 |
| bundle | 输出到磁盘或内存中的最终文件，通常由 chunk 生成。 |
| runtime | webpack 注入的运行时代码，负责模块加载、缓存、动态 chunk 加载等。 |

简单理解：

```text
源码文件 -> module graph -> chunk graph -> bundle files
```

runtime 负责在浏览器中执行 webpack 的模块系统，例如：

- 模块缓存。
- `__webpack_require__`。
- 动态加载 chunk。
- HMR 更新。
- publicPath 推断。
- Module Federation 远程模块加载。

## 5. Webpack 的打包原理

webpack 的构建流程可以概括成：

```text
读取配置
  -> 创建 Compiler
  -> 创建 Compilation
  -> 从 entry 开始构建模块
  -> 调用 loader 转换源码
  -> 解析依赖并递归构建 module graph
  -> 根据入口和动态导入生成 chunk graph
  -> 运行优化逻辑
  -> 生成 assets
  -> emit 输出文件
```

### 5.1 Compiler 和 Compilation

| 对象 | 含义 |
| --- | --- |
| `Compiler` | 一次 webpack 配置对应的编译器实例，代表整个构建生命周期。 |
| `Compilation` | 一次具体构建过程，包含 modules、chunks、assets、errors、warnings 等。 |

在 watch 模式下，`Compiler` 通常只创建一次，但每次文件变化都会生成新的 `Compilation`。

```text
Compiler
  ├─ Compilation #1
  ├─ Compilation #2
  └─ Compilation #3
```

理解这个区别对写 plugin 很重要：

- 和整个构建生命周期相关的逻辑挂在 `compiler.hooks`。
- 和某一次构建产物相关的逻辑挂在 `compilation.hooks`。

### 5.2 依赖图是怎么生成的

webpack 从入口文件开始读取源码，然后解析源码中的依赖语句：

```js
import React from 'react';
import './style.css';
import logo from './logo.png';

const Page = () => import('./Page');
```

它会识别：

| 依赖写法 | 结果 |
| --- | --- |
| `import x from './x'` | 静态依赖，通常进入当前 chunk。 |
| `require('./x')` | CommonJS 依赖，也会进入依赖图。 |
| `import('./x')` | 动态依赖，通常生成异步 chunk。 |
| `import './style.css'` | CSS 文件作为模块进入依赖图。 |
| `url('./img.png')` | 通过 css-loader 或 asset module 进入依赖图。 |

每发现一个依赖，webpack 会 resolve 出真实文件路径，然后继续解析该文件，直到没有新依赖为止。

### 5.3 Resolve 解析规则

resolve 负责把模块请求解析成文件路径。

```js
module.exports = {
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    mainFields: ['browser', 'module', 'main'],
  },
};
```

常见解析逻辑：

| 请求 | 解析方式 |
| --- | --- |
| `./utils` | 相对当前文件查找，按 extensions 补后缀。 |
| `/abs/path` | 绝对路径。 |
| `react` | 从 `node_modules` 查找。 |
| `@/components/Button` | 通过 alias 映射到真实目录。 |
| package 入口 | 根据 `mainFields` 选择 `browser`、`module`、`main` 等字段。 |

大型项目中，resolve 配置会影响构建性能。过多 extensions、复杂 alias、错误的 symlink 设置都可能拖慢构建。

### 5.4 Loader 转换原理

loader 是一个函数，输入源码，输出转换后的源码。

```js
module.exports = function myLoader(source) {
  return source.replace('__VERSION__', '1.0.0');
};
```

更完整的 loader 可以返回 source map，也可以异步执行：

```js
module.exports = function myAsyncLoader(source, map) {
  const callback = this.async();

  setTimeout(() => {
    callback(null, source, map);
  }, 10);
};
```

loader 有几个关键特点：

| 特点 | 说明 |
| --- | --- |
| 链式执行 | 多个 loader 可以串联，普通阶段从右到左执行。 |
| 单一职责 | 每个 loader 通常只做一种转换。 |
| 可缓存 | 标记为 cacheable 后可以配合 webpack 缓存减少重复执行。 |
| 可访问上下文 | loader 通过 `this` 访问路径、依赖、异步回调、emitFile 等能力。 |
| 可分 pitch 阶段 | pitch loader 从左到右执行，普通 loader 从右到左执行。 |

loader 更适合做“文件内容转换”，不适合做全局构建产物控制。

### 5.5 Plugin 原理

plugin 通过 hook 介入构建生命周期。webpack 在关键阶段暴露 hook，插件通过 `tap`、`tapAsync`、`tapPromise` 注册逻辑。

```js
class AssetListPlugin {
  apply(compiler) {
    compiler.hooks.emit.tap('AssetListPlugin', (compilation) => {
      const fileNames = Object.keys(compilation.assets).join('\n');

      compilation.assets['asset-list.txt'] = {
        source: () => fileNames,
        size: () => fileNames.length,
      };
    });
  }
}
```

plugin 可以做 loader 做不了的事情：

- 新增、删除、修改输出资源。
- 读取完整 module graph 和 chunk graph。
- 控制 chunk 拆分。
- 注入运行时代码。
- 生成 HTML、manifest、统计信息。
- 接入 dev server、HMR、缓存、性能分析。

### 5.6 Chunk 生成和代码拆分

webpack 会根据入口、动态导入和优化配置生成 chunk。

```js
// 动态导入会产生异步 chunk
const Settings = () => import('./pages/Settings');
```

常见 chunk 来源：

| 来源 | 说明 |
| --- | --- |
| entry | 每个入口通常生成一个入口 chunk。 |
| dynamic import | `import()` 通常生成异步 chunk。 |
| splitChunks | 把公共依赖、第三方依赖拆成共享 chunk。 |
| runtimeChunk | 把 webpack runtime 拆成独立 chunk。 |

生产项目常见配置：

```js
module.exports = {
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          priority: 20,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
      },
    },
  },
};
```

拆包不是越细越好。拆包需要在首屏体积、HTTP 请求数、缓存命中率、重复模块、长期缓存之间权衡。

### 5.7 Tree Shaking 原理

tree shaking 的目标是删除未使用的导出。它依赖 ESM 的静态结构：

```js
// math.js
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

// index.js
import { add } from './math';

console.log(add(1, 2));
```

理想情况下，`multiply` 可以被删除。

webpack tree shaking 需要几个条件配合：

| 条件 | 说明 |
| --- | --- |
| 使用 ESM | 静态 `import/export` 更容易分析。 |
| `mode: 'production'` | 默认启用相关优化。 |
| `optimization.usedExports` | 标记哪些导出被使用。 |
| `sideEffects` | 告诉 webpack 哪些文件没有副作用。 |
| minimizer | Terser 或 SWC 等压缩器最终删除死代码。 |

`package.json` 中的 `sideEffects` 很重要：

```json
{
  "sideEffects": false
}
```

如果某些文件有副作用，需要保留：

```json
{
  "sideEffects": [
    "*.css",
    "./src/polyfill.js"
  ]
}
```

tree shaking 常见失效原因：

- 使用 CommonJS 动态导出。
- 模块顶层存在副作用。
- Babel 把 ESM 转成 CommonJS。
- `sideEffects` 配置错误。
- 引入方式导致整包导入。

### 5.8 HMR 原理

HMR 是 Hot Module Replacement，意思是在不刷新整个页面的情况下替换变更模块。

大致流程：

```text
文件变化
  -> webpack 重新编译变更模块
  -> dev server 通知浏览器
  -> 浏览器拉取 hot update manifest 和 hot update chunk
  -> webpack runtime 判断哪些模块可接受更新
  -> 执行模块替换或回退到刷新页面
```

HMR 能否保持状态，取决于框架和模块是否正确处理更新：

| 场景 | 结果 |
| --- | --- |
| CSS 更新 | 通常可以直接替换样式。 |
| React 组件更新 | 配合 React Refresh 保留组件状态。 |
| 普通 JS 模块 | 需要 `module.hot.accept` 或框架插件处理。 |
| 无法安全替换 | 回退到整页刷新。 |

HMR 不是简单重新执行文件，而是 webpack runtime、dev server、框架插件共同配合的结果。

### 5.9 Source Map

source map 用来把构建后的代码映射回源码，方便调试。

常见配置：

| 配置 | 特点 |
| --- | --- |
| `eval` | 构建快，映射粗糙，适合开发。 |
| `eval-cheap-module-source-map` | 开发常用，速度和定位平衡。 |
| `source-map` | 独立 source map 文件，生产可用但构建慢。 |
| `hidden-source-map` | 生成 source map 但不在产物中暴露引用，适合错误监控上传。 |
| `nosources-source-map` | 不包含源码内容，只保留映射信息。 |

生产环境是否公开 source map 要谨慎。通常做法是构建 source map 上传到 Sentry 等监控平台，但不直接暴露给用户。

## 6. Webpack 生态

webpack 的生态可以分成几层：

```text
webpack core
  -> loader 生态
  -> plugin 生态
  -> dev server 和中间件
  -> 框架集成
  -> 构建分析和性能工具
  -> 微前端和 Module Federation
```

### 6.1 JavaScript 和 TypeScript 生态

| 工具 | 用途 |
| --- | --- |
| `babel-loader` | Babel 转换 JS/JSX，插件生态最丰富。 |
| `swc-loader` | SWC 转换，速度快，适合大型项目。 |
| `esbuild-loader` | 使用 esbuild 做转译或压缩。 |
| `ts-loader` | 使用 TypeScript 编译器处理 TS。 |
| `fork-ts-checker-webpack-plugin` | 把 TS 类型检查放到独立进程，避免阻塞转译。 |

实际项目中常见组合：

| 方案 | 特点 |
| --- | --- |
| `babel-loader` + `tsc --noEmit` | 生态稳，类型检查独立执行。 |
| `swc-loader` + `tsc --noEmit` | 构建更快，适合大型项目。 |
| `ts-loader` + `fork-ts-checker-webpack-plugin` | webpack 内部集成类型检查，但配置更复杂。 |

### 6.2 CSS 生态

| 工具 | 用途 |
| --- | --- |
| `css-loader` | 处理 CSS 依赖和 CSS Modules。 |
| `style-loader` | 开发阶段把 CSS 注入页面。 |
| `mini-css-extract-plugin` | 生产阶段抽离 CSS 文件。 |
| `sass-loader` | 处理 Sass/SCSS。 |
| `less-loader` | 处理 Less。 |
| `postcss-loader` | 接入 PostCSS、Autoprefixer、Tailwind。 |
| `css-minimizer-webpack-plugin` | 压缩 CSS。 |

典型生产配置：

```js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
    }),
  ],
};
```

### 6.3 静态资源生态

webpack 5 内置 Asset Modules 后，很多过去需要 `file-loader`、`url-loader`、`raw-loader` 的场景可以直接配置。

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
      },
      {
        test: /\.(woff2?|ttf|eot)$/i,
        type: 'asset/resource',
      },
    ],
  },
};
```

Asset Modules 类型：

| 类型 | 说明 |
| --- | --- |
| `asset/resource` | 输出独立文件，返回 URL。 |
| `asset/inline` | 转成 data URI 内联。 |
| `asset/source` | 导出源码字符串。 |
| `asset` | 自动在 resource 和 inline 之间选择。 |

### 6.4 HTML、环境变量和静态资源

| 工具 | 用途 |
| --- | --- |
| `html-webpack-plugin` | 生成 HTML 并注入 JS/CSS。 |
| `copy-webpack-plugin` | 复制 public 静态资源。 |
| `DefinePlugin` | 编译期注入常量，例如 `process.env.NODE_ENV`。 |
| `dotenv-webpack` | 从 `.env` 文件注入环境变量。 |
| `webpack-merge` | 合并公共、开发、生产配置。 |

`DefinePlugin` 是文本替换，不是运行时读取环境变量：

```js
new webpack.DefinePlugin({
  __API_BASE__: JSON.stringify('https://api.example.com'),
});
```

构建后代码里会直接变成字符串常量。

### 6.5 Dev Server 和开发体验

`webpack-dev-server` 提供：

- 本地 HTTP 服务。
- watch 文件变化。
- 增量编译。
- HMR。
- proxy 转发接口。
- history API fallback。
- overlay 错误提示。

常见配置：

```js
module.exports = {
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    ],
  },
};
```

### 6.6 分析和诊断工具

| 工具 | 用途 |
| --- | --- |
| `webpack-bundle-analyzer` | 可视化分析 bundle 组成。 |
| `speed-measure-webpack-plugin` | 分析 loader/plugin 耗时。 |
| `webpackbar` | 更友好的构建进度展示。 |
| `stats.json` | webpack 原生构建统计信息。 |
| `source-map-explorer` | 从 source map 角度分析体积。 |
| `Rsdoctor` | Rspack/webpack 构建诊断工具。 |

大型项目优化前，先分析，不要凭感觉改配置。

## 7. Module Federation

Module Federation 是 webpack 5 的重要能力，用来让多个独立构建产物在运行时共享模块。

它常用于微前端，但不限于微前端。核心思想是：

| 角色 | 说明 |
| --- | --- |
| host | 消费远程模块的应用。 |
| remote | 暴露模块给其他应用使用的应用。 |
| shared | 多个应用之间共享的依赖，例如 React。 |
| remoteEntry | remote 输出的运行时入口文件。 |

remote 配置：

```js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'remoteApp',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/Button',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
};
```

host 配置：

```js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'hostApp',
      remotes: {
        remoteApp: 'remoteApp@https://example.com/remoteEntry.js',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
};
```

使用远程模块：

```js
const RemoteButton = React.lazy(() => import('remoteApp/Button'));
```

Module Federation 的优势：

- 多个应用可以独立构建、独立部署。
- host 可以运行时加载 remote。
- 可以共享 React、组件库、工具库等依赖。
- 适合大型组织把一个前端系统拆成多个团队维护。

风险和成本：

- 版本协商复杂，特别是 shared 依赖。
- 运行时加载失败要有降级方案。
- remoteEntry 缓存策略要谨慎。
- 团队边界、发布节奏、回滚策略都要设计好。
- 调试复杂度高于普通单体应用。

Module Federation 不是微前端银弹。它适合组织结构、部署模式和工程复杂度都需要“运行时组合”的场景。

需要注意的是，Module Federation 不是只有 webpack 能用。webpack 5 是原生内置 `ModuleFederationPlugin`，所以它的支持最直接、生态最成熟；Vite 也可以通过插件支持模块联邦，例如 `@originjs/vite-plugin-federation` 或 Module Federation 官方 Vite 插件。区别在于：Vite 的支持来自插件和额外运行时适配，不是 Vite core 原生能力；而 webpack 的支持是构建器内置能力。

这会带来一些实践差异：

| 维度 | webpack Module Federation | Vite Module Federation 插件 |
| --- | --- | --- |
| 支持方式 | webpack 5 内置 `ModuleFederationPlugin`。 | 通过第三方或 Module Federation 官方 Vite 插件接入。 |
| 成熟度 | 使用时间长，复杂项目案例更多。 | 可用，但要关注插件版本、构建格式和兼容性。 |
| Dev 模式 | 和 webpack dev server、HMR、runtime 深度结合。 | 受 Vite bundleless dev 模式影响，remote 侧通常更依赖 build/watch 产物。 |
| webpack 互通 | 原生同源，配置和 runtime 语义一致。 | 可以互通，但要处理 `format`、`from`、shared 依赖等差异。 |
| React shared 风险 | 同 webpack 构建链路下更可控。 | Vite/Rollup 和 webpack 对 CommonJS、chunk、shared 的处理可能不同，需要充分测试。 |

所以更准确的说法是：Vite 支持 Module Federation，但主要依靠插件；webpack 是原生内置支持。大型微前端项目如果高度依赖 Module Federation，webpack/Rspack 仍然更稳；如果项目主要使用 Vite，也可以用 Vite 插件实现模块联邦，但要把兼容性验证作为工程前置工作。

## 8. 性能优化

webpack 性能优化分两类：构建性能和运行时性能。

### 8.1 构建性能优化

| 优化项 | 说明 |
| --- | --- |
| 开启 filesystem cache | webpack 5 持久化缓存能显著减少二次构建成本。 |
| 缩小 loader 范围 | 使用 `include`、`exclude` 避免处理无关文件。 |
| 使用 SWC/esbuild | 替代 Babel/Terser 的部分重型转换。 |
| 减少 resolve 搜索 | 控制 extensions、alias、modules。 |
| 避免过度 source map | 开发和生产使用不同 devtool。 |
| 拆出类型检查 | 用 `tsc --noEmit` 或 `fork-ts-checker-webpack-plugin`。 |
| 分析慢 loader/plugin | 用统计工具定位瓶颈。 |

webpack 5 持久化缓存：

```js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
};
```

缩小 loader 范围：

```js
{
  test: /\.[jt]sx?$/,
  include: path.resolve(__dirname, 'src'),
  use: 'swc-loader',
}
```

### 8.2 运行时性能优化

| 优化项 | 说明 |
| --- | --- |
| 合理 splitChunks | 拆分第三方库、公共模块和页面代码。 |
| runtimeChunk | 避免 runtime 变化影响业务 chunk 缓存。 |
| contenthash | 让未变化文件长期缓存。 |
| tree shaking | 删除未使用代码。 |
| 动态导入 | 对路由、重型组件、低频功能做懒加载。 |
| CSS 抽离 | 生产环境使用独立 CSS 文件。 |
| 图片和字体优化 | 控制内联阈值，配合 CDN 和压缩。 |

长期缓存常见配置：

```js
module.exports = {
  output: {
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
  },
  optimization: {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    runtimeChunk: 'single',
  },
};
```

### 8.3 常见误区

| 误区 | 问题 |
| --- | --- |
| 拆包越多越好 | 请求数、优先级和重复加载也会影响性能。 |
| loader 越多越强 | loader 链越长，构建成本越高。 |
| source map 永远开最大 | 生产 source map 会增加构建时间和泄露源码风险。 |
| thread-loader 必然更快 | worker 通信有成本，小项目可能更慢。 |
| 只看 bundle 总体积 | 还要看首屏体积、缓存命中、加载顺序。 |

## 9. Webpack 和其他工具的差异

### 9.1 总体对比

| 工具 | 定位 | 优势 | 短板 | 适合场景 |
| --- | --- | --- | --- | --- |
| webpack | 成熟、灵活的应用 bundler | 生态最强，配置最灵活，复杂场景能力完整 | 性能相对慢，配置复杂 | 大型应用、历史项目、企业工程、微前端 |
| Vite | 现代前端开发服务器和构建工具 | 开发启动快，配置简单，框架生态好 | 复杂 webpack 迁移有成本，部分深度定制不如 webpack | 新项目、中小型应用、现代框架项目 |
| Rollup | 偏库构建的 bundler | ESM、tree shaking、库产物优秀 | 应用级复杂工程能力不如 webpack | npm 库、组件库、SDK |
| esbuild | 极快的 bundler/transformer | 速度极快，内置 TS/JSX/CSS | 插件和复杂优化能力不如 webpack | 转译、预构建、简单打包 |
| Rspack | Rust 写的 webpack 兼容 bundler | 接近 webpack 能力，性能更强，迁移成本低 | 生态兼容仍需逐项验证 | 大型 webpack 项目提速 |
| Rsbuild | 基于 Rspack 的上层构建工具 | 默认配置友好，企业应用能力强 | 生态规模不如 Vite/webpack | 想用 Rspack 但不想手写复杂配置 |
| Rolldown | Rust 写的 Rollup 兼容 bundler | 面向 Vite 下一代底层构建链路 | 仍在演进，生产迁移要验证 | Vite 未来底层、Rollup 生态提速 |
| Parcel | 零配置应用 bundler | 开箱即用，多资源内置支持 | 深度定制和企业生态不如 webpack | 小中型应用、快速原型 |
| Turbopack | Rust 写的增量 bundler | Next.js 生态深度绑定，增量构建强 | 通用生态和 webpack 兼容性有限 | Next.js 项目 |

### 9.2 Webpack vs Vite

| 维度 | webpack | Vite |
| --- | --- | --- |
| 开发模式 | 通常先 bundle 再服务应用。 | 基于原生 ESM 按需服务源码，依赖预构建。 |
| 启动速度 | 大项目冷启动可能慢。 | 通常更快，尤其是新项目。 |
| 生产构建 | webpack 自己完成完整打包。 | 传统上主要使用 Rollup，后续更多走 Rolldown。 |
| 插件生态 | loader/plugin 生态非常成熟。 | Rollup 风格插件，现代框架生态强。 |
| 配置灵活性 | 极强，复杂项目适配能力好。 | 更强调简单和约定，深度定制相对受限。 |
| 迁移成本 | 历史项目保留 webpack 成本低。 | 从 webpack 迁移可能涉及 loader/plugin 替换。 |

选择建议：

- 新 React/Vue/Svelte 项目优先看 Vite。
- 已有大型 webpack 项目不要盲目迁移，先评估 loader/plugin、拆包策略、publicPath、Module Federation 等。
- 对深度定制、历史兼容、微前端依赖很重的项目，webpack 仍然稳。

### 9.3 Webpack vs Rollup

Rollup 更适合库，webpack 更适合应用。

| 维度 | webpack | Rollup |
| --- | --- | --- |
| 核心场景 | 应用打包。 | 库打包。 |
| 代码拆分 | 应用级 splitChunks 能力强。 | 支持拆分，但应用工程能力弱一些。 |
| Tree shaking | 支持，但受模块副作用和配置影响。 | ESM tree shaking 是强项。 |
| 资源处理 | loader 生态强，处理复杂资源方便。 | 需要插件，整体偏 JS 库构建。 |
| 产物格式 | 应用产物优秀。 | ESM/CJS/UMD 库产物优秀。 |

组件库、工具库、SDK 通常优先 Rollup 或 tsup；复杂 Web 应用优先 webpack/Vite/Rspack。

### 9.4 Webpack vs esbuild

esbuild 的优势是速度，webpack 的优势是完整工程能力。

| 维度 | webpack | esbuild |
| --- | --- | --- |
| 速度 | 相对慢。 | 极快。 |
| 插件生态 | 成熟、复杂能力强。 | 插件 API 更简单，能力边界更窄。 |
| HMR | 成熟。 | 不以内置复杂 HMR 为核心。 |
| 代码拆分 | splitChunks 很强。 | 支持拆分，但精细程度有限。 |
| 适用范围 | 完整应用构建。 | 转译、压缩、依赖预构建、简单打包。 |

很多现代工具不是用 esbuild 替代整个 webpack，而是把 esbuild 用在转译、压缩、预构建等局部环节。

### 9.5 Webpack vs Rspack

Rspack 是最接近 webpack 的现代替代方向之一。它用 Rust 实现，目标是兼容 webpack API，同时显著提升构建性能。

| 维度 | webpack | Rspack |
| --- | --- | --- |
| 实现语言 | JavaScript。 | Rust。 |
| 性能 | 大型项目可能慢。 | 通常更快，利用原生性能和多线程。 |
| 兼容性 | 原生 webpack 生态。 | 兼容大部分 webpack loader/plugin，但需要验证。 |
| 配置 | webpack 原生配置。 | 接近 webpack 配置。 |
| 迁移成本 | 无迁移。 | 比迁移到 Vite/Rollup 低，但不是零成本。 |

如果一个大型项目已经深度依赖 webpack，但主要痛点是构建速度，Rspack/Rsbuild 通常比迁移到 Vite 更现实。

### 9.6 Webpack vs Rsbuild

Rsbuild 是 Rspack 的上层封装。它不是 webpack 的底层替代器，而是提供更开箱即用的应用构建体验。

| 维度 | webpack | Rsbuild |
| --- | --- | --- |
| 抽象层级 | 底层 bundler 配置。 | 上层构建工具。 |
| 默认体验 | 需要自己配置很多能力。 | 默认集成 React/Vue、CSS、资源、优化等。 |
| 底层引擎 | webpack。 | Rspack。 |
| 适合 | 高度自定义、历史项目。 | 新项目或企业项目，希望少写底层配置。 |

### 9.7 Webpack vs Parcel

Parcel 强调零配置和开箱即用，webpack 强调可配置和生态完整。

| 维度 | webpack | Parcel |
| --- | --- | --- |
| 配置 | 配置强但复杂。 | 零配置或少配置。 |
| 生态 | loader/plugin 成熟。 | 内置能力多，生态较小。 |
| 适合 | 复杂应用和企业工程。 | 快速原型、小中型项目。 |

## 10. 什么时候还应该选择 Webpack

webpack 不是最新的选择，但仍然是很多复杂工程的稳妥选择。

适合选择 webpack 的场景：

- 项目已经使用 webpack，且 loader/plugin 体系很重。
- 需要原生 Module Federation 或成熟微前端体系。
- 多入口、多页面、复杂 publicPath、复杂资源处理。
- 需要强定制构建流程。
- 依赖很多 webpack 专属插件。
- 历史项目迁移成本高，稳定性比新技术更重要。
- 团队对 webpack 熟悉，有成熟构建模板和排障经验。

不一定适合 webpack 的场景：

- 新建中小型 SPA，追求轻量和快速开发体验。
- 没有复杂定制，只需要 React/Vue 常规开发。
- 主要是组件库或工具库构建。
- 构建性能是核心瓶颈，并且可以接受迁移到 Rspack/Rsbuild/Vite。

## 11. 一个现代 Webpack 项目的推荐结构

```text
project
  ├─ public
  │  └─ index.html
  ├─ src
  │  ├─ index.tsx
  │  ├─ App.tsx
  │  ├─ routes
  │  ├─ components
  │  └─ styles
  ├─ webpack
  │  ├─ webpack.common.js
  │  ├─ webpack.dev.js
  │  └─ webpack.prod.js
  ├─ babel.config.js
  ├─ postcss.config.js
  ├─ tsconfig.json
  └─ package.json
```

开发配置关注速度和调试：

```js
module.exports = {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  devServer: {
    hot: true,
    historyApiFallback: true,
  },
};
```

生产配置关注体积和缓存：

```js
module.exports = {
  mode: 'production',
  devtool: 'hidden-source-map',
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
    },
  },
};
```

## 12. 学习 Webpack 的正确顺序

建议按这个顺序理解 webpack：

| 顺序 | 内容 |
| --- | --- |
| 1 | 理解 entry、output、loader、plugin、mode。 |
| 2 | 理解 module graph、chunk graph、bundle、runtime。 |
| 3 | 掌握 JS/TS、CSS、图片、字体等资源配置。 |
| 4 | 掌握 dev server、HMR、source map。 |
| 5 | 掌握 splitChunks、tree shaking、contenthash、缓存。 |
| 6 | 理解 loader 和 plugin 原理。 |
| 7 | 学会读 stats 和分析构建性能。 |
| 8 | 再学习 Module Federation、微前端、复杂多入口。 |

很多人学 webpack 卡住，是因为一开始就陷入配置细节。更好的方法是先抓住主线：

```text
入口 -> 依赖图 -> loader 转换 -> chunk 拆分 -> plugin 优化 -> 输出资源 -> runtime 加载
```

只要这条主线清楚，绝大多数配置都能归类到某个环节。

## 13. 总结

webpack 的本质是一个高度可扩展的模块打包平台。它通过入口构建依赖图，通过 loader 把各种资源转换成模块，通过 plugin 介入整个构建生命周期，通过 chunk 和 runtime 把模块组织成浏览器可加载的产物。

它的优势是成熟、灵活、生态完整，尤其适合复杂应用和历史项目；缺点是配置复杂、构建性能不如新一代 Rust/Go 工具。现代前端工具链里，Vite 更适合新项目和开发体验，Rollup 更适合库构建，esbuild 更适合高速转译和预构建，Rspack/Rsbuild 更适合 webpack 项目提速和现代化迁移。

因此，webpack 不应该被简单理解为“过时工具”。更准确的判断是：**小项目和新项目不一定需要 webpack，但复杂工程里 webpack 仍然是最完整、最稳妥的构建体系之一。**

## 14. 参考资料

- [webpack Concepts](https://webpack.js.org/concepts/)
- [webpack Loaders](https://webpack.js.org/concepts/loaders/)
- [webpack Plugins](https://webpack.js.org/concepts/plugins/)
- [webpack Code Splitting](https://webpack.js.org/guides/code-splitting/)
- [webpack Module Federation](https://webpack.js.org/concepts/module-federation/)
- [webpack Cache](https://webpack.js.org/configuration/cache/)
- [Vite Why](https://vite.dev/guide/why.html)
- [Rollup Introduction](https://rollupjs.org/introduction/)
- [Rspack Introduction](https://rspack.rs/guide/start/introduction)
- [esbuild](https://esbuild.github.io/)
- [Parcel Web App Guide](https://parceljs.org/getting-started/webapp/)
