export default {
  plugins: [
    {
      postcssPlugin: 'vite-source-postcss-demo',
      Once(root) {
        root.append({
          selector: ':root',
          nodes: [
            {
              prop: '--postcss-demo',
              value: '"processed"',
            },
          ],
        })
      },
    },
  ],
}
