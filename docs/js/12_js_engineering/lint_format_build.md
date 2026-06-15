## oxlint
Oxlint：极致性能，ESLint 兼容
Oxlint 是 Oxc 项目的一部分，基于 Rust 打造，目标是替代 ESLint。它以超快速度（50-100 倍于 ESLint） 、零配置和 ESLint 兼容性为核心优势，适合中小型项目完全替代 ESLint，或大型项目与 ESLint 结合使用。已被 Shopify、Airbnb 和 Mercedes-Benz 采用，证明其生产级可靠性。

Biome：统一 linter 和 formatter
Biome 继承自 Rome，基于 Rust，集 linter 和 formatter 于一身，目标替代 ESLint 和 Prettier。它支持多种语言（JavaScript、TypeScript、JSON、CSS 等），强调简单配置和性能，适合需要统一工具链的中小型项目。

ESLint：行业标准，生态强大
ESLint 是 JavaScript 生态的标杆，拥有丰富的插件生态和高度可定制性，但性能较慢，配置复杂，适合需要复杂规则的大型项目。

对比表格：Oxlint、Biome、ESLint
   以下表格从六个维度对比三者，突出 Oxlint 的领先优势。

| 维度 | Oxlint | Biome | ESLint |
| --- | --- | --- | --- |
| 性能 | 极致性能：50-100 倍于 ESLint，2-3 倍于 Biome。264,925 文件（10 线程）仅 22.5 秒，730 文件仅 75 毫秒。 | 比 ESLint 快 5-10 倍，171,127 行代码（2,104 文件）约 400-500 毫秒，略逊于 Oxlint。 | 单线程，730 文件耗时约 30 秒，TypeScript 规则更慢（45-60 秒）。 |
| 功能与规则 | 丰富且兼容：520+ 规则，覆盖 ESLint、typescript-eslint、React、Jest。零配置默认 99 条规则，支持 .oxlintrc.json。 | 325 条规则，支持 JavaScript、TypeScript、JSX、JSON、CSS、GraphQL，格式化兼容 Prettier 97%。无插件系统。 | 200+ 核心规则，数千插件规则，支持所有框架。配置复杂。 |
| 生态与兼容性 | ESLint 兼容：支持 oxlint-migrate 迁移，eslint-plugin-oxlint 共存。暂不支持 Vue/Svelte 模板、HTML。 | 独立生态，不兼容 ESLint，VS Code 扩展成熟。计划支持 HTML。 | 最大插件生态，支持所有场景。包体积超 100MB。 |
| 开发体验 | 零配置，错误信息清晰，部分自动修复。VS Code 扩展需优化。 | 统一配置，VS Code 集成完善，自动修复覆盖率高。 | 配置繁琐，VS Code 集成成熟，运行慢。 |
| 适用场景 | 最佳选择：中小型项目替代 ESLint，大型项目结合使用，CI 环境首选。 | 需 linter 和 formatter 集成的中小型项目，扩展性有限。 | 需高度定制的大型项目，性能敏感场景不推荐。 |
| 未来发展 | 1.0 稳定，计划支持自定义插件、Vue/Svelte 模板。 | 2.0 引入插件支持，2025 年支持 HTML、类型检查。 | ESLint 9 优化配置，性能改进有限。 |

## Biome、Oxlint、Oxfmt、Prettier、ESLint 的区别

前端代码质量工具通常可以分成三类：

| 类型 | 解决的问题 | 代表工具 |
| --- | --- | --- |
| formatter | 统一代码排版，不主要判断代码对错 | Prettier、Biome formatter、Oxfmt |
| linter | 检查潜在 bug、坏习惯、风格违规 | ESLint、Oxlint、Biome linter、Deno lint |
| type checker | 检查类型是否正确 | TypeScript tsc、vue-tsc |

Biome 是一个基于 Rust 的前端工具链，目标是把 formatter、linter 等能力整合到一个工具里。它不是单纯的格式化工具，也不是单纯的 lint 工具，而是希望用一个统一配置和统一命令，替代常见的 ESLint + Prettier 组合。它适合希望减少工具数量、追求简单配置和高性能的中小型项目。

ESLint 是 JavaScript 生态最成熟的 linter。它的核心优势是生态强：插件、规则、parser、框架支持和自定义规则都非常丰富。React、Vue、TypeScript、Node、测试框架、无障碍检查、import 规则等复杂场景，ESLint 仍然最稳。它的缺点是配置复杂、性能相对较慢，尤其是在大型 TypeScript 项目中启用类型感知规则时更明显。

Prettier 是 formatter，不是 linter。它主要负责把代码重新打印成统一格式，例如缩进、换行、引号、尾逗号等。Prettier 不关心大多数代码质量问题，也不负责判断业务逻辑是否可能出错。它的优势是成熟、稳定、生态广，长期是前端格式化事实标准。

Oxc 是一套 JavaScript/TypeScript 编译器基础设施，里面包含 parser、transformer、minifier、linter、formatter 等能力。Oxlint 是 Oxc 里的 linter，目标是用更高性能替代或补充 ESLint。Oxfmt 是 Oxc 里的 formatter，目标是提供高性能格式化能力，定位接近 Prettier。

可以这样理解：

| 工具 | 定位 | 更像替代谁 | 主要特点 |
| --- | --- | --- | --- |
| Biome | 一体化工具链 | ESLint + Prettier | 一个工具同时管理 lint、format、check |
| Oxlint | 专职 linter | ESLint | 性能强，适合大型项目加速 lint |
| Oxfmt | 专职 formatter | Prettier | 高性能格式化，适合追求格式化速度 |
| Prettier | 专职 formatter | 无 | 格式化事实标准，稳定成熟 |
| ESLint | 专职 linter | 无 | lint 生态事实标准，插件最丰富 |

实际选型可以按项目复杂度判断：

| 场景 | 推荐 |
| --- | --- |
| 新项目、希望工具少、配置简单 | Biome |
| 大型 React/Vue/Node 项目，需要丰富插件 | ESLint + Prettier + tsc |
| 已有 ESLint 体系，但 lint 速度太慢 | Oxlint + ESLint 结合使用 |
| 只想提升格式化速度 | Oxfmt 或 Biome formatter |
| TypeScript 严格项目 | 保留 tsc --noEmit，不要只依赖 lint |

除了这些，还有一些常见代码检查工具：

| 工具 | 主要用途 |
| --- | --- |
| tsc --noEmit | TypeScript 类型检查 |
| vue-tsc | Vue 单文件组件类型检查 |
| Deno lint | Deno 内置 JavaScript/TypeScript linter |
| Stylelint | CSS、SCSS、Less 等样式代码检查 |
| Knip | 检查未使用文件、exports、依赖和死代码 |
| depcheck | 检查未使用 npm 依赖 |
| dependency-cruiser | 检查模块依赖关系、分层约束、循环依赖 |
| madge | 生成依赖图，检查循环依赖 |
| Semgrep | 通用静态分析，适合安全规则和团队自定义代码模式 |
| CodeQL | 安全静态分析，偏漏洞扫描 |
| SonarQube / SonarJS | 代码质量、安全、重复代码和复杂度分析 |

一个比较稳妥的工程组合是：ESLint 负责代码质量，Prettier 负责格式化，tsc 负责类型检查，Stylelint 负责样式检查，Knip 负责死代码和无用依赖检查。如果项目追求轻量和速度，可以用 Biome 替代 ESLint + Prettier 的一部分能力；如果项目很大且 lint 成本高，可以评估 Oxlint；如果只想优化格式化速度，可以评估 Oxfmt。




