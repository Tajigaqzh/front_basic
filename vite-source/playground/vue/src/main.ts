import { createApp } from 'vue'
import App from './App.vue'
import { createLabel } from './jsx-demo.tsx'
import './style.css'
import './theme.scss'
import './theme.less'

type MountTarget = string | Element

const target: MountTarget = '#app'

console.debug('[vite-source] tsx export type:', typeof createLabel)
createApp(App).mount(target)

if (import.meta.hot) {
  import.meta.hot.accept()
}
