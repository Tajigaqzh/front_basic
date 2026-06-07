import { computed, ref } from 'vue'
import { createPinia } from '../src/createPinia'
import {
  mapActions,
  mapState,
  mapStores,
  mapWritableState,
  setMapStoreSuffix,
} from '../src/mapHelpers'
import { defineStore, shouldHydrate, skipHydrate } from '../src/store'
import { storeToRefs } from '../src/storeToRefs'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false
type Assert<T extends true> = T

const pinia = createPinia()
const skippedObject = skipHydrate({ ok: true })
const shouldHydrateSkipped: boolean = shouldHydrate(skippedObject)
const shouldHydratePlain: boolean = shouldHydrate({ ok: true })

const useCounter = defineStore('counter', {
  state: () => ({
    count: 0,
    label: 'count',
  }),
  getters: {
    double(state) {
      return state.count * 2
    },
  },
  actions: {
    increment(step: number = 1) {
      this.count += step
      return this.count
    },
  },
})

const counter = useCounter(pinia)

const countNumber: number = counter.count
const labelString: string = counter.label
const doubleNumber: number = counter.double
const incrementResult: number = counter.increment(2)

const refs = storeToRefs(counter)
const countRefNumber: number = refs.count.value
const doubleRefNumber: number = refs.double.value

const mappedState = mapState(useCounter, ['count', 'double'] as const)
const mappedStateCount: number = mappedState.count.call({ $pinia: pinia })
const mappedStateDouble: number = mappedState.double.call({ $pinia: pinia })

const mappedCustomState = mapState(useCounter, {
  current: 'count',
  info: (store) => `${store.label}:${store.double}`,
})
const mappedCurrent: number = mappedCustomState.current.call({ $pinia: pinia })
const mappedInfo: string = mappedCustomState.info.call({ $pinia: pinia })

const mappedActions = mapActions(useCounter, ['increment'] as const)
const mappedActionResult: number = mappedActions.increment.call({ $pinia: pinia }, 2)
const mappedIncrementFn: (this: { $pinia: typeof pinia }, step?: number) => number =
  mappedActions.increment

const mappedActionAliases = mapActions(useCounter, {
  add: 'increment',
})
const mappedAliasResult: number = mappedActionAliases.add.call({ $pinia: pinia }, 3)

const mappedWritableState = mapWritableState(useCounter, ['count', 'label'] as const)
const mappedWritableGet: number = mappedWritableState.count.get.call({ $pinia: pinia })
mappedWritableState.count.set.call({ $pinia: pinia }, 5)

const mappedWritableAliases = mapWritableState(useCounter, { current: 'count' })
const mappedWritableAliasGet: number = mappedWritableAliases.current.get.call({ $pinia: pinia })

counter.$onAction((context) => {
  if (context.name === 'increment') {
    const stepArg: number | undefined = context.args[0]

    context.after((result) => {
      const actionResult: number = result
      void actionResult
    })

    context.onError((error) => {
      const unknownError: unknown = error
      void unknownError
    })

    void stepArg
  }
}, true)

counter.$subscribe(
  (mutation, state) => {
    const mutationType = mutation.type
    const stateCount: number = state.count
    void mutationType
    void stateCount
  },
  { flush: 'sync', detached: true }
)

setMapStoreSuffix('')
const mappedStores = mapStores(useCounter)
const mappedStoreCount: number = mappedStores.counter.call({ $pinia: pinia }).count
setMapStoreSuffix('Store')

const useSetupStore = defineStore('setup', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)

  function increment(step: number = 1) {
    count.value += step
    return count.value
  }

  return {
    count,
    double,
    increment,
  }
})

const setupStore = useSetupStore(pinia)
const setupCount: number = setupStore.count
const setupDouble: number = setupStore.double
const setupActionResult: number = setupStore.increment()

setupStore.$onAction((context) => {
  if (context.name === 'increment') {
    const stepArg: number | undefined = context.args[0]

    context.after((result) => {
      const actionResult: number = result
      void actionResult
    })

    void stepArg
  }
})

const useAsyncStore = defineStore('async', {
  actions: {
    async load(id: string) {
      return {
        id,
        ok: true,
      }
    },
    fail(error: Error): never {
      throw error
    },
  },
})

const asyncStore = useAsyncStore(pinia)

asyncStore.$onAction((context) => {
  if (context.name === 'load') {
    const firstArg: string = context.args[0]

    context.after((result) => {
      const payloadId: string = result.id
      const payloadOk: boolean = result.ok
      void payloadId
      void payloadOk
    })

    void firstArg
  } else if (context.name === 'fail') {
    const firstArg: Error = context.args[0]

    context.after((result) => {
      const neverResult: never = result
      void neverResult
    })

    void firstArg
  }
})

const setupRefs = storeToRefs(setupStore)
const setupCountRef: number = setupRefs.count.value
const setupDoubleRef: number = setupRefs.double.value

const useWritableSetupStore = defineStore('writableSetup', () => {
  const text = ref('initial' as 'initial' | 'next')
  const writableUpper = computed({
    get: () => text.value.toUpperCase(),
    set: (value: 'initial' | 'next') => {
      text.value = value
    },
  })

  return {
    text,
    writableUpper,
  }
})

const writableSetupStore = useWritableSetupStore(pinia)
const writableMapped = mapWritableState(useWritableSetupStore, ['text', 'writableUpper'] as const)
const writableMappedTextGet: 'initial' | 'next' =
  writableMapped.text.get.call({ $pinia: pinia })
const writableMappedUpperGet: string =
  writableMapped.writableUpper.get.call({ $pinia: pinia })
writableMapped.writableUpper.set.call({ $pinia: pinia }, 'next')

const writableSetupRefs = storeToRefs(writableSetupStore)
const writableUpperRefValue: string = writableSetupRefs.writableUpper.value
writableSetupRefs.writableUpper.value = 'initial'

// @ts-expect-error getters should not be writable values
refs.double.value = 1

// @ts-expect-error mapState should reject unknown keys
mapState(useCounter, ['missing'] as const)

type _AssertCounterActionArgs = Assert<
  Equal<Parameters<typeof counter.increment>, [step?: number]>
>
type _AssertMappedActionArgs = Assert<
  Equal<Parameters<typeof mappedActions.increment>, [step?: number]>
>
type _AssertMappedAliasArgs = Assert<
  Equal<Parameters<typeof mappedActionAliases.add>, [step?: number]>
>
type _AssertMappedWritableStateSetter = Assert<
  Equal<Parameters<typeof mappedWritableState.count.set>, [value: number]>
>
type _AssertMappedWritableAliasSetter = Assert<
  Equal<Parameters<typeof mappedWritableAliases.current.set>, [value: number]>
>
type _AssertWritableSetupSetter = Assert<
  Equal<Parameters<typeof writableMapped.writableUpper.set>, [value: string]>
>

void countNumber
void labelString
void doubleNumber
void incrementResult
void countRefNumber
void doubleRefNumber
void mappedStateCount
void mappedStateDouble
void mappedCurrent
void mappedInfo
void mappedActionResult
void mappedIncrementFn
void mappedAliasResult
void mappedWritableGet
void mappedWritableAliasGet
void mappedStoreCount
void setupCount
void setupDouble
void setupActionResult
void setupCountRef
void setupDoubleRef
void shouldHydrateSkipped
void shouldHydratePlain
void writableMappedTextGet
void writableMappedUpperGet
void writableUpperRefValue