https://www.zhihu.com/search?type=content&q=%E5%B7%B2%E7%BB%8F%E6%9C%89vite%E4%BA%86%EF%BC%8C%E5%AD%97%E8%8A%82%E4%B8%BA%E5%95%A5%E5%8F%88%E6%90%9E%E4%BA%86%E4%B8%80%E5%A5%97rsbuild

## 为什么有 Vite 了，字节团队还推出 Rsbuild

Vite 和 Rsbuild 并不是完全相同定位的工具。Vite 更强调现代前端开发体验，开发阶段利用浏览器原生 ESM 和 esbuild 做依赖预构建，生产构建主要交给 Rollup。它非常适合新项目、中小型应用、常规 React/Vue SPA，以及希望配置轻量、启动快、开发体验好的场景。

Rsbuild 则是字节 Web Infra 团队基于 Rspack 推出的上层构建工具。它的重点不是简单复刻 Vite，而是解决大型工程、历史 webpack 项目迁移、企业级构建一致性和性能问题。Rspack 是 Rust 写的 webpack 兼容型打包器，Rsbuild 则在 Rspack 之上提供更易用的工程化封装。

核心差异可以概括为：

| 维度 | Vite | Rsbuild |
| --- | --- | --- |
| 底层路线 | 开发阶段偏原生 ESM，生产阶段 Rollup 打包 | 基于 Rspack，开发和生产都围绕 bundle 架构 |
| 主要优势 | 开发体验轻快，生态成熟，配置简单 | 大型项目性能、webpack 迁移、企业工程能力 |
| 迁移成本 | 从 webpack 迁移时可能需要改动配置、插件和构建模型 | 更贴近 webpack 生态，适合承接历史大型项目 |
| 适用场景 | 新项目、中小型应用、常规 SPA | 大型前端工程、多入口、复杂资源处理、模块联邦、统一工程规范 |
| 工程定位 | 更像现代前端开发服务器和构建工具 | 更像企业级构建工具链封装 |

字节推出 Rsbuild 的背景，是内部存在大量复杂前端工程和历史 webpack 项目。对这类团队来说，核心问题不只是“启动要快”，还包括构建一致性、插件兼容、复杂工程能力、迁移成本、CI 性能和统一规范。Vite 在很多场景已经足够优秀，但它并不能完全覆盖所有大型企业工程的需求。

所以，Rsbuild 的出现不是因为 Vite 不好，而是前端构建工具在不同工程规模和历史包袱下产生了不同路线：Vite 更适合轻量现代开发体验，Rsbuild 更适合大型工程和 webpack 体系升级。

## Vite、Webpack、Rspack、Rsbuild 的定位

这几个工具容易混在一起，因为它们都和“构建”有关，但层级不完全一样。

| 工具 | 定位 | 核心特点 |
| --- | --- | --- |
| Vite | 开发服务器 + 构建工具封装 | 开发体验好，dev server 快，生产构建长期基于 Rollup |
| Webpack | 老牌 JavaScript bundler | 生态极强，loader/plugin 丰富，历史项目大量使用 |
| Rspack | webpack 兼容型高性能 bundler | Rust 实现，目标是兼容 webpack 生态并提升构建性能 |
| Rsbuild | 基于 Rspack 的上层构建工具 | 提供更简单的配置和工程化封装，适合大型项目和 webpack 迁移 |

可以这样理解它们的层级：

```text
Webpack / Rspack / Rollup / Rolldown / esbuild：偏底层 bundler 或构建引擎
Vite / Rsbuild：偏上层构建工具，负责配置、开发服务、插件、框架集成
```

Vite 的核心价值是开发体验。它开发阶段依赖浏览器原生 ESM 和 esbuild 做依赖预构建，生产构建长期使用 Rollup。开发者使用的是 Vite 的命令、配置和插件系统，而不是直接操作 esbuild 或 Rollup 的全部细节。

Webpack 是更早期的通用 bundler，能力非常完整，生态非常成熟。它适合复杂历史项目、深度定制构建链路、依赖大量 loader/plugin 的项目。但它的配置复杂，性能也逐渐成为大型项目的痛点。

Rspack 可以理解为“高性能 webpack 兼容 bundler”。它不是 Vite 的替代品，而是更接近 Webpack 的替代品：尽量保持 webpack 生态和配置迁移成本可控，同时用 Rust 实现提升性能。

Rsbuild 则是 Rspack 之上的上层工具。直接使用 Rspack 更像直接配置 Webpack；使用 Rsbuild 更像使用 Vite 这类上层构建工具。它帮你封装常见配置、框架插件、资源处理、HTML、CSS、产物优化等能力。

选型可以按项目背景判断：

| 场景 | 更适合 |
| --- | --- |
| 新项目、希望开发体验轻量 | Vite |
| 历史 webpack 项目，暂时不想大迁移 | Webpack |
| webpack 项目性能压力大，希望低成本提速 | Rspack |
| 大型项目，希望基于 Rspack 获得更简单的工程配置 | Rsbuild |
| 库构建，重视 ESM 和 tree-shaking | Rollup / tsup / tsdown |

### Vite 解决的是什么问题

Vite 的核心不是“发明一个新 bundler”，而是重新设计开发阶段的体验。传统 Webpack 开发服务器通常需要先把应用依赖图打包一遍，再启动页面。项目越大，启动越慢。Vite 的思路是：开发阶段尽量利用浏览器原生 ESM，让源码按需加载；第三方依赖则用 esbuild 预构建成更适合浏览器加载的格式。

所以 Vite 的开发阶段可以粗略理解为：

```text
源码模块：浏览器按需请求，Vite 即时转换
node_modules 依赖：esbuild 预构建
HMR：只更新变更模块，避免整包重建
```

生产构建时，Vite 不是简单把开发阶段的原生 ESM 请求搬到线上，而是调用 Rollup 做正式打包，输出 chunk、assets、sourcemap 等产物。因此 Vite 更像一个上层工具：它把 dev server、HMR、插件系统、依赖预构建、生产构建封装到统一体验里。

### Webpack 为什么仍然重要

Webpack 是历史最深、生态最厚的 bundler。很多复杂项目里，构建逻辑不是“把 TS 转 JS”这么简单，而是包含：

- 各种 loader：处理 CSS、Less、Sass、图片、字体、SVG、Markdown、i18n 文件等。
- 各种 plugin：HTML 注入、环境变量、模块联邦、构建分析、资源上传、产物替换等。
- 复杂拆包：按业务、路由、运行时、第三方依赖拆 chunk。
- 历史兼容：老浏览器、老模块格式、老内部平台。

这也是为什么大型公司不可能简单说“Vite 更快，所以全部项目马上换 Vite”。大量 Webpack 项目真正的成本在自定义 loader/plugin、内部构建平台、部署链路、监控和历史约定上。

### Rspack 为什么出现

Rspack 的目标不是复刻 Vite 的开发模式，而是解决 Webpack 体系的性能问题。它尽量兼容 Webpack 的配置、loader 和 plugin 生态，同时把核心编译、依赖图分析、打包等部分用 Rust 重写，提高大型项目的构建速度。

可以这样理解：

```text
Vite：换一种开发模式，提升现代项目开发体验
Rspack：保留 webpack 模型，提升 webpack 体系性能
```

所以 Rspack 对已有 Webpack 项目很有吸引力：迁移成本通常比迁到 Vite 更可控，尤其是有复杂 loader/plugin、Module Federation、大量历史配置的项目。

### Rsbuild 和 Rspack 的区别

