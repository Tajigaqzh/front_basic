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

/**
 * 给运行时误用编译宏的场景输出统一提示。
 *
 * 这类 API 正常应该在编译阶段被抹掉，
 * 因此运行时真正走到这里通常意味着使用位置不对或构建链有问题。
 */
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
  /**
   * `<script setup>` 编译宏占位符：声明 props。
   *
   * 正常情况下：
   * - 编译器会把它改写成运行时 props 定义或类型信息
   * - 最终不会在浏览器里真的执行到这里
   */
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
  /**
   * `<script setup>` 编译宏占位符：声明 emits。
   *
   * 运行时真正落到这里通常表示编译阶段没有正确抹除该宏调用。
   */
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
  /**
   * `<script setup>` 编译宏占位符：声明对外暴露的实例成员。
   */
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
  /**
   * `<script setup>` 编译宏占位符：补充额外组件选项。
   *
   * 典型场景：
   * - `inheritAttrs`
   * - 其他组合式 API 不方便直接表达的选项
   */
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
  /**
   * `<script setup>` 编译宏占位符：仅用于给 IDE/TS 提供 slots 类型提示。
   */
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
  /**
   * `<script setup>` 编译宏占位符：声明 `v-model` 对应的 prop + emit。
   *
   * 正常链路里会被编译器改写成：
   * - props 声明
   * - emits 声明
   * - `useModel()` 调用
   */
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
  /**
   * `<script setup>` 编译宏占位符：给类型式 `defineProps` 补默认值。
   *
   * 运行时几乎不做实际逻辑，
   * 真正的默认值合并通常由编译产物转成 `mergeDefaults()` 调用完成。
   */
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
  /**
   * 读取当前组件 setup 上下文里的 `slots`。
   *
   * 本质上只是从惰性创建的 `setupContext` 上取字段，
   * 但它把 `<script setup>` / 组合式 API 访问入口统一成了稳定的运行时 helper。
   */
  return getContext('useSlots').slots
}

/**
 * 作用：返回当前组件 setup 上下文里的 `attrs`。
 */
export function useAttrs(): SetupContext['attrs'] {
  /**
   * 读取当前组件 setup 上下文里的 `attrs`。
   *
   * 返回值会与组件实例上的 attrs 保持联动，
   * 供组合式 API 在 setup 中访问未声明 props 的透传属性。
   */
  return getContext('useAttrs').attrs
}

function getContext(calledFunctionName: string): SetupContext {
  /**
   * 获取当前组件的 setupContext。
   *
   * 主要功能：
   * - 确保当前确实存在活跃组件实例
   * - 按需惰性创建 `setupContext`
   * - 让 `useSlots()` / `useAttrs()` 等 helper 共用同一入口
   */
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
  /**
   * 把 props / emits 的数组写法统一转成对象写法。
   *
   * 这样后续合并逻辑就不必分别处理两套结构。
   */
  // 数组写法统一转对象写法，便于 props / emits 后续共用一套合并与归一化逻辑。
  return isArray(props)
    ? props.reduce(
        // 数组项只表达“声明了这个 key”，因此值先用 null 占位，后续再按对象结构统一处理。
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
    // `__skip_xxx` 是编译器生成的控制位，不是用户真正声明的 props 名。
    if (key.startsWith('__skip')) continue
    // `opt` 表示当前默认值目标对应的 props 配置项，可能原本是数组/函数/对象/null 中任意一种。
    let opt = props[key]
    if (opt) {
      if (isArray(opt) || isFunction(opt)) {
        // 简写写法必须先转成标准对象，才能把 default 正式挂进去。
        opt = props[key] = { type: opt, default: defaults[key] }
      } else {
        opt.default = defaults[key]
      }
    } else if (opt === null) {
      // 数组声明归一化后会是 null，这里补成仅含 default 的对象即可继续复用统一逻辑。
      opt = props[key] = { default: defaults[key] }
    } else if (__DEV__) {
      warn(`props default key "${key}" has no corresponding declaration.`)
    }
    if (opt && defaults[`__skip_${key}`]) {
      // `skipFactory` 告诉 props 默认值求值逻辑：这里的函数值是“默认值本身”，不是工厂函数。
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
  /**
   * 合并两份 model 相关声明。
   *
   * 常见来源：
   * - 编译生成的 `defineModel`
   * - 用户原本手写的 props / emits
  */
  // model 相关声明既可能是数组形态，也可能是对象形态，这里分别按各自最自然的方式合并。
  if (!a || !b) return a || b
  // 两边都是数组时，保留原始声明语义直接拼接即可。
  if (isArray(a) && isArray(b)) return a.concat(b)
  // 对象形态先归一化后浅合并，后者同名键会覆盖前者。
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
        // 通过 getter 直接转发回源 props，保证 rest 对象始终反映最新值。
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
  /**
   * 让异步 setup 片段在 `await` 前后仍能拿回正确的当前组件实例。
   *
   * 主要功能：
   * - 在 `await` 挂起前清空全局 currentInstance
   * - 在恢复点重新设回当前组件实例
   * - 恢复完当前 continuation 后再及时清理，避免实例泄漏到别的微任务
  */
  const ctx = getCurrentInstance()!
  // SSR 下还要同步维护 setup 状态位，否则服务端异步 setup 恢复点会丢上下文信息。
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
    // 如果并发 continuation 已把 currentInstance 切走，这里只负责平衡当前 ctx 对应的 scope 计数。
    if (getCurrentInstance() !== ctx) ctx.scope.off()
    unsetCurrentInstance()
    if (inSSRSetup) {
      setInSSRSetupState(false)
    }
  }

  if (isPromise(awaitable)) {
    awaitable = awaitable.catch(e => {
      restore()
      // catch continuation 仍可能依赖当前实例，因此清理动作要再后延一个微任务。
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
      // 正常 continuation 也要等当前这段同步逻辑跑完，再撤掉恢复的实例上下文。
      // Keep instance for the current continuation, then cleanup.
      Promise.resolve().then(cleanup)
    },
  ]
}
