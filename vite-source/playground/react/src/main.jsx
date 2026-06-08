import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

function App() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState(['alpha', 'beta', 'gamma'])
  const doubled = useMemo(() => count * 2, [count])

  const checks = [
    {
      name: 'local vite',
      detail: '页面由 vite-source/packages/vite/dist/node/cli.js 服务',
      pass: true,
    },
    {
      name: 'npm react',
      detail: `React ${React.version} from node_modules`,
      pass: Boolean(React.version),
    },
    {
      name: 'jsx transform',
      detail: `count=${count}, doubled=${doubled}`,
      pass: doubled === count * 2,
    },
    {
      name: 'keyed render',
      detail: `order=${items.join(',')}`,
      pass: items.length === 3,
    },
  ]

  return (
    <main className="shell">
      <section className="summary">
        <div>
          <p className="eyebrow">local Vite + npm React</p>
          <h1>React 验证台</h1>
        </div>
        <div className="source">
          <span>vite</span>
          <strong>vite-source/packages/vite/dist/node/cli.js</strong>
          <span>plugin</span>
          <strong>vite-source/packages/plugin-react/dist/index.js</strong>
        </div>
      </section>

      <section className="toolbar">
        <button type="button" onClick={() => setCount(value => value + 1)}>
          +1
        </button>
        <button type="button" onClick={() => setItems(value => [...value].reverse())}>
          重排列表
        </button>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>运行时状态</h2>
          <dl>
            <div>
              <dt>count</dt>
              <dd>{count}</dd>
            </div>
            <div>
              <dt>computed</dt>
              <dd>{doubled}</dd>
            </div>
            <div>
              <dt>react</dt>
              <dd>{React.version}</dd>
            </div>
          </dl>
          <ol className="rows">
            {items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className="panel checks">
          <h2>自动检查</h2>
          <ul>
            {checks.map(check => (
              <li key={check.name} className={check.pass ? 'pass' : 'fail'}>
                <span className="status">{check.pass ? 'pass' : 'fail'}</span>
                <div>
                  <strong>{check.name}</strong>
                  <p>{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)

if (import.meta.hot) {
  import.meta.hot.accept()
}