Rspack 更像 Webpack 这一层：偏 bundler 和构建引擎。Rsbuild 更像 Vite 这一层：偏上层工程工具。直接用 Rspack 时，你还需要自己组织大量配置；用 Rsbuild 时，它帮你把 React/Vue、CSS、HTML、静态资源、产物优化、开发服务器等常见能力封装好。

可以用这个类比记：

```text
Webpack : Rspack ≈ 老牌 bundler : 高性能兼容 bundler
Vite : Rsbuild ≈ 上层构建工具 : 上层构建工具
Rollup : Rolldown ≈ 老牌 ESM bundler : Rust 高性能 Rollup 方向 bundler
```

## Rolldown 是什么，和 Vite 是什么关系

[Rolldown](https://rolldown.rs/) 是一个基于 Rust 的 JavaScript/TypeScript bundler，目标是提供接近 Rollup 的 API 和插件兼容性，同时具备接近 esbuild 的性能和内置能力。它不是一个完整的前端开发框架，也不是 Vite 的替代品，而是 Vite 未来底层构建引擎的重要组成部分。

Rolldown 的定位可以这样理解：

| 维度 | Rolldown |
| --- | --- |
| 工具类型 | JavaScript/TypeScript bundler |
| 实现语言 | Rust |
| 核心目标 | 兼容 Rollup 生态，同时提升构建、转换和打包性能 |
| 主要能力 | 模块打包、依赖预构建、代码转换、chunk 拆分、CommonJS 处理、压缩等 |
| 生态关系 | 属于 VoidZero / Oxc / Vite 相关的下一代前端工具链方向 |

Vite 当前主要由两类底层工具支撑：开发阶段依赖 esbuild 做依赖预构建，生产构建阶段依赖 Rollup 打包。这个组合已经很成熟，但也带来一个问题：开发和生产阶段使用不同 bundler，内部行为、插件适配、性能瓶颈和维护成本都不完全一致。

Rolldown 的目标，就是让 Vite 的底层构建链路更统一：

| Vite 当前体系 | Rolldown 方向 |
| --- | --- |
| 开发阶段依赖 esbuild 做依赖预构建 | 未来由 Rolldown 接管更多 optimizer 能力 |
| 生产构建依赖 Rollup | 未来由 Rolldown 接管更多 build 能力 |
| 部分转换、压缩依赖 esbuild | 未来更多交给 Oxc / Rolldown 这一套 Rust 工具链 |
| Vite 负责 dev server、HMR、插件系统、配置和框架集成 | Vite 仍然负责这些上层开发体验能力 |

所以 Rolldown 和 Vite 的关系不是“谁替代谁”，而是：

```text
现在：Vite = dev server + Rollup + esbuild
未来：Vite = dev server + Rolldown + Oxc
```

Rolldown 未来不会替代 Vite。更准确地说，它会替代 Vite 内部的一部分底层构建引擎。开发者日常仍然使用 Vite 的命令、配置、插件和框架集成：

```bash
npm create vite
npm run dev
npm run build
```

只是未来这些命令底层可能不再主要依赖 Rollup + esbuild，而是更多由 Rolldown / Oxc 驱动。

目前可以通过 [rolldown-vite](https://vite.dev/guide/rolldown) 体验 Rolldown 版本的 Vite，但它仍然属于实验性集成，可能存在插件兼容差异和 breaking changes。更适合在中大型项目里验证构建速度、插件兼容性和产物差异，不建议在没有充分测试的情况下直接替换生产构建链路。

总结：Rolldown 是 Vite 未来提速和统一底层构建链路的关键工具，但不是 Vite 的替代品。它更像 Vite 底层的新发动机；对开发者来说，未来更可能是“继续使用 Vite，但 Vite 变得更快、更统一”。

## 其他 bundler：Turbopack、Parcel、Farm

除了 Webpack、Rspack、Rollup、Rolldown、esbuild，前端生态里还有一些常见 bundler。它们都和“打包”有关，但目标用户和生态绑定程度不一样。

| 工具 | 实现/生态 | 定位 | 适合场景 |
| --- | --- | --- | --- |
| Turbopack | Rust / Vercel / Next.js | 面向 Next.js 生态的高性能 bundler | Next.js 项目，尤其是希望提升开发构建性能 |
| Parcel | JavaScript/Rust 混合能力 | 零配置 bundler | 小到中型项目，想少写配置快速启动 |
| Farm | Rust | 高性能 Web 构建工具 | 希望尝试 Rust 构建链、追求构建速度的项目 |

### Turbopack

Turbopack 是 Vercel 推出的高性能 bundler，和 Next.js 生态绑定很深。它的目标不是成为一个“所有框架都优先使用的通用 Rollup 替代品”，而是优先服务 Next.js 的开发和构建体验。

可以这样理解：

```text
Next.js 传统构建：Webpack
Next.js 新方向：Turbopack
```

Turbopack 的核心价值是提升大型 Next.js 项目的开发反馈速度，尤其是启动、增量编译和 HMR。它更适合已经在 Next.js 体系里的项目；如果你不是 Next.js 项目，通常不会优先考虑 Turbopack。

### Parcel

Parcel 的特点是零配置。它希望开发者少写 bundler 配置，直接给入口文件，就能处理 JavaScript、TypeScript、CSS、图片、HTML 等资源。

它的心智模型更接近：

```text
入口文件 -> Parcel 自动识别依赖和资源类型 -> 输出可运行产物
```

Parcel 适合快速原型、小到中型项目、静态站点、简单应用。它的优势是上手成本低；劣势是当项目需要深度定制构建细节时，生态和控制感通常不如 Webpack/Rollup/Vite 组合。

### Farm

Farm 是一个基于 Rust 的高性能 Web 构建工具，目标是提供快速的启动、编译和构建体验。它和 Rspack、Rolldown 一样，都属于“用 Rust 重做前端构建基础设施”的方向。

可以这样对比：

| 工具 | 更接近谁 | 主要记忆点 |
| --- | --- | --- |
| Rspack | Webpack | webpack 兼容、高性能迁移 |
| Rolldown | Rollup | Rollup 兼容方向，未来服务 Vite 底层 |
| Turbopack | Next.js/Webpack 体系 | Vercel/Next.js 生态优先 |
| Farm | Vite/Rspack 之间的高性能构建工具 | Rust、高性能、Web 构建链 |
| Parcel | 独立零配置 bundler | 少配置，自动化 |

这类工具选型时要看两件事：第一，生态是不是和你的项目匹配；第二，插件、框架、部署链路是否成熟。高性能很重要，但如果插件生态和团队经验跟不上，迁移成本可能会抵消性能收益。

## tsup、tsc、Babel、SWC、esbuild、Rollup 的定位

这几个名字经常一起出现，但它们不是同一层的东西。可以先用一句话区分：

| 工具 | 类型 | 核心作用 | 是否类型检查 | 是否打包 |
| --- | --- | --- | --- | --- |
| tsc | TypeScript 官方编译器 | 类型检查、生成 JS、生成 d.ts | 是 | 否 |
| Babel | JavaScript 编译器/转换器 | 把新语法、JSX、TS 语法转成目标 JS | 否 | 弱，不是主定位 |
| SWC | 高性能编译/转换器 | 把 TS/JSX/新 JS 语法快速转换成目标 JS | 否 | 弱，不是主定位 |
| esbuild | 高性能转换器和 bundler | 快速转译、压缩、简单打包 | 否 | 是 |
| Rollup | bundler | 把多个模块打包成一个或多个产物 | 否 | 是 |
| tsup | 库构建工具 | 基于 esbuild 封装 TS/JS 库打包流程 | 通常不负责完整类型检查 | 是 |

### tsc 是什么

`tsc` 是 TypeScript 官方编译器。它最核心的价值是类型系统，而不是构建速度。

它能做三件事：

| 能力 | 说明 |
| --- | --- |
| 类型检查 | 检查类型错误，最常用命令是 `tsc --noEmit` |
| 编译 JS | 把 TypeScript 编译成 JavaScript |
| 生成声明文件 | 生成 `.d.ts`，给库消费者提供类型 |

现代前端项目里，`tsc` 经常不负责最终 JS 构建，而是专门负责类型检查：

```bash
tsc --noEmit
```

如果是写 npm 库，还经常让 `tsc` 只生成类型声明：

```bash
tsc --emitDeclarationOnly
```

原因是：`tsc` 的类型检查最权威，但它不是最快的 JS 转换器，也不是 bundler。实际项目里常见组合是：

```text
tsc 负责类型检查和 d.ts
esbuild / SWC / tsup / Vite / Rollup 负责 JS 转换和打包
```

### SWC 是什么，定位到底是什么

SWC 是用 Rust 写的高性能 JavaScript/TypeScript 编译工具链。它最容易让人困惑，因为它看起来像 Babel、像 tsc、也像 esbuild，但它真正的主定位是“高速语法转换器”。

更准确地说，SWC 主要做这些事：

| 能力 | 说明 |
| --- | --- |
| TS 转 JS | 去掉类型语法，把 TypeScript 转成 JavaScript |
| JSX 转换 | 把 JSX 转成 React runtime 需要的 JS |
| 新语法降级 | 把较新的 JavaScript 语法转换成目标环境能运行的代码 |
| 代码压缩 | 可以做 minify |
| 作为底层引擎 | 被 Next.js、Rspack 等工具用作转换能力的一部分 |

SWC 不等于 tsc。它能“转换 TypeScript”，但不负责完整 TypeScript 类型检查。也就是说，下面这种代码如果类型错了，SWC 的主要任务仍然是把语法转掉，而不是像 `tsc` 一样给出完整类型诊断：

```ts
const count: number = "1";
```

所以 SWC 的定位更接近：

```text
SWC ≈ 更快的 Babel / 高性能语法转换器
SWC ≠ TypeScript 类型检查器
SWC ≠ 完整应用构建工具
```

它和 Babel 的关系更接近：都负责语法转换、JSX 转换、插件转换。区别是 SWC 用 Rust 实现，性能通常更强。它和 `tsc` 的关系是：都能处理 TypeScript 文件，但 `tsc` 的核心价值是类型检查，SWC 的核心价值是快速转换。

实际项目中比较合理的搭配是：

```text
SWC 负责快速转译
tsc --noEmit 负责类型检查
Rollup / Vite / Rspack / Webpack 负责模块打包和开发服务
```

### Babel 是什么

Babel 是 JavaScript 生态里最经典的编译器/转换器。它的主要工作是把新版本 JavaScript、JSX、TypeScript 语法，以及各种实验性语法，转换成目标环境可运行的代码。

Babel 的核心不是类型检查，也不是打包，而是“语法转换 + 插件系统”。

它常见能力包括：

| 能力 | 说明 |
| --- | --- |
| 语法降级 | 把较新的 JavaScript 语法转成旧环境可运行的代码 |
| JSX 转换 | 把 JSX 转成 React 运行时代码 |
| TypeScript 语法移除 | 可以把 TS 语法转掉，但不做完整类型检查 |
| 插件系统 | 生态最强，几乎所有前端构建场景都能接 |
| Polyfill 配合 | 常和 core-js / preset-env 一起处理运行时能力 |

Babel 的地位更像“前端转换层的老牌标准件”。很多历史项目、Webpack 项目、React 项目、库项目都依赖 Babel 的插件生态。它的缺点是速度通常不如 SWC 和 esbuild，但它的生态、兼容性和插件成熟度仍然非常强。

它和 SWC、esbuild 的关系可以这样理解：

| 维度 | Babel | SWC | esbuild |
| --- | --- | --- | --- |
| 实现语言 | JavaScript | Rust | Go |
| 主定位 | 通用语法转换器 | 高性能语法转换器 | 高性能转换器 + bundler |
| 插件生态 | 最强、最成熟 | 还在成长 | 相对克制 |
| 速度 | 相对较慢 | 很快 | 很快 |
| bundling | 不是主定位 | 不是主定位 | 内置 bundling 很常用 |
| 类型检查 | 不做 | 不做 | 不做 |

所以 Babel 最常见的角色不是“单独拿来打包应用”，而是和 Webpack、Rollup、Vite、tsup、Jest、ESLint 等工具配合，专门负责语法转换这一层。

### esbuild 是什么

esbuild 是用 Go 写的高性能 JavaScript/TypeScript 工具。它既能做语法转换，也能做压缩，还能做 bundling。它的核心特点是快，所以经常被上层工具拿来做底层构建能力。

esbuild 常见能力包括：

| 能力 | 说明 |
| --- | --- |
| TS 转 JS | 去掉 TypeScript 类型语法，输出 JavaScript |
| JSX 转换 | 支持 React JSX 转换 |
| 新语法降级 | 按 target 把部分新语法转成旧环境可运行的代码 |
| bundling | 能从入口出发打包依赖模块 |
| minify | 支持 JS/CSS 压缩 |
| dev 构建加速 | 被 Vite、tsup 等工具用于依赖预构建或库构建 |

esbuild 和 SWC 很像，二者都不是 TypeScript 类型检查器，都更强调“快速把代码转成可运行的 JavaScript”。主要区别在于：

| 维度 | esbuild | SWC |
| --- | --- | --- |
| 实现语言 | Go | Rust |
| 主要定位 | 高性能转译、压缩、打包工具 | 高性能编译/转换工具链 |
| bundling | 内置 bundler 能力比较常用 | 有 bundling 能力，但不是最常见主场景 |
| 常见使用方式 | Vite 依赖预构建、tsup 底层、脚本构建、小型打包 | Next.js 转译/压缩、Rspack 转换链路、替代 Babel |
| 类型检查 | 不做完整类型检查 | 不做完整类型检查 |

esbuild 和 Rollup 的差异也很关键：

| 维度 | esbuild | Rollup |
| --- | --- | --- |
| 核心优势 | 极快 | 产物控制细、插件生态成熟、tree-shaking 强 |
| 适合 | 快速转译、快速打包、开发期预构建、库构建加速 | npm 库、复杂产物、多格式输出、精细 chunk 控制 |
| 典型位置 | 底层加速器 | 正式 bundler |
| 生态成熟度 | 插件生态相对克制 | 插件生态非常成熟 |

所以 esbuild 的定位可以这样记：

```text
esbuild ≈ 高速转译器 + 高速压缩器 + 简洁 bundler
esbuild ≠ TypeScript 类型检查器
esbuild ≠ Rollup 这种精细产物控制型 bundler 的完全替代品
```

Vite 里也能看到它的位置：开发阶段，Vite 用 esbuild 做依赖预构建和部分转换；生产构建则长期由 Rollup 负责。也就是说，esbuild 更像 Vite 工具链里的“速度组件”，不是 Vite 的全部构建系统。

### Rollup 是什么

Rollup 是一个 JavaScript bundler。它的核心工作是从入口文件出发，分析 `import` / `export` 依赖关系，把多个模块打包成最终产物。

Rollup 的强项是：

| 能力 | 说明 |
| --- | --- |
| ESM 优先 | 对 ES Module 支持非常好 |
| tree-shaking | 能较好移除未使用代码 |
| 库构建 | 很适合输出 ESM、CJS、IIFE、UMD 等库产物 |
| 插件生态 | 插件成熟，Vite 生产构建长期基于 Rollup |
| 产物控制 | 对 chunk、external、output format 控制细 |

Rollup 不做 TypeScript 类型检查。它可以通过插件处理 TypeScript、Babel、SWC、CSS、图片等资源，但这些能力通常来自插件，不是 Rollup 类型系统本身。

Rollup 更适合这些场景：

- npm 库构建，需要输出 ESM / CJS / UMD。
- 很看重 tree-shaking 和产物结构。
- 需要精细控制 external、chunk、banner、footer、output 格式。
- 使用 Vite 时，生产构建底层就是 Rollup 体系。

### tsup 是什么

`tsup` 是一个面向 TypeScript/JavaScript 库的构建工具，底层主要基于 esbuild，目标是用很少配置完成 npm 包构建。

它常见能力包括：

| 能力 | 说明 |
| --- | --- |
| TS/JS 打包 | 快速把源码打成 ESM、CJS 等格式 |
| 多入口 | 支持多个 entry |
| d.ts | 支持生成类型声明 |
| watch | 支持开发时监听构建 |
| minify | 支持压缩 |
| external | 可以把依赖排除在 bundle 外 |

`tsup` 的典型配置很短：

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true
});
```

它适合写 npm 库、小型工具包、SDK、Node 工具，而不是复杂 Web 应用。复杂 Web 应用更常用 Vite、Rsbuild、Webpack、Rspack 这类上层工具。

需要注意：`tsup` 的 JS 构建很快，但不要把它当成完整类型检查替代品。稳妥做法仍然是单独跑：

```bash
tsc --noEmit
```

### 它们在一条构建链路里怎么配合

如果是一个 TypeScript 应用，常见链路是：

```text
源码 .ts/.tsx
  -> SWC / esbuild / Babel 做快速语法转换
  -> Vite / Rsbuild / Webpack / Rollup 做打包和开发服务
  -> tsc --noEmit 单独做类型检查
