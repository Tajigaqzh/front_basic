import './style.css'
import styles, { title } from './panel.module.css'
import data from './message.json'
import { hmrMessage } from './hmr-message.js'

const app = document.querySelector('#app')
const state = {
  count: 0,
}

function render(message = data.message) {
  app.innerHTML = `
    <section class="${styles.panel}">
      <p class="${styles.eyebrow}">vite-source playground</p>
      <h1 class="${title}">${message}</h1>
      <p class="${styles.description}">
        当前页面用于测试 dev server、HTML 转换、CSS、CSS Modules、JSON、动态 import 和 HMR。
      </p>
      <div class="${styles.actions}">
        <button id="count">count: ${state.count}</button>
        <button id="load">加载动态模块</button>
      </div>
      <pre id="result">等待操作...</pre>
      <pre id="hmr">${hmrMessage}</pre>
    </section>
  `

  document.querySelector('#count').addEventListener('click', () => {
    state.count += 1
    render(message)
  })

  document.querySelector('#load').addEventListener('click', async () => {
    const mod = await import('./async.js')
    document.querySelector('#result').textContent = mod.createMessage(state.count)
  })
}

render()

if (import.meta.hot) {
  import.meta.hot.accept('./hmr-message.js', (mod) => {
    render(mod?.hmrMessage ?? hmrMessage)
  })
  import.meta.hot.accept()
}
