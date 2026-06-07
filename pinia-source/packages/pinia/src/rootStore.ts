import type {
  App,
  EffectScope,
  InjectionKey,
  Ref,
} from 'vue'
import { hasInjectionContext, inject } from 'vue'
import { IS_CLIENT } from './env'
import type {
  DefineStoreOptionsInPlugin,
  StateTree,
  StoreGeneric,
} from './types'

export let activePinia: Pinia | undefined

interface _SetActivePinia {
  (pinia: Pinia): Pinia
  (pinia: undefined): undefined
  (pinia: Pinia | undefined): Pinia | undefined
}

// @ts-expect-error overload narrowing matches Pinia upstream shape
export const setActivePinia: _SetActivePinia = (pinia) => (activePinia = pinia)

export const getActivePinia = __DEV__
  ? (): Pinia | undefined => {
      const pinia = hasInjectionContext() && inject(piniaSymbol)

      if (!pinia && !IS_CLIENT) {
        console.error(
          '[pinia-source]: Pinia instance not found in current injection context.'
        )
      }

      return pinia || activePinia
    }
  : (): Pinia | undefined =>
      (hasInjectionContext() && inject(piniaSymbol)) || activePinia

export interface Pinia {
  install: (app: App) => void
  state: Ref<Record<string, StateTree>>
  use(plugin: PiniaPlugin): Pinia
  _p: PiniaPlugin[]
  _a: App | null
  _e: EffectScope
  _s: Map<string, StoreGeneric>
  _testing?: boolean
}

export const piniaSymbol = (
  __DEV__ ? Symbol('pinia') : Symbol()
) as InjectionKey<Pinia>

export interface PiniaPluginContext {
  pinia: Pinia
  app: App
  store: StoreGeneric
  options: DefineStoreOptionsInPlugin<
    string,
    StateTree,
    Record<string, any>,
    Record<string, any>
  >
}

export interface PiniaPlugin {
  (context: PiniaPluginContext): Record<string, any> | void
}