```

如果是一个 npm 库，常见链路是：

```text
源码 .ts
  -> tsc 生成 .d.ts 或检查类型
  -> tsup / Rollup 打包 JS 产物
```

更具体地说：

| 需求 | 常见选择 |
| --- | --- |
| 只检查 TypeScript 类型 | tsc --noEmit |
| 生成类型声明 .d.ts | tsc --emitDeclarationOnly 或 tsup dts |
| 把 JS/TS 语法转成目标代码 | Babel / SWC / esbuild |
| 快速把 TS/JSX 转 JS | SWC / esbuild |
| 快速压缩 JS/CSS | esbuild / SWC |
| 简单快速打包 | esbuild |
| 构建 npm 库 | tsup 或 Rollup |
| 构建复杂前端应用 | Vite / Rsbuild / Webpack / Rspack |
| 精细控制库产物 | Rollup |

一句话总结：

```text
tsc 管类型，Babel/SWC 管语法转换，esbuild 管高速转换/压缩/简单打包，Rollup 管精细打包，tsup 是库构建封装。
```

## 库构建工具对比

如果要发布 npm 包，通常不需要直接从零配置 Rollup、esbuild 或 tsc，而是会使用库构建工具。它们的目标是把 TypeScript/JavaScript 源码打成适合发布的 ESM、CJS、类型声明和 sourcemap。

| 工具 | 底层/生态 | 适合场景 | 特点 |
| --- | --- | --- | --- |
| tsup | esbuild | 普通 TS/JS 库、Node 工具、SDK | 配置少，速度快，使用广 |
| unbuild | UnJS / Nuxt 生态 | Nuxt、Nitro、UnJS 相关包 | 适合多格式库产物和框架生态包 |
| tsdown | Rolldown | 新项目、希望跟进 Rolldown 生态 | 定位类似 tsup，但底层走 Rolldown 方向 |
| pkgroll | Rollup | 小型库、希望配置极简 | 更轻量，适合简单 package |
| microbundle | Rollup | 传统小型 npm 库 | 零配置思路，历史较久 |
| Rollup | Rollup | 需要精细控制产物的库 | 最灵活，但配置成本更高 |

这些工具和 `tsc` 的关系要分清楚：库构建工具负责 JS 产物，`tsc` 负责类型检查和类型声明更可靠。很多项目会这样组合：

```text
tsc --noEmit       # 检查类型
tsup / tsdown      # 构建 JS 和 d.ts
```

如果你的库很简单，`tsup` 通常足够。如果你需要非常精细地控制 external、chunk、banner、输出格式和插件，直接用 Rollup 更合适。如果项目已经在 Nuxt/UnJS 生态里，`unbuild` 更自然。如果想跟进 Vite/Rolldown 的新工具链，可以关注 `tsdown`。

### 库构建和应用构建的差异

库构建和应用构建的目标不一样。应用构建面向浏览器运行，重点是页面加载、资源拆分、缓存、路由、CSS 和部署；库构建面向其他开发者消费，重点是模块格式、类型声明、external、tree-shaking 和 package exports。

| 维度 | 应用构建 | 库构建 |
| --- | --- | --- |
| 消费者 | 浏览器用户 | 其他项目/开发者 |
| 入口 | 通常是 HTML 或应用入口 | 通常是 `src/index.ts` |
| 输出 | HTML、JS、CSS、图片、字体等静态资源 | ESM、CJS、d.ts、sourcemap |
| 依赖处理 | 多数依赖会被打进 bundle | peer dependency 通常 external |
| 关注点 | 首屏、懒加载、缓存、部署路径 | 类型、模块格式、tree-shaking、exports |

这也是为什么 Vite 很适合应用，但写 npm 库时很多人会用 tsup、Rollup、tsdown 这类工具。它们更关注 package 产物，而不是页面开发服务。

### tsup 为什么常见

`tsup` 的优势是简单。很多库只需要下面这些能力：

- 一个或多个入口。
- 同时输出 ESM 和 CJS。
- 生成 `.d.ts`。
- 生成 sourcemap。
- 把 React、Vue 等依赖 external。
- watch 模式方便本地开发。

这类需求用 Rollup 可以做，但配置会更长。`tsup` 把常见选择收敛成少量配置，所以很适合普通工具库、SDK、Node 包。

### unbuild 适合什么

`unbuild` 常见于 Nuxt、Nitro、UnJS 生态。它适合构建框架生态里的包，尤其是需要同时兼顾 Node、ESM、CJS、类型声明、stub 开发模式等场景。如果项目本来就在 Nuxt/UnJS 周边，unbuild 的生态一致性会更好。

### tsdown 和 Rolldown 的关系

`tsdown` 可以理解为 Rolldown 生态里的库构建工具，定位上接近 tsup：让开发者用较少配置构建 TypeScript 库。区别是 tsup 底层主要基于 esbuild，而 tsdown 跟随 Rolldown 方向。随着 Vite/Rolldown/Oxc 这条工具链成熟，tsdown 这类工具的意义会更明显。

### 什么时候直接用 Rollup

如果库产物需要非常细的控制，直接用 Rollup 仍然合理。例如：

- 需要复杂插件链。
- 需要自定义 chunk 拆分。
- 需要精细控制 external。
- 需要输出 banner/footer。
- 需要兼容特殊运行环境。
- 需要产物结构长期稳定，不能被上层工具隐藏太多细节。

简单说：`tsup`、`tsdown` 是省配置；Rollup 是要控制权。

## 构建产物基础概念

理解构建工具之前，要先理解它们最终在生产什么。很多工具差异，本质上是对产物格式、模块关系和运行环境的处理方式不同。

| 概念 | 含义 | 为什么重要 |
| --- | --- | --- |
| ESM | 基于 `import` / `export` 的标准模块格式 | 现代浏览器、现代 Node、tree-shaking 的基础 |
| CJS | CommonJS，基于 `require` / `module.exports` | 老 Node 生态大量使用 |
| UMD | 同时兼容浏览器全局变量、AMD、CJS 的格式 | 老库或 CDN 场景可能需要 |
| IIFE | 立即执行函数格式 | 适合直接用 `<script>` 引入 |
| bundle | 把多个模块合并后的产物 | 减少模块请求，方便发布和部署 |
| chunk | bundle 拆分后的代码块 | 用于懒加载、缓存优化、按需加载 |
| tree-shaking | 删除没有被使用的代码 | 减小产物体积 |
| external | 构建时不打进包里的外部依赖 | npm 库常用，避免把 React、Vue 等依赖打进库里 |
| target | 目标运行环境，例如 `es2018`、`es2020`、`chrome100` | 决定语法是否需要降级 |
| polyfill | 补齐运行时缺失的 API | 语法转换不能替代所有运行时能力 |
| sourcemap | 产物代码到源码的映射 | 方便线上调试和错误定位 |
| d.ts | TypeScript 类型声明文件 | npm 库消费者获得类型提示的关键 |
| sideEffects | 标记模块是否有副作用 | 影响 bundler 是否能安全 tree-shaking |

### ESM 和 CJS

ESM 是现代 JavaScript 标准模块系统，语法是 `import` / `export`。它的优势是静态结构清晰，bundler 可以在编译阶段分析依赖关系，因此更适合 tree-shaking。

```ts
import { add } from "./math";

