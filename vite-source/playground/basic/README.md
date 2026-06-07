# basic playground

启动：

```bash
pnpm --dir vite-source dev:basic
```

访问：

```txt
http://localhost:5173/
```

这个示例覆盖：

- `index.html` 转换和 `/@vite/client` 注入
- JS 模块转换
- 普通 CSS 注入
- `.module.css` tokens 导出
- JSON 模块
- 动态 import
- `import.meta.hot.accept()`
