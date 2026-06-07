/**
 * 文件作用：处理组件 props 的初始化、归一化和更新。
 *
 * 这份文件负责把外部传入的原始 props 解析成组件实例可直接使用的结构，
 * 并在更新阶段决定哪些字段应进入 props、哪些应进入 attrs。
 *
 * 它处在组件创建和组件更新两条链路上：
 * - 初始化时把 vnode props 变成实例上的 `props/attrs`
 * - 更新时根据 patch flag 和最新 vnode props 增量同步实例状态
 */

import {
  TriggerOpTypes,
  shallowReactive,
  shallowReadonly,
  toRaw,
  trigger,
} from '@vue-source/reactivity'
import {
  EMPTY_ARR,
  EMPTY_OBJ,
  type IfAny,
  PatchFlags,
  camelize,
  capitalize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isObject,
  isOn,
  isReservedProp,
  isString,
  isSymbol,
  makeMap,
  toRawType,
} from '@vue-source/shared'
import { warn } from './warning'
import {
  type ComponentInternalInstance,
  type ComponentOptions,
  type ConcreteComponent,
  type Data,
  setCurrentInstance,
} from './component'
import { isEmitListener } from './componentEmits'
import type { AppContext } from './apiCreateApp'
import { createPropsDefaultThis } from './compat/props'
import { isCompatEnabled, softAssertCompatEnabled } from './compat/compatConfig'
import { DeprecationTypes } from './compat/compatConfig'
import { shouldSkipAttr } from './compat/attrsFallthrough'
import { createInternalObject } from './internalObject'

export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[]

// 对象式 props 声明的标准结构：key -> Prop 配置。
export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}

export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>

type DefaultFactory<T> = (props: Data) => T | null | undefined

export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  required?: boolean
  // `default` 既可以是字面量默认值，也可以是根据当前 props 计算出的工厂函数。
  default?: D | DefaultFactory<D> | null | undefined | object
  validator?(value: unknown, props: Data): boolean
  /**
   * @internal
   */
  skipCheck?: boolean
  /**
   * @internal
   */
  skipFactory?: boolean
}

export type PropType<T> = PropConstructor<T> | (PropConstructor<T> | null)[]

type PropConstructor<T = any> =
  | { new (...args: any[]): T & {} }
  | { (): T }
  | PropMethod<T>

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined,
] // if is function with args, allowing non-required functions
  ? { new (): TConstructor; (): T; readonly prototype: TConstructor } // Create Function like constructor
  : never

type RequiredKeys<T> = {
  [K in keyof T]: T[K] extends
    | { required: true }
    | { default: any }
    // don't mark Boolean props as undefined
    | BooleanConstructor
    | { type: BooleanConstructor }
    ? T[K] extends { default: undefined | (() => undefined) }
      ? never
      : K
    : never
}[keyof T]

type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>

type DefaultKeys<T> = {
  [K in keyof T]: T[K] extends
    | { default: any }
    // Boolean implicitly defaults to false
    | BooleanConstructor
    | { type: BooleanConstructor }
    ? T[K] extends { type: BooleanConstructor; required: true } // not default if Boolean is marked as required
      ? never
      : K
    : never
}[keyof T]

type InferPropType<T, NullAsAny = true> = [T] extends [null]
  ? NullAsAny extends true
    ? any
    : null
  : [T] extends [{ type: null | true }]
    ? any // As TS issue https://github.com/Microsoft/TypeScript/issues/14829 // somehow `ObjectConstructor` when inferred from { (): T } becomes `any` // `BooleanConstructor` when inferred from PropConstructor(with PropMethod) becomes `Boolean`
    : [T] extends [ObjectConstructor | { type: ObjectConstructor }]
      ? Record<string, any>
      : [T] extends [BooleanConstructor | { type: BooleanConstructor }]
        ? boolean
        : [T] extends [DateConstructor | { type: DateConstructor }]
          ? Date
          : [T] extends [(infer U)[] | { type: (infer U)[] }]
            ? U extends DateConstructor
              ? Date | InferPropType<U, false>
              : InferPropType<U, false>
            : [T] extends [Prop<infer V, infer D>]
              ? unknown extends V
                ? keyof V extends never
                  ? IfAny<V, V, D>
                  : V
                : V
              : T