export function sum(a: number, b: number) {
  return add(a, b);
}
```

CJS 是 Node.js 早期主流模块系统，语法是 `require` / `module.exports`。它更动态，历史包袱也更多。

```js
const { add } = require("./math");

module.exports.sum = function sum(a, b) {
  return add(a, b);
};
```

现代 npm 库经常同时发 ESM 和 CJS：

```text
ESM 给现代 bundler、浏览器、现代 Node 使用
CJS 给老 Node 项目或历史工具链使用
```

### bundle 和 chunk

`bundle` 是打包后的整体产物，`chunk` 是 bundle 被拆分后的代码块。应用构建里，chunk 很重要，因为它直接影响加载性能。

例如一个后台系统可能会被拆成：

```text
assets/
  index.js           # 应用入口
  vendor-react.js    # React 相关依赖
  vendor-chart.js    # 图表库
  page-dashboard.js  # dashboard 路由懒加载
  page-settings.js   # settings 路由懒加载
```

这样用户第一次打开页面时，不一定要下载所有页面代码。路由切换时，再加载对应 chunk。

### tree-shaking 为什么依赖代码写法

tree-shaking 的前提是 bundler 能静态判断哪些代码没有被使用。ESM 的静态结构更适合分析，但代码写法也很关键。

更容易 tree-shaking：

```ts
export function add(a: number, b: number) {
  return a + b;
}

