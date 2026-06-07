/**
 * 文件作用：承接 `<script setup>` 和 setup 相关辅助 API。
 *
 * 这份文件负责 `useAttrs`、`useSlots`、`defineProps`、`defineEmits` 等辅助能力，
 * 既服务运行时，也给编译产物提供稳定入口。
 *
 * 其中一部分 API 是“编译宏占位符”：
 * - 运行时几乎不做实际工作
 * - 主要为了给编译器和 TypeScript 推导提供统一入口
 */

import {
  type IfAny,
  type LooseRequired,
  type Prettify,
  type UnionToIntersection,
  extend,
  isArray,
  isFunction,
  isPromise,
} from '@vue-source/shared'
import {
  type SetupContext,
  createSetupContext,
  getCurrentInstance,
  isInSSRComponentSetup,
  setCurrentInstance,
  setInSSRSetupState,
  unsetCurrentInstance,
} from './component'
import type { EmitFn, EmitsOptions, ObjectEmitsOptions } from './componentEmits'
import type {
  ComponentOptionsBase,
  ComponentOptionsMixin,
  ComputedOptions,
  MethodOptions,
} from './componentOptions'
import type {
  ComponentObjectPropsOptions,
  ComponentPropsOptions,
  ExtractPropTypes,
  PropOptions,
} from './componentProps'
import { warn } from './warning'
import type { SlotsType, StrictUnwrapSlotsType } from './componentSlots'
import type { Ref } from '@vue-source/reactivity'

// 这类 API 在运行时被真正调用通常意味着“编译没有把宏抹掉”，这里统一给出提示。
const warnRuntimeUsage = (method: string) =>
  warn(
    `${method}() is a compiler-hint helper that is only usable inside ` +
      `<script setup> of a single file component. Its arguments should be ` +
      `compiled away and passing it at runtime has no effect.`,
  )

/**
 * Vue `<script setup>` compiler macro for declaring component props. The
 * expected argument is the same as the component `props` option.
 *
 * Example runtime declaration:
 * ```js
 * // using Array syntax
 * const props = defineProps(['foo', 'bar'])
 * // using Object syntax
 * const props = defineProps({
 *   foo: String,
 *   bar: {
 *     type: Number,
 *     required: true
 *   }
 * })
 * ```
 *
 * Equivalent type-based declaration:
 * ```ts
 * // will be compiled into equivalent runtime declarations
 * const props = defineProps<{
 *   foo?: string
 *   bar: number
 * }>()
 * ```
 *
 * @see {@link https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits}
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 */
// overload 1: runtime props w/ array
export function defineProps<PropNames extends string = string>(
  props: PropNames[],
): Prettify<Readonly<{ [key in PropNames]?: any }>>
// overload 2: runtime props w/ object
export function defineProps<
  PP extends ComponentObjectPropsOptions = ComponentObjectPropsOptions,
>(props: PP): Prettify<Readonly<ExtractPropTypes<PP>>>
// overload 3: typed-based declaration
export function defineProps<TypeProps>(): DefineProps<
  LooseRequired<TypeProps>,
  BooleanKey<TypeProps>
>
// implementation
export function defineProps() {
  if (__DEV__) {
    warnRuntimeUsage(`defineProps`)
  }
  return null as any
}

export type DefineProps<T, BKeys extends keyof T> = Readonly<T> & {
  readonly [K in BKeys]-?: boolean
}

type BooleanKey<T, K extends keyof T = keyof T> = K extends any
  ? T[K] extends boolean | undefined
    ? T[K] extends never | undefined
      ? never
      : K
    : never
  : never

/**
 * Vue `<script setup>` compiler macro for declaring a component's emitted
 * events. The expected argument is the same as the component `emits` option.
 *
 * Example runtime declaration:
 * ```js
 * const emit = defineEmits(['change', 'update'])
 * ```
 *
 * Example type-based declaration:
 * ```ts
 * const emit = defineEmits<{
 *   // <eventName>: <expected arguments>
 *   change: []
 *   update: [value: number] // named tuple syntax
 * }>()
 *
 * emit('change')
 * emit('update', 1)
 * ```
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 *
 * @see {@link https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits}
 */
// overload 1: runtime emits w/ array
export function defineEmits<EE extends string = string>(
  emitOptions: EE[],
): EmitFn<EE[]>
export function defineEmits<E extends EmitsOptions = EmitsOptions>(
  emitOptions: E,
): EmitFn<E>
export function defineEmits<T extends ComponentTypeEmits>(): T extends (
  ...args: any[]
) => any
  ? T
  : ShortEmits<T>