/**
 * Extract prop types from a runtime props options object.
 * The extracted types are **internal** - i.e. the resolved props received by
 * the component.
 * - Boolean props are always present
 * - Props with default values are always present
 *
 * To extract accepted props from the parent, use {@link ExtractPublicPropTypes}.
 */
export type ExtractPropTypes<O> = {
  // use `keyof Pick<O, RequiredKeys<O>>` instead of `RequiredKeys<O>` to
  // support IDE features
  [K in keyof Pick<O, RequiredKeys<O>>]: O[K] extends { default: any }
    ? Exclude<InferPropType<O[K]>, undefined>
    : InferPropType<O[K]>
} & {
  // use `keyof Pick<O, OptionalKeys<O>>` instead of `OptionalKeys<O>` to
  // support IDE features
  [K in keyof Pick<O, OptionalKeys<O>>]?: InferPropType<O[K]>
}

type PublicRequiredKeys<T> = {
  [K in keyof T]: T[K] extends { required: true } ? K : never
}[keyof T]

type PublicOptionalKeys<T> = Exclude<keyof T, PublicRequiredKeys<T>>

/**
 * Extract prop types from a runtime props options object.
 * The extracted types are **public** - i.e. the expected props that can be
 * passed to component.
 */
export type ExtractPublicPropTypes<O> = {
  [K in keyof Pick<O, PublicRequiredKeys<O>>]: InferPropType<O[K]>
} & {
  [K in keyof Pick<O, PublicOptionalKeys<O>>]?: InferPropType<O[K]>
}

enum BooleanFlags {
  shouldCast,
  shouldCastTrue,
}

// extract props which defined with default from prop options
export type ExtractDefaultPropTypes<O> = O extends object
  ? // use `keyof Pick<O, DefaultKeys<O>>` instead of `DefaultKeys<O>` to support IDE features
    { [K in keyof Pick<O, DefaultKeys<O>>]: InferPropType<O[K]> }
  : {}

type NormalizedProp = PropOptions & {
  [BooleanFlags.shouldCast]?: boolean
  [BooleanFlags.shouldCastTrue]?: boolean
}

// normalized value is a tuple of the actual normalized options
// and an array of prop keys that need value casting (booleans and defaults)
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

/**
 * 初始化组件 props 和 attrs。
 *
 * 主要功能：
 * - 根据组件 props 声明，把外部输入拆分成 `props` 和 `attrs`
 * - 确保已声明的 props 字段在实例上都有占位
 * - 对有状态组件把 props 包装成浅响应式对象
 */
export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  isStateful: number, // result of bitwise flag comparison
  isSSR = false,
): void {
  /**
   * 初始化组件实例上的 `props` 和 `attrs`。
   *
   * 主要功能：
   * - 把父组件传入的原始 props 拆成“声明过的 props”和“未声明的 attrs”
   * - 给所有声明过的 props 补齐键位，保证后续访问稳定
   * - 有状态组件上把 props 包成浅响应式对象
   *
   * 参数：
   * - `instance`：当前组件实例
   * - `rawProps`：父组件传入的原始 vnode props
   * - `isStateful`：是否为有状态组件
   * - `isSSR`：是否处于 SSR 初始化阶段
   */
  const props: Data = {}
  const attrs: Data = createInternalObject()

  instance.propsDefaults = Object.create(null)

  setFullProps(instance, rawProps, props, attrs)

  // ensure all declared prop keys are present
  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = undefined
    }
  }

  // validation
  if (__DEV__) {
    validateProps(rawProps || {}, props, instance)
  }

  if (isStateful) {
    // stateful
    instance.props = isSSR ? props : shallowReactive(props)
  } else {
    if (!instance.type.props) {
      // functional w/ optional props, props === attrs
      instance.props = attrs
    } else {
      // functional w/ declared props
      instance.props = props
    }
  }
  instance.attrs = attrs
}

function isInHmrContext(instance: ComponentInternalInstance | null) {
  /**
   * 判断当前组件是否处在 HMR 影响链路里。
   *
   * 只要父链上任意组件带有 `__hmrId`，
   * 这次 props 更新就应走更保守的完整对比路径。
   */
  // 只要父链上任意组件处于 HMR 体系里，这次 props 更新就应走更保守的完整对比路径。
  while (instance) {
    if (instance.type.__hmrId) return true
    instance = instance.parent
  }
}

/**
 * 在组件更新阶段同步 props / attrs。
 *
 * 主要功能：
 * - 优先利用 patchFlag 走更快的定向更新
 * - 必要时退回完整 props diff
 * - attrs 变化后触发 `$attrs` 相关依赖
 */