export function multiply(a: number, b: number) {
  return a * b;
}
```

不利于 tree-shaking：

```ts
const utils = {
  add(a: number, b: number) {
    return a + b;
  },
  multiply(a: number, b: number) {
    return a * b;
  }
};

export default utils;
```

如果消费者只用 `add`，前一种写法更容易让 bundler 删除 `multiply`。

### external 和 peerDependencies

库构建里，`external` 非常重要。假设你写了一个 React 组件库，如果把 React 打进你的库里，使用方项目可能出现两份 React，轻则体积变大，重则 hooks 报错。

常见做法是：

```json
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

然后构建时把它们 external：

```ts
export default {
  external: ["react", "react-dom"]
};
```

意思是：开发和测试时本库可以安装 React，但最终产物不把 React 打进去，由使用方项目提供。

### target 和 polyfill

`target` 控制语法转换目标，例如：

```text
target: "es2018"
target: "es2020"
target: "chrome100"
```

但语法转换不等于 API 补齐。比如可选链 `obj?.name` 是语法，可以被 Babel/SWC/esbuild 转换；但 `Promise`、`Map`、`Array.prototype.includes` 是运行时 API，老环境没有时需要 polyfill。

```text
语法问题：靠 Babel / SWC / esbuild 转换
API 问题：靠 polyfill 或放弃支持老环境
```

### sourcemap 的作用

线上产物通常会被压缩，变量名和行号都变了。sourcemap 用来把线上错误映射回源码位置。没有 sourcemap，线上报错可能只能看到：

```text
TypeError: Cannot read properties of undefined
at app.8f3a1c.js:1:23891
```

有 sourcemap 后，监控平台可以映射到：

```text
src/pages/user/Profile.tsx:42:18
```

应用项目通常会生成 sourcemap，但是否上传到错误监控平台、是否公开给浏览器访问，要根据安全策略决定。

几个常见误区：

- `target` 只决定语法降级，不等于自动补所有 API。比如 `Promise`、`Array.prototype.includes` 这类能力可能需要 polyfill。
- `Babel`、`SWC`、`esbuild` 能转换 TypeScript 语法，但不等于做 TypeScript 类型检查。
- `ESM` 更利于 tree-shaking，但前提是代码和依赖本身也要写得适合静态分析。
- npm 库通常不应该把 `react`、`vue` 这类 peer dependency 打进 bundle，而是通过 `external` 排除。
- `d.ts` 只是类型声明，不是运行时代码。发布 TS 库时，JS 产物和 `.d.ts` 都要考虑。

一个比较标准的库产物结构可能长这样：

```text
dist/
  index.mjs       # ESM 产物
  index.cjs       # CJS 产物
  index.d.ts      # TypeScript 类型声明
  index.mjs.map   # sourcemap
  index.cjs.map   # sourcemap
```

对应的 `package.json` 通常会声明入口：

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

这也是为什么库构建比应用构建更在意 ESM/CJS、external、types 和 exports；应用构建更在意路由、资源、CSS、chunk 拆分、缓存和部署。

## CSS 构建链：PostCSS、Sass、Less、Tailwind CSS、Lightning CSS

前端构建不只有 JavaScript。真实项目里，CSS 也要经历预处理、转换、兼容性处理、压缩、按需生成和资源引用处理。很多构建工具看起来是 JS 工具，但它们最终都要接入 CSS 构建链。

| 工具 | 类型 | 主要作用 | 常见位置 |
| --- | --- | --- | --- |
| Sass | CSS 预处理器 | 提供变量、嵌套、mixin、函数等能力 | 写 CSS 之前的预处理 |
| Less | CSS 预处理器 | 类似 Sass，常见于 Ant Design 等历史生态 | 写 CSS 之前的预处理 |
| PostCSS | CSS 转换平台 | 通过插件转换 CSS，例如 autoprefixer | CSS 编译后的转换层 |
| Tailwind CSS | 原子化 CSS 框架 | 根据 class 生成所需 CSS | 应用样式体系 |
| Lightning CSS | 高性能 CSS 转换/压缩工具 | 语法转换、prefix、minify | 构建工具底层优化 |

### Sass 和 Less

Sass、Less 都是 CSS 预处理器。它们解决的是原生 CSS 早期表达能力不足的问题，例如变量、嵌套、mixin、函数、拆文件组织等。

示例：

```scss
$primary: #1677ff;

.button {
  color: $primary;

  &:hover {
    color: darken($primary, 10%);
  }
}
```

它们的输出仍然是普通 CSS：