// implementation
export function defineEmits() {
  if (__DEV__) {
    warnRuntimeUsage(`defineEmits`)
  }
  return null as any
}

export type ComponentTypeEmits = ((...args: any[]) => any) | Record<string, any>

type RecordToUnion<T extends Record<string, any>> = T[keyof T]

type ShortEmits<T extends Record<string, any>> = UnionToIntersection<
  RecordToUnion<{
    [K in keyof T]: (evt: K, ...args: T[K]) => void
  }>
>

/**
 * Vue `<script setup>` compiler macro for declaring a component's exposed
 * instance properties when it is accessed by a parent component via template
 * refs.
 *
 * `<script setup>` components are closed by default - i.e. variables inside
 * the `<script setup>` scope is not exposed to parent unless explicitly exposed
 * via `defineExpose`.
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 *
 * @see {@link https://vuejs.org/api/sfc-script-setup.html#defineexpose}
 */
export function defineExpose<
  Exposed extends Record<string, any> = Record<string, any>,
>(exposed?: Exposed): void {
  if (__DEV__) {
    warnRuntimeUsage(`defineExpose`)
  }
}

/**
 * Vue `<script setup>` compiler macro for declaring a component's additional
 * options. This should be used only for options that cannot be expressed via
 * Composition API - e.g. `inheritAttrs`.
 *
 * @see {@link https://vuejs.org/api/sfc-script-setup.html#defineoptions}
 */
export function defineOptions<
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
>(
  options?: ComponentOptionsBase<
    {},
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    {}
  > & {
    /**
     * props should be defined via defineProps().
     */
    props?: never
    /**
     * emits should be defined via defineEmits().
     */
    emits?: never
    /**
     * expose should be defined via defineExpose().
     */
    expose?: never
    /**
     * slots should be defined via defineSlots().
     */
    slots?: never
  },
): void {
  if (__DEV__) {
    warnRuntimeUsage(`defineOptions`)
  }
}

/**
 * Vue `<script setup>` compiler macro for providing type hints to IDEs for
 * slot name and slot props type checking.
 *
 * Example usage:
 * ```ts
 * const slots = defineSlots<{
 *   default(props: { msg: string }): any
 * }>()
 * ```
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 *
 * @see {@link https://vuejs.org/api/sfc-script-setup.html#defineslots}
 */
export function defineSlots<
  S extends Record<string, any> = Record<string, any>,
>(): StrictUnwrapSlotsType<SlotsType<S>> {
  if (__DEV__) {
    warnRuntimeUsage(`defineSlots`)
  }
  return null as any
}

export type ModelRef<T, M extends PropertyKey = string, G = T, S = T> = Ref<
  G,
  S
> &
  [ModelRef<T, M, G, S>, Record<M, true | undefined>]

export type DefineModelOptions<T = any, G = T, S = T> = {
  get?: (v: T) => G
  set?: (v: S) => any
}

/**
 * Vue `<script setup>` compiler macro for declaring a
 * two-way binding prop that can be consumed via `v-model` from the parent
 * component. This will declare a prop with the same name and a corresponding
 * `update:propName` event.
 *
 * If the first argument is a string, it will be used as the prop name;
 * Otherwise the prop name will default to "modelValue". In both cases, you
 * can also pass an additional object which will be used as the prop's options.
 *
 * The returned ref behaves differently depending on whether the parent
 * provided the corresponding v-model props or not:
 * - If yes, the returned ref's value will always be in sync with the parent
 *   prop.
 * - If not, the returned ref will behave like a normal local ref.
 *
 * @example
 * ```ts
 * // default model (consumed via `v-model`)
 * const modelValue = defineModel<string>()
 * modelValue.value = "hello"
 *
 * // default model with options
 * const modelValue = defineModel<string>({ required: true })
 *
 * // with specified name (consumed via `v-model:count`)
 * const count = defineModel<number>('count')
 * count.value++
 *
 * // with specified name and default value
 * const count = defineModel<number>('count', { default: 0 })
 * ```
 */
export function defineModel<T, M extends PropertyKey = string, G = T, S = T>(
  options: ({ default: any } | { required: true }) &
    PropOptions<T> &
    DefineModelOptions<T, G, S>,
): ModelRef<T, M, G, S>