export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  rawPrevProps: Data | null,
  optimized: boolean,
): void {
  /**
   * 在组件更新阶段同步最新的 props / attrs。
   *
   * 主要功能：
   * - 编译优化场景下优先利用 patchFlag 只更新动态 props
   * - 必要时退回完整 props diff
   * - attrs 变化时触发依赖 `$attrs` 的渲染分支重新执行
   *
   * 所在链路：
   * - `renderer.ts -> updateComponentPreRender -> updateProps`
   */
  const {
    props,
    attrs,
    vnode: { patchFlag },
  } = instance
  // `rawCurrentProps` 表示当前实例上已有的 props 原始对象，用来做更新阶段对比和删除检测。
  const rawCurrentProps = toRaw(props)
  const [options] = instance.propsOptions
  let hasAttrsChanged = false

  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    !(__DEV__ && isInHmrContext(instance)) &&
    (optimized || patchFlag > 0) &&
    !(patchFlag & PatchFlags.FULL_PROPS)
  ) {
    if (patchFlag & PatchFlags.PROPS) {
      // Compiler-generated props & no keys change, just set the updated
      // the props.
      // `dynamicProps` 是编译阶段提取出来的“这次可能变化的 props 列表”。
      const propsToUpdate = instance.vnode.dynamicProps!
      for (let i = 0; i < propsToUpdate.length; i++) {
        let key = propsToUpdate[i]
        // skip if the prop key is a declared emit event listener
        if (isEmitListener(instance.emitsOptions, key)) {
          continue
        }
        // PROPS flag guarantees rawProps to be non-null
        const value = rawProps![key]
        if (options) {
          // attr / props separation was done on init and will be consistent
          // in this code path, so just check if attrs have it.
          if (hasOwn(attrs, key)) {
            if (value !== attrs[key]) {
              attrs[key] = value
              hasAttrsChanged = true
            }
          } else {
            const camelizedKey = camelize(key)
            props[camelizedKey] = resolvePropValue(
              options,
              rawCurrentProps,
              camelizedKey,
              value,
              instance,
              false /* isAbsent */,
            )
          }
        } else {
          if (__COMPAT__) {
            if (isOn(key) && key.endsWith('Native')) {
              key = key.slice(0, -6) // remove Native postfix
            } else if (shouldSkipAttr(key, instance)) {
              continue
            }
          }
          if (value !== attrs[key]) {
            attrs[key] = value
            hasAttrsChanged = true
          }
        }
      }
    }
  } else {
    // full props update.
    if (setFullProps(instance, rawProps, props, attrs)) {
      hasAttrsChanged = true
    }
    // in case of dynamic props, check if we need to delete keys from
    // the props object
    let kebabKey: string
    for (const key in rawCurrentProps) {
      if (
        !rawProps ||
        // for camelCase
        (!hasOwn(rawProps, key) &&
          // it's possible the original props was passed in as kebab-case
          // and converted to camelCase (#955)
          ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey)))
      ) {
        if (options) {
          if (
            rawPrevProps &&
            // for camelCase
            (rawPrevProps[key] !== undefined ||
              // for kebab-case
              rawPrevProps[kebabKey!] !== undefined)
          ) {
            props[key] = resolvePropValue(
              options,
              rawCurrentProps,
              key,
              undefined,
              instance,
              true /* isAbsent */,
            )
          }
        } else {
          delete props[key]
        }
      }
    }
    // in the case of functional component w/o props declaration, props and
    // attrs point to the same object so it should already have been updated.
    if (attrs !== rawCurrentProps) {
      for (const key in attrs) {
        if (
          !rawProps ||
          (!hasOwn(rawProps, key) &&
            (!__COMPAT__ || !hasOwn(rawProps, key + 'Native')))
        ) {
          delete attrs[key]
          hasAttrsChanged = true
        }
      }
    }
  }

  // trigger updates for $attrs in case it's used in component slots
  if (hasAttrsChanged) {
    trigger(instance.attrs, TriggerOpTypes.SET, '')
  }

  if (__DEV__) {
    validateProps(rawProps || {}, props, instance)
  }
}

/**
 * 完整解析一轮原始 props。
 *
 * 主要功能：
 * - 把已声明字段写入 `props`
 * - 把未声明字段写入 `attrs`
 * - 对需要布尔转换 / 默认值处理的字段延后统一解析
 *
 * 返回值：
 * - 返回 attrs 是否发生变化
 */