```css
.button {
  color: #1677ff;
}

.button:hover {
  color: #0f5ec7;
}
```

所以 Sass/Less 的定位不是 bundler，也不是框架，而是“CSS 写法增强层”。

### PostCSS

PostCSS 不是一种新的 CSS 语法，而是 CSS 转换平台。它把 CSS 解析成 AST，再交给插件处理。最常见插件是 `autoprefixer`，用于根据浏览器兼容目标自动补浏览器前缀。

例如你写：

```css
.box {
  user-select: none;
}
```

经过 PostCSS 插件后，可能变成：

```css
.box {
  -webkit-user-select: none;
  user-select: none;
}
```

所以 PostCSS 的定位更像 Babel：Babel 转换 JS，PostCSS 转换 CSS。

### Tailwind CSS

Tailwind CSS 是原子化 CSS 框架。它的核心不是“转换 CSS”，而是提供一套 class 约定，让你通过组合 class 写样式。

例如：

```html
<button class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
  Save
</button>
```

构建时，Tailwind 会扫描源码里用到的 class，只生成实际用到的 CSS。它和 Sass/Less 的区别是：

| 维度 | Sass/Less | Tailwind CSS |
| --- | --- | --- |
| 写法 | 写自定义 CSS | 组合原子 class |
| 核心价值 | 增强 CSS 语言能力 | 建立样式设计系统和约束 |
| 构建重点 | 预处理成普通 CSS | 扫描源码，生成用到的工具类 |

Tailwind 通常会接入 PostCSS，也会被 Vite、Webpack、Rsbuild 等构建工具集成。

### Lightning CSS

Lightning CSS 是高性能 CSS 转换和压缩工具。它和 PostCSS 有重叠，但定位更偏底层性能组件：解析 CSS、做语法转换、补兼容、压缩等。

可以这样理解：

```text
Sass/Less：写 CSS 前的语法增强
PostCSS：CSS 插件转换平台
Tailwind CSS：样式框架和原子化 class 生成器
Lightning CSS：高性能 CSS 转换/压缩底层工具
```

在现代构建链里，CSS 经常是这样流动的：

```text
Sass/Less 源码
  -> 编译成 CSS
  -> PostCSS / Lightning CSS 做转换、prefix、压缩
  -> Vite / Webpack / Rsbuild 处理 CSS import、代码分割、资源路径
  -> 输出 CSS 文件或注入 JS chunk
```

## npm 包发布质量检查：publint、Are The Types Wrong、API Extractor

写 npm 库时，构建成功不等于发布正确。很多包在本地能跑，但发布后会遇到类型找不到、ESM/CJS 入口错误、exports 配置不对、类型声明和运行时代码不匹配等问题。

这类问题可以用专门工具检查。

| 工具 | 主要检查什么 | 适合场景 |
| --- | --- | --- |
| publint | `package.json`、exports、files、模块入口等发布配置 | 发布 npm 包前做基础体检 |
| Are The Types Wrong | 类型声明在不同模块解析策略下是否正确 | 检查 TypeScript 包类型入口 |
| API Extractor | 类型声明整理、API 报告、公共 API 稳定性 | 大型 TS 库、设计系统、SDK |

### publint

`publint` 主要检查 npm 包发布配置是否合理。例如：

- `main`、`module`、`types` 是否指向存在的文件。
- `exports` 配置是否合理。
- 发布文件是否缺失。
- ESM/CJS 入口是否和 `type` 字段冲突。
- package 是否存在常见兼容性问题。

它适合在发布前跑：

```bash
publint
```

它解决的是“这个包发布出去后，别人能不能正确 import/require/use types”。

### Are The Types Wrong

Are The Types Wrong 专门检查 TypeScript 类型解析问题。一个包可能在你的本地编辑器里类型正常，但在不同用户的 `moduleResolution`、ESM/CJS 条件、Node 版本或 bundler 解析模式下出问题。

它关注的是：

- `types` 是否和 `exports` 匹配。
- ESM 和 CJS 入口是否有对应类型。
- Node16、NodeNext、Bundler 等解析模式下是否能找到类型。
- 类型声明是否暴露了错误路径。

这对同时发布 ESM/CJS 的库非常重要。

### API Extractor

API Extractor 更适合大型 TypeScript 库。它不只是检查类型能不能找到，还可以把多个 `.d.ts` 汇总成稳定的 API 声明，并生成 API 报告，帮助团队审查公共 API 变化。

它常见用途：

- 把分散的 `.d.ts` 汇总成一个入口声明文件。
- 生成 API report，审查 public API 是否变化。
- 区分 public、beta、internal API。
- 避免无意暴露内部类型。

如果只是一个小工具包，`tsup + publint` 可能就够；如果是组件库、SDK、基础库，`API Extractor` 会更有价值。

一个比较稳妥的 npm 库发布检查链路是：

```text
tsc --noEmit          # 类型检查
tsup / tsdown / Rollup # 构建产物
publint               # 检查发布配置
attw                  # 检查类型解析
```

大型库可以再加：

```text
api-extractor run     # 检查和整理公共 API
```

## Monorepo 工具对比：pnpm workspace、Turborepo、Nx、Rush

Monorepo 是一种仓库组织方式，不是某一个工具。一个 monorepo 里可以放多个应用、组件库、工具包、后端服务和配置包。不同工具负责的层次不一样。

| 工具 | 类型 | 核心作用 | 适合场景 |
| --- | --- | --- | --- |
| pnpm workspace | 包管理/workspace | 管理多包依赖、软链接、本地包引用 | 大多数 JS/TS monorepo 的基础层 |
| Turborepo | 任务编排/缓存 | 跑 build、test、lint，并缓存任务结果 | 中小型 monorepo，想快速加速 CI |
| Nx | 工程平台/任务编排 | 项目图、affected、缓存、生成器、边界约束 | 中大型 monorepo、工程治理要求高 |
| Rush | 企业级 monorepo 管理 | 严格依赖治理、版本策略、发布流程 | 大型企业、多团队、多包治理 |

### pnpm workspace

`pnpm workspace` 解决的是“一个仓库里怎么管理多个 package”。它负责安装依赖、建立本地包之间的链接、管理 lockfile 和 workspace 协议。

示例：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

常见目录：

```text
apps/
  web/
  admin/
packages/
  ui/
  utils/
  config/
```

`pnpm workspace` 是基础层，但它不负责高级任务缓存、项目图分析、affected 执行和工程边界治理。

### Turborepo

Turborepo 主要解决任务编排和缓存。它不替代 pnpm workspace，而是通常和 pnpm workspace 一起用。

它的核心是：同样输入得到同样输出，所以可以缓存任务结果。

```text
packages/ui 没变 -> ui build 结果复用缓存
apps/web 依赖 ui -> ui 先 build，web 后 build
```

Turborepo 的配置通常围绕任务管道：

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

它适合想快速把 monorepo CI 提速的团队。

### Nx

Nx 比 Turborepo 更像完整工程平台。它也有任务缓存和任务编排，但更强调项目图、affected 计算、生成器、插件生态和模块边界约束。

Nx 适合这些情况：

- 项目数量很多。
- 应用和库之间依赖复杂。
- CI 只想跑受影响项目。
- 需要强约束团队如何创建 app/lib。
- 需要通过规则限制跨模块依赖。

所以 Nx 的心智比 Turborepo 更重，但工程治理能力也更强。

### Rush

Rush 更偏企业级 monorepo 管理。它强调依赖版本一致性、变更管理、发布流程、严格的包治理和大规模团队协作。相比 Turborepo 和 Nx，Rush 的学习和接入成本更高，但在非常大的企业仓库里有优势。