export function defineModel<T, M extends PropertyKey = string, G = T, S = T>(
  options?: PropOptions<T> & DefineModelOptions<T, G, S>,
): ModelRef<T | undefined, M, G | undefined, S | undefined>

export function defineModel<T, M extends PropertyKey = string, G = T, S = T>(
  name: string,
  options: ({ default: any } | { required: true }) &
    PropOptions<T> &
    DefineModelOptions<T, G, S>,
): ModelRef<T, M, G, S>

export function defineModel<T, M extends PropertyKey = string, G = T, S = T>(
  name: string,
  options?: PropOptions<T> & DefineModelOptions<T, G, S>,
): ModelRef<T | undefined, M, G | undefined, S | undefined>

export function defineModel(): any {
  // 正常情况下这里会被编译器抹掉并改写成 props/emits/useModel 调用；
  // 运行时真正落到这里说明使用方式脱离了 `<script setup>` 编译链。
  if (__DEV__) {
    warnRuntimeUsage('defineModel')
  }
}

type NotUndefined<T> = T extends undefined ? never : T
type MappedOmit<T, K extends keyof any> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}

type InferDefaults<T> = {
  [K in keyof T]?: InferDefault<T, T[K]>
}

type NativeType =
  | null
  | undefined
  | number
  | string
  | boolean
  | symbol
  | Function

type InferDefault<P, T> =
  | ((props: P) => T & {})
  | (T extends NativeType ? T : never)

type PropsWithDefaults<
  T,
  Defaults extends InferDefaults<T>,
  BKeys extends keyof T,
> = T extends unknown
  ? Readonly<MappedOmit<T, keyof Defaults>> & {
      readonly [K in keyof Defaults as K extends keyof T
        ? K
        : never]-?: K extends keyof T
        ? Defaults[K] extends undefined
          ? IfAny<Defaults[K], NotUndefined<T[K]>, T[K]>
          : NotUndefined<T[K]>
        : never
    } & {
      readonly [K in BKeys]-?: K extends keyof Defaults
        ? Defaults[K] extends undefined
          ? boolean | undefined
          : boolean
        : boolean
    }
  : never

/**
 * Vue `<script setup>` compiler macro for providing props default values when
 * using type-based `defineProps` declaration.
 *
 * Example usage:
 * ```ts
 * withDefaults(defineProps<{
 *   size?: number
 *   labels?: string[]
 * }>(), {
 *   size: 3,
 *   labels: () => ['default label']
 * })
 * ```
 *
 * This is only usable inside `<script setup>`, is compiled away in the output
 * and should **not** be actually called at runtime.
 *
 * @see {@link https://vuejs.org/guide/typescript/composition-api.html#typing-component-props}
 */
export function withDefaults<
  T,
  BKeys extends keyof T,
  Defaults extends InferDefaults<T>,
>(
  props: DefineProps<T, BKeys>,
  defaults: Defaults,
): PropsWithDefaults<T, Defaults, BKeys> {
  // 运行时真正调用到这里通常说明编译宏没有被正确抹掉；
  // 在正常链路里它主要用于类型推导，真实合并逻辑由编译产物处理。
  if (__DEV__) {
    warnRuntimeUsage(`withDefaults`)
  }
  return null as any
}

/**
 * 作用：返回当前组件 setup 上下文里的 `slots`。
 */
export function useSlots(): SetupContext['slots'] {
  return getContext('useSlots').slots
}

/**
 * 作用：返回当前组件 setup 上下文里的 `attrs`。
 */
export function useAttrs(): SetupContext['attrs'] {
  return getContext('useAttrs').attrs
}

function getContext(calledFunctionName: string): SetupContext {
  // `setupContext` 按需惰性创建，避免不使用第二参时也提前构造整套上下文对象。
  const i = getCurrentInstance()!
  if (__DEV__ && !i) {
    warn(`${calledFunctionName}() called without active instance.`)
  }
  return i.setupContext || (i.setupContext = createSetupContext(i))
}

/**
 * @internal
 */
export function normalizePropsOrEmits(
  props: ComponentPropsOptions | EmitsOptions,
): ComponentObjectPropsOptions | ObjectEmitsOptions {
  // 数组写法统一转对象写法，便于 props / emits 后续共用一套合并与归一化逻辑。
  return isArray(props)
    ? props.reduce(
        (normalized, p) => ((normalized[p] = null), normalized),
        {} as ComponentObjectPropsOptions | ObjectEmitsOptions,
      )
    : props
}

