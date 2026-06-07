import { computed, ref } from 'vue'
import { createPinia } from '../src/createPinia'
import { defineStore } from '../src/store'
import { storeToRefs } from '../src/storeToRefs'
import type { StoreActions } from '../src/types'

declare module '../src/types' {
  interface PiniaCustomProperties<Id, S, G, A> {
    $actions: Array<keyof A>
    myState: number
  }

  interface PiniaCustomStateProperties<S> {
    stateOnly?: number
  }

  interface DefineStoreOptionsBase<S, Store> {
    debounce?: Partial<Record<keyof StoreActions<Store>, number>>
  }
}

const pinia = createPinia()

pinia.use(({ store, options }) => {
  const actions = options.actions
  store.$actions = Object.keys(actions || {}) as Array<keyof typeof actions>
  store.myState = 1
  const fromState: number | undefined = store.$state.stateOnly
  void fromState
})

const useOptionsStore = defineStore('customOptions', {
  state: () => ({
    count: 0,
  }),
  getters: {
    doubled(state) {
      const fromStateOnly: number | undefined = state.stateOnly
      void fromStateOnly
      return state.count * 2
    },
  },
  actions: {
    increment() {
      const fromCustomStore: number | undefined = this.myState
      const fromCustomState: number | undefined = this.$state.stateOnly
      void fromCustomStore
      void fromCustomState
      this.count++
    },
  },
  debounce: {
    increment: 100,
  },
})

const optionsStore = useOptionsStore(pinia)
const pluginStateNumber: number | undefined = optionsStore.myState
const pluginActions: Array<'increment'> | undefined = optionsStore.$actions

const optionsRefs = storeToRefs(optionsStore)
const stateOnlyRefNumber: number | undefined = optionsRefs.stateOnly?.value

const useSetupStore = defineStore(
  'customSetup',
  () => {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)
    function increment() {
      count.value++
    }
    return { count, doubled, increment }
  },
  {
    debounce: {
      increment: 200,
    },
  }
)

const setupStore = useSetupStore(pinia)
const setupPluginStateNumber: number | undefined = setupStore.myState

void pluginStateNumber
void pluginActions
void stateOnlyRefNumber
void setupPluginStateNumber
