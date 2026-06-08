import {
  computed,
  createApp,
  defineComponent,
  nextTick,
  provide,
  reactive,
  ref,
  version,
  watch,
  inject,
} from 'vue'

import './style.css'

type CheckStatus = 'pending' | 'pass' | 'fail'

type Check = {
  name: string
  detail: string
  status: CheckStatus
}

const makeCheck = (name: string, detail: string): Check => ({
  name,
  detail,
  status: 'pending',
})

const checks = reactive<Check[]>([
  makeCheck('reactive + computed', 'state.count 更新后 computed 应该重新计算'),
  makeCheck('watch + nextTick', 'watch 应该在状态变化后收到新旧值'),
  makeCheck('template compiler', 'template 选项应该被本地 compiler 编译并渲染'),
  makeCheck('component props/emits', '子组件 emit 后父组件状态应该更新'),
  makeCheck('provide/inject', '后代组件应该拿到祖先 provide 的值'),
  makeCheck('keyed list patch', '数组重排后 DOM 顺序应该保持正确'),
])

const createRows = () => [
  { id: 1, label: 'alpha' },
  { id: 2, label: 'beta' },
  { id: 3, label: 'gamma' },
]

function mark(index: number, passed: boolean, detail?: string) {
  checks[index].status = passed ? 'pass' : 'fail'
  if (detail) {
    checks[index].detail = detail
  }
}

const ProbeChild = defineComponent({
  name: 'ProbeChild',
  props: {
    label: {
      type: String,
      required: true,
    },
  },
  emits: ['ping'],
  template: `
    <button class="probe-button" type="button" @click="$emit('ping', label)">
      emit {{ label }}
    </button>
  `,
})

const InjectProbe = defineComponent({
  name: 'InjectProbe',
  setup() {
    const injected = inject<string>('playground-token', 'missing')
    return { injected }
  },
  template: `<span data-inject-probe class="mono">{{ injected }}</span>`,
})

const App = defineComponent({
  name: 'LocalVuePlayground',
  components: {
    ProbeChild,
    InjectProbe,
  },
  setup() {
    provide('playground-token', 'local-vue-ok')

    const count = ref(0)
    const emitted = ref('none')
    const templateVisible = ref(true)
    const rows = ref(createRows())
    const doubled = computed(() => count.value * 2)
    const watchLog = ref<string[]>([])

    watch(count, (value, oldValue) => {
      watchLog.value.push(`${oldValue}->${value}`)
    })

    async function runChecks() {
      checks.forEach(check => {
        check.status = 'pending'
      })

      count.value = 1
      await nextTick()
      mark(
        0,
        doubled.value === 2,
        `count=${count.value}, doubled=${doubled.value}`,
      )
      mark(
        1,
        watchLog.value.includes('0->1'),
        `watchLog=${watchLog.value.join(', ') || 'empty'}`,
      )

      templateVisible.value = false
      await nextTick()
      templateVisible.value = true
      await nextTick()
      mark(2, templateVisible.value, 'v-if 重新挂载完成')

      emitted.value = 'child'
      await nextTick()
      mark(3, emitted.value === 'child', `emitted=${emitted.value}`)

      const injectedText = document.querySelector('[data-inject-probe]')?.textContent
      mark(4, injectedText === 'local-vue-ok', `injected=${injectedText ?? 'missing'}`)

      rows.value = createRows()
      await nextTick()
      rows.value = [rows.value[2], rows.value[0], rows.value[1]]
      await nextTick()
      const renderedOrder = Array.from(document.querySelectorAll('[data-row]'))
        .map(node => node.textContent?.trim())
        .join(',')
      mark(5, renderedOrder === 'gamma,alpha,beta', `order=${renderedOrder}`)
    }

    function increment() {
      count.value += 1
    }

    function reverseRows() {
      rows.value = [...rows.value].reverse()
    }

    nextTick(runChecks)

    return {
      checks,
      count,
      doubled,
      emitted,
      increment,
      reverseRows,
      rows,
      runChecks,
      templateVisible,
      version,
      watchLog,
    }
  },
  template: `
    <main class="shell">
      <section class="summary">
        <div>
          <p class="eyebrow">Vite + local Vue source</p>
          <h1>Vue 复刻版验证台</h1>
        </div>
        <div class="source">
          <span>import</span>
          <strong>vue -> packages/vue/src/index.ts</strong>
          <small>version: {{ version }}</small>
        </div>
      </section>

      <section class="toolbar" aria-label="controls">
        <button type="button" @click="increment">+1</button>
        <button type="button" @click="reverseRows">重排列表</button>
        <button type="button" @click="runChecks">重新验证</button>
      </section>

      <section class="grid">
        <article class="panel state-panel">
          <h2>响应式状态</h2>
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

          <ProbeChild label="child" @ping="emitted = $event" />
          <p class="caption">emit result: <span class="mono">{{ emitted }}</span></p>

          <p class="caption">
            provide/inject: <InjectProbe />
          </p>
        </article>

        <article class="panel">
          <h2>模板与 DOM patch</h2>
          <p v-if="templateVisible" class="compiled">template compiler active</p>
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
  `,
})

createApp(App).mount('#app')
