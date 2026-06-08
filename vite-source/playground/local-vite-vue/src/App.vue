<script setup lang="ts">
import { computed, nextTick, provide, reactive, ref, version, watch } from 'vue'
import InjectProbe from './InjectProbe.vue'

type CheckStatus = 'pending' | 'pass' | 'fail'

type Check = {
  name: string
  detail: string
  status: CheckStatus
}

const makeRows = () => [
  { id: 1, label: 'alpha' },
  { id: 2, label: 'beta' },
  { id: 3, label: 'gamma' },
]

const checks = reactive<Check[]>([
  { name: 'local vite transform', detail: 'SFC + TS 应被本地 Vite 编译', status: 'pending' },
  { name: 'local vue runtime', detail: 'ref/computed/watch 应正常更新', status: 'pending' },
  { name: 'provide/inject', detail: '子组件应拿到祖先 provide 的值', status: 'pending' },
  { name: 'keyed list patch', detail: '列表重排后 DOM 顺序应正确', status: 'pending' },
])

const count = ref(0)
const doubled = computed(() => count.value * 2)
const watchLog = ref<string[]>([])
const rows = ref(makeRows())

provide('local-token', 'local-vue-ok')

watch(count, (value, oldValue) => {
  watchLog.value.push(`${oldValue}->${value}`)
})

function mark(index: number, passed: boolean, detail: string) {
  checks[index].status = passed ? 'pass' : 'fail'
  checks[index].detail = detail
}

async function runChecks() {
  checks.forEach(check => {
    check.status = 'pending'
  })

  mark(0, true, 'App.vue script setup/template/style 已加载')

  count.value = 1
  await nextTick()
  mark(
    1,
    doubled.value === 2 && watchLog.value.includes('0->1'),
    `count=${count.value}, doubled=${doubled.value}, watch=${watchLog.value.join(', ')}`,
  )

  const injected = document.querySelector('[data-inject-probe]')?.textContent?.trim()
  mark(2, injected === 'local-vue-ok', `injected=${injected ?? 'missing'}`)

  rows.value = makeRows()
  await nextTick()
  rows.value = [rows.value[2], rows.value[0], rows.value[1]]
  await nextTick()
  const order = Array.from(document.querySelectorAll('[data-row]'))
    .map(node => node.textContent?.trim())
    .join(',')
  mark(3, order === 'gamma,alpha,beta', `order=${order}`)
}

function shuffleRows() {
  rows.value = [rows.value[1], rows.value[2], rows.value[0]]
}

nextTick(runChecks)
</script>

<template>
  <main class="shell">
    <section class="summary">
      <div>
        <p class="eyebrow">local Vite CLI + local Vue source</p>
        <h1>Vite 源码加载 Vue 源码</h1>
      </div>
      <div class="source">
        <span>vite</span>
        <strong>vite-source/packages/vite/dist/node/cli.js</strong>
        <span>vue</span>
        <strong>vue-source/packages/runtime-dom/src/index.ts</strong>
        <small>version: {{ version }}</small>
      </div>
    </section>

    <section class="toolbar">
      <button type="button" @click="count++">+1</button>
      <button type="button" @click="shuffleRows">重排列表</button>
      <button type="button" @click="runChecks">重新验证</button>
    </section>

    <section class="grid">
      <article class="panel">
        <h2>运行时状态</h2>
        <dl>
          <div>
            <dt>count</dt>
            <dd>{{ count }}</dd>
          </div>
          <div>
            <dt>computed</dt>
            <dd>{{ doubled }}</dd>
          </div>
          <div>
            <dt>watch</dt>
            <dd>{{ watchLog.join(' / ') || '等待变化' }}</dd>
          </div>
        </dl>
        <p class="caption">provide/inject: <InjectProbe /></p>
      </article>

      <article class="panel">
        <h2>DOM patch</h2>
        <ol class="rows">
          <li v-for="row in rows" :key="row.id" data-row>{{ row.label }}</li>
        </ol>
      </article>

      <article class="panel checks">
        <h2>自动检查</h2>
        <ul>
          <li v-for="check in checks" :key="check.name" :class="check.status">
            <span class="status">{{ check.status }}</span>
            <div>
              <strong>{{ check.name }}</strong>
              <p>{{ check.detail }}</p>
            </div>
          </li>
        </ul>
      </article>
    </section>
  </main>
</template>