function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
  attrs: Data,
) {
  // `hasAttrsChanged` 用来通知上层：这一轮完整归一化是否改动了 attrs。
  // `options` 是归一化后的 props 声明，`needCastKeys` 记录需要延后做默认值/Boolean 处理的 key。
  const [options, needCastKeys] = instance.propsOptions
  let hasAttrsChanged = false
  // `rawCastValues` 暂存那些需要稍后再做 Boolean / default 解析的原始值。
  let rawCastValues: Data | undefined
  if (rawProps) {
    for (let key in rawProps) {
      // key, ref are reserved and never passed down
      if (isReservedProp(key)) {
        continue
      }

      if (__COMPAT__) {
        if (key.startsWith('onHook:')) {
          softAssertCompatEnabled(
            DeprecationTypes.INSTANCE_EVENT_HOOKS,
            instance,
            key.slice(2).toLowerCase(),
          )
        }
        if (key === 'inline-template') {
          continue
        }
      }

      // `value` 是父组件本次直接传进来的原始值，尚未经过任何运行时修正。
      const value = rawProps[key]
      // prop option names are camelized during normalization, so to support
      // kebab -> camel conversion here we need to camelize the key.
      // `camelKey` 负责把模板里的 kebab-case 输入折叠成运行时统一使用的 camelCase。
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          props[camelKey] = value
        } else {
          ;(rawCastValues || (rawCastValues = {}))[camelKey] = value
        }
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        // Any non-declared (either as a prop or an emitted event) props are put
        // into a separate `attrs` object for spreading. Make sure to preserve
        // original key casing
        if (__COMPAT__) {
          if (isOn(key) && key.endsWith('Native')) {
            key = key.slice(0, -6) // remove Native postfix
          } else if (shouldSkipAttr(key, instance)) {
            continue
          }
        }
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value
          hasAttrsChanged = true
        }
      }
    }
  }

  if (needCastKeys) {
    // 这批 key 需要基于“当前整组 props 状态”再做一次收口，
    // 因为默认值工厂和 Boolean casting 都不适合在第一次遍历时直接拍板。
    const rawCurrentProps = toRaw(props)
    const castValues = rawCastValues || EMPTY_OBJ
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i]
      props[key] = resolvePropValue(
        options!,
        rawCurrentProps,
        key,
        castValues[key],
        instance,
        !hasOwn(castValues, key),
      )
    }
  }

  return hasAttrsChanged
}

/**
 * 解析单个 prop 的最终值。
 *
 * 主要功能：
 * - 处理默认值和默认值工厂
 * - 处理 Boolean 类型强制转换
 * - 在自定义元素场景下把解析后的值同步回宿主元素
 */
function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance,
  isAbsent: boolean,
) {
  // 这个函数负责把某个 prop 从“原始传入值”收敛成“实例最终可读值”。
  // 主要处理三件事：默认值、默认值工厂缓存、Boolean 强制转换。
  // `opt` 是当前 prop 对应的归一化配置。
  const opt = options[key]
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default')
    // default values
    if (hasDefault && value === undefined) {
      // `defaultValue` 既可能是普通字面量，也可能是依赖 props 的工厂函数。
      const defaultValue = opt.default
      if (
        opt.type !== Function &&
        !opt.skipFactory &&
        isFunction(defaultValue)
      ) {
        // `propsDefaults` 用来缓存默认值工厂结果，避免同一实例重复求值。
        const { propsDefaults } = instance
        if (key in propsDefaults) {
          value = propsDefaults[key]
        } else {
          const reset = setCurrentInstance(instance)
          value = propsDefaults[key] = defaultValue.call(
            __COMPAT__ &&
              isCompatEnabled(DeprecationTypes.PROPS_DEFAULT_THIS, instance)
              ? createPropsDefaultThis(instance, props, key)
              : null,
            props,
          )
          reset()
        }
      } else {
        value = defaultValue
      }
      // #9006 reflect default value on custom element
      if (instance.ce) {
        instance.ce._setProp(key, value)
      }
    }
    // boolean casting
    if (opt[BooleanFlags.shouldCast]) {
      if (isAbsent && !hasDefault) {
        value = false
      } else if (
        opt[BooleanFlags.shouldCastTrue] &&
        (value === '' || value === hyphenate(key))
      ) {
        value = true
      }
    }
  }
  return value
}

