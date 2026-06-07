// Note: this file is auto concatenated to the end of the bundled d.ts during
// build.

import type {
  BaseTransitionProps,
  DefineComponent,
  KeepAliveProps,
  SuspenseProps,
  TeleportProps,
} from '../src'

declare module '@vue-source/runtime-core' {
  export interface GlobalComponents {
    Teleport: DefineComponent<TeleportProps>
    Suspense: DefineComponent<SuspenseProps>
    KeepAlive: DefineComponent<KeepAliveProps>
    BaseTransition: DefineComponent<BaseTransitionProps>
  }
}
