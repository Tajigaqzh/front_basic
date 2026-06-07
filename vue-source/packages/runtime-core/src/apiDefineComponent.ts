/**
 * 文件作用：提供 `defineComponent` 的类型与运行时封装。
 *
 * 这份文件的重点不是复杂逻辑，而是让组件定义在类型层和运行时层都能被统一处理。
 */

import type {
  ComponentInjectOptions,
  ComponentOptions,
  ComponentOptionsBase,
  ComponentOptionsMixin,
  ComponentProvideOptions,
  ComputedOptions,
  MethodOptions,
  RenderFunction,
} from './componentOptions'
import type {
  AllowedComponentProps,
  Component,
  ComponentCustomProps,
  GlobalComponents,
  GlobalDirectives,
  SetupContext,
} from './component'
import type {
  ComponentObjectPropsOptions,
  ComponentPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
} from './componentProps'
import type {
  EmitsOptions,
  EmitsToProps,
  TypeEmitsToOptions,
} from './componentEmits'
import { type IsKeyValues, extend, isFunction } from '@vue-source/shared'
import type { VNodeProps } from './vnode'
import type {
  ComponentPublicInstanceConstructor,
  CreateComponentPublicInstanceWithMixins,
} from './componentPublicInstance'
import type { SlotsType } from './componentSlots'
import type { Directive } from './directives'
import type { ComponentTypeEmits } from './apiSetupHelpers'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

// 根据 props 选项和 emits 选项推导出组件真正接收到的 props 形状。
type ResolveProps<PropsOrPropOptions, E extends EmitsOptions> = Readonly<
  PropsOrPropOptions extends ComponentPropsOptions
    ? ExtractPropTypes<PropsOrPropOptions>
    : PropsOrPropOptions
> &
  ({} extends E ? {} : EmitsToProps<E>)

export type DefineComponent<
  PropsOrPropOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  PP = PublicProps,
  Props = ResolveProps<PropsOrPropOptions, E>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  MakeDefaultsOptional extends boolean = true,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
> = ComponentPublicInstanceConstructor<
  CreateComponentPublicInstanceWithMixins<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    PP,
    Defaults,
    MakeDefaultsOptional,
    {},
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    TypeRefs,
    TypeEl
  >
> &
  ComponentOptionsBase<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    Defaults,
    {},
    string,
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    Provide
  > &
  PP

export type DefineSetupFnComponent<
  P extends Record<string, any>,
  E extends EmitsOptions = {},
  S extends SlotsType = SlotsType,
  Props = P & EmitsToProps<E>,
  PP = PublicProps,
> = new (
  props: Props & PP,
) => CreateComponentPublicInstanceWithMixins<
  Props,
  {},
  {},
  {},
  {},
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  E,
  PP,
  {},
  false,
  {},
  S
>

// 把 props 与 emits 对应出来的事件回调 props 合并成最终 props 形状。
type ToResolvedProps<Props, Emits extends EmitsOptions> = Readonly<Props> &
  Readonly<EmitsToProps<Emits>>

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
/**
 * 作用：声明 `defineComponent(setup, options?)` 这种直接 setup 写法的类型重载。
 */
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {},
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>,
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: (keyof NoInfer<Props>)[]
    emits?: E | EE[]
    slots?: S
  },
): DefineSetupFnComponent<Props, E, S>
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {},
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>,
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: ComponentObjectPropsOptions<Props>
    emits?: E | EE[]
    slots?: S
  },
): DefineSetupFnComponent<Props, E, S>

// overload 2: defineComponent with options object, infer props from options
/**
 * 作用：声明 `defineComponent(options)` 这种对象写法的类型重载。
 *
 * 这一大组泛型的主要职责是把 props、emits、data、computed、methods、
 * mixins、extends、slots 等信息折叠成最终实例类型。
 */