const mixinPropsCache = new WeakMap<ConcreteComponent, NormalizedPropsOptions>()

/**
 * 把组件 props 选项归一化成运行时可直接消费的结构。
 *
 * 主要功能：
 * - 合并 mixin / extends 带来的 props
 * - 把数组写法和对象写法统一收口
 * - 记录哪些 props 需要布尔值转换或默认值求值
 * - 把结果缓存到 appContext，避免重复归一化
 */
export function normalizePropsOptions(
  comp: ConcreteComponent,
  appContext: AppContext,
  asMixin = false,
): NormalizedPropsOptions {
  const cache =
    __FEATURE_OPTIONS_API__ && asMixin ? mixinPropsCache : appContext.propsCache
  const cached = cache.get(comp)
  if (cached) {
    return cached
  }

  const raw = comp.props
  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []

  // apply mixin/extends props
  let hasExtends = false
  if (__FEATURE_OPTIONS_API__ && !isFunction(comp)) {
    const extendProps = (raw: ComponentOptions) => {
      if (__COMPAT__ && isFunction(raw)) {
        raw = raw.options
      }
      hasExtends = true
      const [props, keys] = normalizePropsOptions(raw, appContext, true)
      extend(normalized, props)
      if (keys) needCastKeys.push(...keys)
    }
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps)
    }
    if (comp.extends) {
      extendProps(comp.extends)
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps)
    }
  }

  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, EMPTY_ARR as any)
    }
    return EMPTY_ARR as any
  }

  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else if (raw) {
    if (__DEV__ && !isObject(raw)) {
      warn(`invalid props options`, raw)
    }
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt))
        const propType = prop.type
        let shouldCast = false
        let shouldCastTrue = true

        if (isArray(propType)) {
          for (let index = 0; index < propType.length; ++index) {
            const type = propType[index]
            const typeName = isFunction(type) && type.name

            if (typeName === 'Boolean') {
              shouldCast = true
              break
            } else if (typeName === 'String') {
              // If we find `String` before `Boolean`, e.g. `[String, Boolean]`,
              // we need to handle the casting slightly differently. Props
              // passed as `<Comp checked="">` or `<Comp checked="checked">`
              // will either be treated as strings or converted to a boolean
              // `true`, depending on the order of the types.
              shouldCastTrue = false
            }
          }
        } else {
          shouldCast = isFunction(propType) && propType.name === 'Boolean'
        }

        prop[BooleanFlags.shouldCast] = shouldCast
        prop[BooleanFlags.shouldCastTrue] = shouldCastTrue
        // if the prop needs boolean casting or default value
        if (shouldCast || hasOwn(prop, 'default')) {
          needCastKeys.push(normalizedKey)
        }
      }
    }
  }

  const res: NormalizedPropsOptions = [normalized, needCastKeys]
  if (isObject(comp)) {
    cache.set(comp, res)
  }
  return res
}

function validatePropName(key: string) {
  /**
   * 校验 props 名是否合法。
   *
   * 规则：
   * - 不能以 `$` 开头
   * - 不能命中运行时保留字段
   */
  // 以 `$` 开头或命中保留字段的名字不能作为用户 props 名。
  if (key[0] !== '$' && !isReservedProp(key)) {
    return true
  } else if (__DEV__) {
    warn(`Invalid prop name: "${key}" is a reserved property.`)
  }
  return false
}

// dev only
// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor: Prop<any> | null): string {
  // 这里尽量不走 `Function.prototype.toString` 和正则，减少跨 iframe / vm 场景的不稳定性。
  // Early return for null to avoid unnecessary computations
  if (ctor === null) {
    return 'null'
  }

  // Avoid using regex for common cases by checking the type directly
  if (typeof ctor === 'function') {
    // Using name property to avoid converting function to string
    return ctor.name || ''
  } else if (typeof ctor === 'object') {
    // Attempting to directly access constructor name if possible
    const name = ctor.constructor && ctor.constructor.name
    return name || ''
  }

  // Fallback for other types (though they're less likely to have meaningful names here)
  return ''
}

/**
 * 作用：在开发环境校验当前组件的整组 props。
 *
 * 它会遍历所有声明过的 props，
 * 并把“原始输入是否缺失”与“归一化后最终值”一起交给单项校验函数判断。
 */