### 怎么选

| 场景 | 推荐 |
| --- | --- |
| 只是多包管理 | pnpm workspace |
| 已经有 workspace，想加任务缓存 | Turborepo |
| 中大型仓库，需要项目图、affected、边界治理 | Nx |
| 企业级多团队、多包发布治理 | Rush |

常见组合是：

```text
pnpm workspace + Turborepo
pnpm workspace + Nx
Rush + pnpm
```

不要把这些工具看成互斥关系。`pnpm workspace` 是包管理基础层；Turborepo、Nx、Rush 是在它之上解决任务编排、缓存和治理问题。

## 应用框架层：Next.js、Nuxt、SvelteKit、Astro、Vike

Next.js、Nuxt、SvelteKit、Astro、Vike 不是单纯的 bundler。它们位于更上层，负责把构建工具、路由、渲染模式、数据获取、服务端运行时和部署方式组织成完整应用框架。

可以先分层理解：

```text
底层转换：Babel / SWC / esbuild / Oxc
底层打包：Webpack / Rollup / Rspack / Rolldown / Turbopack
构建工具：Vite / Rsbuild
应用框架：Next.js / Nuxt / SvelteKit / Astro / Vike
```

| 工具 | 主要生态 | 定位 | 常见渲染模式 |
| --- | --- | --- | --- |
| Next.js | React | React 全栈应用框架 | SSR、SSG、ISR、SPA、Server Components |
| Nuxt | Vue | Vue 全栈应用框架 | SSR、SSG、SPA |
| SvelteKit | Svelte | Svelte 官方应用框架 | SSR、SSG、SPA |
| Astro | 多框架 / 内容站点 | 内容优先、Island 架构应用框架 | SSG、SSR、Island Hydration |
| Vike | Vite / 多框架 | 基于 Vite 的 SSR/SSG 应用框架 | SSR、SSG、SPA |

### Next.js

Next.js 是 React 生态里最主流的全栈应用框架。它不只是帮你打包 React，而是提供路由、SSR、SSG、服务端组件、API 路由、图片优化、部署约定等一整套能力。

Next.js 的特点是约定强、能力完整、生态成熟。它适合业务系统、官网、电商、内容站、全栈 React 应用。它的代价是框架心智更重，项目会明显绑定 Next.js 的目录结构、路由体系、服务端运行模型和部署方式。

### Nuxt

Nuxt 可以理解为 Vue 生态里的 Next.js。它基于 Vue，提供文件路由、SSR、SSG、模块系统、服务端能力和部署适配。Vue 项目如果需要 SSR/SSG，全栈能力或更完整的应用约定，Nuxt 通常是首选。

Nuxt 的优势是 Vue 生态整合好，模块生态成熟；如果项目只是一个简单 SPA，直接用 Vite + Vue 就够，不一定需要 Nuxt。

### SvelteKit

SvelteKit 是 Svelte 官方应用框架。Svelte 本身是编译型 UI 框架，SvelteKit 在它之上提供路由、数据加载、SSR、SSG、表单处理和部署适配。

它适合已经选择 Svelte 的团队。和 React/Vue 生态相比，SvelteKit 的心智更统一，但生态规模相对小一些。

### Astro

Astro 的核心特点是内容优先和 Island 架构。它适合文档站、博客、营销页、内容站、多框架混合页面。Astro 默认尽量少发 JavaScript 到浏览器，只在需要交互的局部组件上做 hydration。

可以这样理解：

```text
Next/Nuxt/SvelteKit：更像完整应用框架
Astro：更偏内容站和静态/半静态页面，但也能做 SSR
```

### Vike

Vike 是基于 Vite 的 SSR/SSG 应用框架。它以前更接近 `vite-plugin-ssr` 的定位，现在更像一个不强绑定 React/Vue 的 Vite 上层应用框架。

Vike 的重点是灵活：你可以选择 React、Vue、Solid 等 UI 框架，也可以选择自己的 server、部署平台和渲染模式。它不像 Next.js 或 Nuxt 那样给出强约定的一整套全家桶，而是更偏“把 Vite 变成 SSR/SSG 应用框架，同时保留更多组合自由度”。

它和 Vite 的关系可以这样记：

```text
Vite：构建工具和 dev server
Vike：基于 Vite 的应用框架，补上路由、SSR/SSG、数据获取等能力
```

如果只是普通 SPA，用 Vite 就够；如果你需要 SSR/SSG，但不想强绑定 Next.js/Nuxt 的框架约定，可以考虑 Vike。

## Nx 是什么，适合解决什么问题

[Nx](https://github.com/nrwl/nx) 是一个面向 monorepo 的构建系统和工程化平台。它不是单纯的 lint、format 或 bundler 工具，而是更上层的任务编排工具：把多个应用、组件库、后端服务、测试、构建、lint、发布等任务放到同一个工作区里管理，并通过项目依赖图、任务缓存和 affected 机制减少重复执行。

Nx 的核心价值可以概括为：

| 能力 | 作用 | 适合场景 |
| --- | --- | --- |
| Monorepo 管理 | 在一个仓库中管理多个 app、package、library，并维护它们之间的依赖关系。 | 多应用、多包、前后端共仓、组件库和业务项目共仓。 |
| 任务编排 | 统一运行 build、test、lint、e2e、release 等任务，并按依赖顺序执行。 | 项目之间有构建依赖，手动维护脚本顺序容易出错。 |
| 本地与远程缓存 | 相同输入对应的任务结果可以复用，避免重复构建和重复测试。 | CI 慢、构建慢、多人协作中重复跑同一批任务。 |
| Affected 机制 | 根据 Git 变更和项目依赖图，只运行受影响项目的任务。 | 大型仓库中每次提交不希望全量 build/test/lint。 |
| 项目图与边界约束 | 可视化项目依赖，并可通过规则限制跨模块依赖。 | 团队规模变大后，需要避免模块边界腐化。 |
| 插件生态 | 支持 React、Angular、Vue、Next.js、Vite、Webpack、Rspack、ESLint、Jest、Vitest、Playwright、Storybook 等工具链。 | 希望在统一平台上接入不同前端框架和测试工具。 |
| CI 能力 | 结合 Nx Cloud 可以做远程缓存、任务分发、受影响任务执行和 CI 优化。 | 大型团队、CI 成本高、流水线耗时长。 |

对前端工程来说，Nx 更像是“工程任务调度层”。ESLint、Oxlint、Biome 负责代码质量和格式，Vite、Rsbuild、Webpack 负责构建，而 Nx 负责在一个大工作区里把这些工具串起来，并尽量只运行真正需要运行的任务。

它比较适合：

- 多个前端应用共享组件库、工具库、类型定义的团队。
- pnpm workspace、npm workspace、yarn workspace 已经开始变复杂的项目。
- CI 中 build、test、lint 逐渐变慢，需要缓存和 affected 执行的项目。
- 希望统一生成代码、执行任务、约束模块边界的大型前端工程。

它不一定适合：

- 只有一个很小的 SPA，构建和测试都很快的项目。
- 团队暂时不想引入 monorepo 规范、生成器、项目图和额外配置的项目。
- 只是想找一个更快的 lint 或 formatter 工具的场景，这类需求优先看 Oxlint、Biome 或 ESLint。

总结：Nx 不是替代 Vite、Rsbuild、ESLint、Biome 的工具，而是把这些工具组织起来的工程化平台。小项目未必需要它；一旦项目变成多应用、多包、多团队协作，Nx 的缓存、affected 执行和任务编排会明显降低工程维护和 CI 成本。