export function defineComponent<
  // props
  TypeProps,
  RuntimePropsOptions extends ComponentObjectPropsOptions =
    ComponentObjectPropsOptions,
  RuntimePropsKeys extends string = string,
  // emits
  TypeEmits extends ComponentTypeEmits = {},
  RuntimeEmitsOptions extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  // other options
  Data = {},
  SetupBindings = {},
  Computed extends ComputedOptions = {},
  Methods extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  InjectOptions extends ComponentInjectOptions = {},
  InjectKeys extends string = string,
  Slots extends SlotsType = {},
  LocalComponents extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  // resolved types
  ResolvedEmits extends EmitsOptions = {} extends RuntimeEmitsOptions
    ? TypeEmitsToOptions<TypeEmits>
    : RuntimeEmitsOptions,
  InferredProps = IsKeyValues<TypeProps> extends true
    ? TypeProps
    : string extends RuntimePropsKeys
      ? ComponentObjectPropsOptions extends RuntimePropsOptions
        ? {}
        : ExtractPropTypes<RuntimePropsOptions>
      : { [key in RuntimePropsKeys]?: any },
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
>(
  options: {
    props?: (RuntimePropsOptions & ThisType<void>) | RuntimePropsKeys[]
    /**
     * @private for language-tools use only
     */
    __typeProps?: TypeProps
    /**
     * @private for language-tools use only
     */
    __typeEmits?: TypeEmits
    /**
     * @private for language-tools use only
     */
    __typeRefs?: TypeRefs
    /**
     * @private for language-tools use only
     */
    __typeEl?: TypeEl
  } & ComponentOptionsBase<
    ToResolvedProps<InferredProps, ResolvedEmits>,
    SetupBindings,
    Data,
    Computed,
    Methods,
    Mixin,
    Extends,
    RuntimeEmitsOptions,
    RuntimeEmitsKeys,
    {}, // Defaults
    InjectOptions,
    InjectKeys,
    Slots,
    LocalComponents,
    Directives,
    Exposed,
    Provide
  > &
    ThisType<
      CreateComponentPublicInstanceWithMixins<
        ToResolvedProps<InferredProps, ResolvedEmits>,
        SetupBindings,
        Data,
        Computed,
        Methods,
        Mixin,
        Extends,
        ResolvedEmits,
        {},
        {},
        false,
        InjectOptions,
        Slots,
        LocalComponents,
        Directives,
        string
      >
    >,
): DefineComponent<
  InferredProps,
  SetupBindings,
  Data,
  Computed,
  Methods,
  Mixin,
  Extends,
  ResolvedEmits,
  RuntimeEmitsKeys,
  PublicProps,
  ToResolvedProps<InferredProps, ResolvedEmits>,
  ExtractDefaultPropTypes<RuntimePropsOptions>,
  Slots,
  LocalComponents,
  Directives,
  Exposed,
  Provide,
  // MakeDefaultsOptional - if TypeProps is provided, set to false to use
  // user props types verbatim
  unknown extends TypeProps ? true : false,
  TypeRefs,
  TypeEl
>

// implementation, close to no-op
/*@__NO_SIDE_EFFECTS__*/
export function defineComponent(
  options: unknown,
  extraOptions?: ComponentOptions,
) {
  /**
   * `defineComponent` 的运行时实现。
   *
   * 运行时层面它非常薄，主要职责只有两件事：
   * - 传入的是 `setup` 函数时，把它和附加选项包装成标准组件对象
   * - 传入的是组件选项对象时，原样返回
   *
   * 真正复杂的部分主要发生在类型系统里：
   * - props 推导
   * - emits 推导
   * - this / slots / expose / refs 等实例类型拼装
   */
  // 运行时实现非常薄：
  // - 直接传 setup 函数时，需要和附加选项合并成标准组件对象
  // - 传对象时原样返回
  return isFunction(options)
    ? // #8236: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /*@__PURE__*/ (() =>
        extend({ name: options.name }, extraOptions, { setup: options }))()
    : options
}