function validateProps(
  rawProps: Data,
  props: Data,
  instance: ComponentInternalInstance,
) {
  // 校验时既要看原始传入值，也要看归一化后的 props，
  // 因为 default / Boolean casting 都可能改变最终值。
  // `resolvedValues` 是最终已经过默认值 / Boolean casting 的 props 结果。
  const resolvedValues = toRaw(props)
  const options = instance.propsOptions[0]
  // `camelizePropsKey` 用来判断某个声明 prop 这次是否根本没有被传入。
  const camelizePropsKey = Object.keys(rawProps).map(key => camelize(key))
  for (const key in options) {
    let opt = options[key]
    if (opt == null) continue
    validateProp(
      key,
      resolvedValues[key],
      opt,
      __DEV__ ? shallowReadonly(resolvedValues) : resolvedValues,
      !camelizePropsKey.includes(key),
    )
  }
}

/**
 * 作用：校验单个 prop 的合法性。
 *
 * 检查内容：
 * - required
 * - type
 * - validator
 */
function validateProp(
  name: string,
  value: unknown,
  prop: PropOptions,
  props: Data,
  isAbsent: boolean,
) {
  // 单个 prop 校验顺序：
  // 1. required
  // 2. 空值快速返回
  // 3. type 检查
  // 4. validator 自定义校验
  const { type, required, validator, skipCheck } = prop
  // required!
  if (required && isAbsent) {
    warn('Missing required prop: "' + name + '"')
    return
  }
  // missing but optional
  if (value == null && !required) {
    return
  }
  // type check
  if (type != null && type !== true && !skipCheck) {
    let isValid = false
    const types = isArray(type) ? type : [type]
    const expectedTypes = []
    // value is valid as long as one of the specified types match
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i])
      expectedTypes.push(expectedType || '')
      isValid = valid
    }
    if (!isValid) {
      warn(getInvalidTypeMessage(name, value, expectedTypes))
      return
    }
  }
  // custom validator
  if (validator && !validator(value, props)) {
    warn('Invalid prop: custom validator check failed for prop "' + name + '".')
  }
}

const isSimpleType = /*@__PURE__*/ makeMap(
  'String,Number,Boolean,Function,Symbol,BigInt',
)

type AssertionResult = {
  valid: boolean
  expectedType: string
}

/**
 * 作用：判断一个运行时值是否满足某个声明类型构造器。
 */
function assertType(
  value: unknown,
  type: PropConstructor | null,
): AssertionResult {
  // 返回“是否匹配 + 期望类型名”，供上层拼更友好的报错文案。
  let valid
  const expectedType = getType(type)
  if (expectedType === 'null') {
    valid = value === null
  } else if (isSimpleType(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof (type as PropConstructor)
    }
  } else if (expectedType === 'Object') {
    valid = isObject(value)
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else {
    valid = value instanceof (type as PropConstructor)
  }
  return {
    valid,
    expectedType,
  }
}

/**
 * 作用：生成 props 类型校验失败时的人类可读报错文案。
 */
function getInvalidTypeMessage(
  name: string,
  value: unknown,
  expectedTypes: string[],
): string {
  // 尽量把“期望类型 / 实际类型 / 实际值”都拼出来，降低定位成本。
  if (expectedTypes.length === 0) {
    return (
      `Prop type [] for prop "${name}" won't match anything.` +
      ` Did you mean to use type Array instead?`
    )
  }
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(' | ')}`
  // 这里默认用第一个期望类型作为主展示类型，便于拼接更自然的报错文案。
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isCoercible(expectedType, receivedType)
  ) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

/**
 * 作用：把值格式化成适合放进报错里的文本表现。
 */
function styleValue(value: unknown, type: string): string {
  // 报错文案里字符串要补引号，Symbol 要走 toString，其余直接转文本。
  if (isSymbol(value)) {
    return value.toString()
  } else if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

/**
 * 作用：判断某个类型名是否值得在报错中直接展示具体值。
 */
function isExplicable(type: string): boolean {
  // 这些基础类型适合在报错里直接带上具体值。
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => type.toLowerCase() === elem)
}

/**
 * 作用：判断两类类型之间是否适合做值级对比展示。
 */
function isCoercible(...args: string[]): boolean {
  // 用于判断报错里是否值得展示“期望值/实际值”的值级对比。
  return args.every(elem => {
    const value = elem.toLowerCase()
    return value !== 'boolean' && value !== 'symbol'
  })
}