/**
 * 作用：把编译阶段拆出来的默认值声明重新合并回 props 选项。
 * @internal
 */
export function mergeDefaults(
  raw: ComponentPropsOptions,
  defaults: Record<string, any>,
): ComponentObjectPropsOptions {
  // 这里会把编译阶段单独收集出来的默认值再灌回 props 配置，
  // 使运行时后续走统一的 props 归一化与默认值求值逻辑。
  const props = normalizePropsOrEmits(raw)
  for (const key in defaults) {
    if (key.startsWith('__skip')) continue
    let opt = props[key]
    if (opt) {
      if (isArray(opt) || isFunction(opt)) {
        opt = props[key] = { type: opt, default: defaults[key] }
      } else {
        opt.default = defaults[key]
      }
    } else if (opt === null) {
      opt = props[key] = { default: defaults[key] }
    } else if (__DEV__) {
      warn(`props default key "${key}" has no corresponding declaration.`)
    }
    if (opt && defaults[`__skip_${key}`]) {
      opt.skipFactory = true
    }
  }
  return props
}

/**
 * 作用：把多份 model 相关声明合并成一份统一结构。
 * @internal
 */
export function mergeModels(
  a: ComponentPropsOptions | EmitsOptions,
  b: ComponentPropsOptions | EmitsOptions,
): ComponentPropsOptions | EmitsOptions {
  // model 相关声明既可能是数组形态，也可能是对象形态，这里分别按各自最自然的方式合并。
  if (!a || !b) return a || b
  if (isArray(a) && isArray(b)) return a.concat(b)
  return extend({}, normalizePropsOrEmits(a), normalizePropsOrEmits(b))
}

/**
 * 作用：为 props 解构剩余项创建一个保持联动的代理对象。
 *
 * 对应编译产物形态：
 * - `const { a, ...rest } = defineProps()`
 * @internal
 */
export function createPropsRestProxy(
  props: any,
  excludedKeys: string[],
): Record<string, any> {
  // 不能直接浅拷贝，因为 `rest.xxx` 需要随着源 props 更新而同步变化。
  const ret: Record<string, any> = {}
  for (const key in props) {
    if (!excludedKeys.includes(key)) {
      Object.defineProperty(ret, key, {
        enumerable: true,
        get: () => props[key],
      })
    }
  }
  return ret
}

/**
 * 作用：让 `<script setup>` 在 `await` 前后仍能恢复正确的当前组件实例上下文。
 *
 * 返回值：
 * - 第一项：原始 awaitable
 * - 第二项：在 await 恢复点调用的上下文恢复函数
 * @internal
 */
export function withAsyncContext(getAwaitable: () => any): [any, () => void] {
  const ctx = getCurrentInstance()!
  const inSSRSetup = isInSSRComponentSetup
  if (__DEV__ && !ctx) {
    warn(
      `withAsyncContext called without active current instance. ` +
        `This is likely a bug.`,
    )
  }
  let awaitable = getAwaitable()
  // `await` 之前先把当前实例清掉，避免异步悬挂期间错误地污染到别的组件执行上下文。
  unsetCurrentInstance()
  if (inSSRSetup) {
    setInSSRSetupState(false)
  }

  const restore = () => {
    // 在 await 恢复点前重新把当前实例设回去，让后续组合式 API 还能拿到正确上下文。
    setCurrentInstance(ctx)
    if (inSSRSetup) {
      setInSSRSetupState(true)
    }
  }

  // Never restore a captured "prev" instance here: in concurrent async setup
  // continuations it may belong to a sibling component and cause leaks.
  // We only need to balance ctx.scope.on() from setCurrentInstance(ctx),
  // then clear global currentInstance for user microtasks.
  const cleanup = () => {
    // 恢复点跑完后要把全局 currentInstance 再清掉，避免泄漏到用户后续微任务里。
    if (getCurrentInstance() !== ctx) ctx.scope.off()
    unsetCurrentInstance()
    if (inSSRSetup) {
      setInSSRSetupState(false)
    }
  }

  if (isPromise(awaitable)) {
    awaitable = awaitable.catch(e => {
      restore()
      // Defer cleanup so the async function's catch continuation
      // still runs with the restored instance.
      Promise.resolve().then(() => Promise.resolve().then(cleanup))
      throw e
    })
  }
  return [
    awaitable,
    () => {
      restore()
      // Keep instance for the current continuation, then cleanup.
      Promise.resolve().then(cleanup)
    },
  ]
}
