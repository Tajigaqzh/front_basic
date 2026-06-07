<template>
  <section class="card">
    <p class="eyebrow">vite-source + vue</p>
    <h1>{{ title }}</h1>
    <p class="description">
      这个页面使用 main.ts 作为入口，通过本地复刻版 @vitejs/plugin-vue 编译 App.vue，并运行真实 Vue runtime。
    </p>
    <div class="scss-box less-box css-pipeline">CSS pipeline: Sass + Less + PostCSS + URL rebasing</div>
    <button @click="count += 1">count: {{ count }}</button>
    <pre>{{ resolveState }}</pre>
    <pre>{{ globState }}</pre>
  </section>

  <div>
    <img class="preview" :src="imgUrl">
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import imgUrl from './img.png'
import { eagerNames, lazyModules, loadFeature } from './glob-demo.js'
import { resolveDemo } from 'vite-source-resolve-demo'

const title = 'Vue SFC playground'
const count = ref<number>(0)
const globState = ref<string>('loading glob demo...')
const resolveState = JSON.stringify(resolveDemo, null, 2)

loadFeature('a').then((name) => {
  globState.value = JSON.stringify({
    assetUrl: new URL('./img.png', import.meta.url).pathname,
    eager: Object.values(eagerNames),
    lazyKeys: Object.keys(lazyModules),
    dynamic: name,
  }, null, 2)
})

</script>

<style scoped>
.card {
  max-width: 680px;
  margin: 64px auto;
  padding: 32px;
  border: 1px solid #d7dde8;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
}

.eyebrow {
  margin: 0 0 12px;
  color: #607089;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #172033;
  font-size: 36px;
  line-height: 1.15;
}

.description {
  margin: 16px 0 24px;
  color: #46556c;
  line-height: 1.7;
}

button {
  height: 40px;
  padding: 0 16px;
  border: 1px solid #223047;
  border-radius: 6px;
  background: #223047;
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}

.preview {
  display: block;
  max-width: 220px;
  margin: 20px auto;
  border: 1px solid #d7dde8;
  border-radius: 6px;
}

pre {
  margin: 20px 0 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid #d7dde8;
  border-radius: 6px;
  background: #f8fafc;
  color: #223047;
  font-size: 13px;
  line-height: 1.5;
}

.css-pipeline {
  margin: 0 0 20px;
  padding: 12px;
  border: 2px solid #0f766e;
  border-radius: 6px;
  background-size: 64px auto;
  background-repeat: no-repeat;
  background-position: right 12px center;
}
</style>
