import './style.css'

const { createApp, ref, computed } = Vue

createApp({
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    return {
      count,
      doubled,
    }
  },
  template: `
    <main class="page-shell">
      <section class="panel">
        <p class="eyebrow">Vite + 原生 JS + Vue CDN</p>
        <h1>CDN Vue 示例</h1>
        <p class="intro">
          这个页面通过 CDN 引入 Vue 3，在 Vite 中使用原生 JavaScript 编写交互。
        </p>

        <div class="counter">
          <span>计数：{{ count }}</span>
          <span>两倍：{{ doubled }}</span>
        </div>

        <button type="button" @click="count++">增加</button>
      </section>
    </main>
  `,
}).mount('#app')
