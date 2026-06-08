import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

function StatusItem({ label, value, ok = true }) {
  return (
    <li className={ok ? 'pass' : 'fail'}>
      <span className="status">{ok ? 'pass' : 'fail'}</span>
      <div>
        <strong>{label}</strong>
        <p>{value}</p>
      </div>
    </li>
  )
}

function App() {
  const [count, setCount] = useState(0)
  const [rows, setRows] = useState(['vite', 'react', 'jsx'])
  const doubled = useMemo(() => count * 2, [count])

  const reverseRows = () => {
    setRows(value => [...value].reverse())
  }

  return (
    <main className="shell">
      <section className="summary">
        <div>
          <p className="eyebrow">local Vite + local React source</p>
          <h1>local-vite-react</h1>
        </div>
        <div className="source">
          <span>vite</span>
          <strong>vite-source/packages/vite/dist/node/cli.js</strong>
          <span>plugin</span>
          <strong>playground/local-vite-react/plugins/local-react-source-plugin.mjs</strong>
          <span>react</span>
          <strong>react-source/build/node_modules/react</strong>
        </div>
      </section>

      <section className="toolbar">
        <button type="button" onClick={() => setCount(value => value + 1)}>
          +1
        </button>
        <button type="button" onClick={reverseRows}>
          重排列表
        </button>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>运行状态</h2>
          <dl>
            <div>
              <dt>count</dt>
              <dd>{count}</dd>
            </div>
            <div>
              <dt>memo</dt>
              <dd>{doubled}</dd>
            </div>
            <div>
              <dt>react</dt>
              <dd>{React.version ?? 'local-source'}</dd>
            </div>
          </dl>
          <ol className="rows">
            {rows.map(row => (
              <li key={row}>{row}</li>
            ))}
          </ol>
        </article>

        <article className="panel checks">
          <h2>自动检查</h2>
          <ul>
            <StatusItem
              label="local vite"
              value="由 vite-source/packages/vite/dist/node/cli.js 启动"
            />
            <StatusItem
              label="local plugin-react"
              value="由本工程 plugins/local-react-source-plugin.mjs 转换 JSX"
            />
            <StatusItem
              label="local react"
              value="由 react-source/build/node_modules/react 提供"
            />
            <StatusItem
              label="hooks"
              value={`useState/useMemo 正常，doubled=${doubled}`}
              ok={doubled === count * 2}
            />
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
