/**
 * 文件作用：定义 VNode 结构，并实现 VNode 创建、克隆和 children 归一化。
 *
 * VNode 是 render 的直接结果，也是 patch 的直接输入，
 * 所以这份文件相当于整个渲染器的数据模型入口。
 *
 * 一句话理解：
 * - 模板 / render 函数先产出这里定义的 VNode
 * - 渲染器再根据这些 VNode 决定该创建什么、更新什么、卸载什么
 */

import {
  EMPTY_ARR,
  PatchFlags,
  ShapeFlags,
  SlotFlags,
  extend,
  isArray,
  isFunction,
  isModelListener,
  isObject,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
} from '@vue-source/shared'
import {
  type ClassComponent,
  type Component,
  type ComponentInternalInstance,
  type ConcreteComponent,
  type Data,
  isClassComponent,
} from './component'
import type { RawSlots } from './componentSlots'
import {
  type ReactiveFlags,
  type Ref,
  isProxy,
  isRef,
  toRaw,
} from '@vue-source/reactivity'
import type { AppContext } from './apiCreateApp'
import {
  type Suspense,
  type SuspenseBoundary,
  type SuspenseImpl,
  isSuspense,
} from './components/Suspense'
import type { DirectiveBinding } from './directives'
import {
  type TransitionHooks,
  setTransitionHooks,
} from './components/BaseTransition'
import { warn } from './warning'
import {
  type Teleport,
  type TeleportImpl,
  isTeleport,
} from './components/Teleport'
import {
  currentRenderingInstance,
  currentScopeId,
} from './componentRenderContext'
import type { RendererElement, RendererNode } from './renderer'
import { NULL_DYNAMIC_COMPONENT } from './helpers/resolveAssets'
import { hmrDirtyComponents } from './hmr'
import { convertLegacyComponent } from './compat/component'
import { convertLegacyVModelProps } from './compat/componentVModel'
import { defineLegacyVNodeProperties } from './compat/renderFn'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import type { ComponentPublicInstance } from './componentPublicInstance'
import { isInternalObject } from './internalObject'

/**
 * Fragment 表示“没有额外包裹元素的一组子节点”。
 *
 * 作用：
 * - 让组件可以返回多个根节点
 * - 让渲染器在 diff 时把这一组子节点当成一个逻辑单元处理
 */
export const Fragment = Symbol.for('v-fgt') as any as {
  __isFragment: true
  new (): {
    $props: VNodeProps
  }
}

/**
 * 文本节点类型标记。
 *
 * 作用：
 * - 告诉渲染器当前 VNode 对应的是纯文本节点
 */
export const Text: unique symbol = Symbol.for('v-txt')

/**
 * 注释节点类型标记。
 *
 * 作用：
 * - 用于占位、边界锚点、条件分支空节点等场景
 */
export const Comment: unique symbol = Symbol.for('v-cmt')

/**
 * 静态节点类型标记。
 *
 * 作用：
 * - 对应编译阶段提升出来的静态内容
 * - 渲染器可以针对这类节点走更激进的复用路径
 */
export const Static: unique symbol = Symbol.for('v-stc')

// VNode 的 `type` 可能是原生标签、内置特殊类型、组件、现成 vnode，或动态组件哨兵。
export type VNodeTypes =
  | string
  | VNode
  | Component
  | typeof Text
  | typeof Static
  | typeof Comment
  | typeof Fragment
  | typeof Teleport
  | typeof TeleportImpl
  | typeof Suspense
  | typeof SuspenseImpl

export type VNodeRef =
  | string
  | Ref
  | ((
      ref: Element | ComponentPublicInstance | null,
      refs: Record<string, any>,
    ) => void)

export type VNodeNormalizedRefAtom = {
  /**
   * component instance
   */
  i: ComponentInternalInstance
  /**
   * Actual ref
   */
  r: VNodeRef
  /**
   * setup ref key
   */
  k?: string
  /**
   * refInFor marker
   */
  f?: boolean
}

export type VNodeNormalizedRef =
  | VNodeNormalizedRefAtom
  | VNodeNormalizedRefAtom[]

type VNodeMountHook = (vnode: VNode) => void
type VNodeUpdateHook = (vnode: VNode, oldVNode: VNode) => void
export type VNodeHook =
  | VNodeMountHook
  | VNodeUpdateHook
  | VNodeMountHook[]
  | VNodeUpdateHook[]

// https://github.com/microsoft/TypeScript/issues/33099
export type VNodeProps = {
  key?: PropertyKey
  ref?: VNodeRef
  ref_for?: boolean
  ref_key?: string

  // vnode hooks
  onVnodeBeforeMount?: VNodeMountHook | VNodeMountHook[]
  onVnodeMounted?: VNodeMountHook | VNodeMountHook[]
  onVnodeBeforeUpdate?: VNodeUpdateHook | VNodeUpdateHook[]
  onVnodeUpdated?: VNodeUpdateHook | VNodeUpdateHook[]
  onVnodeBeforeUnmount?: VNodeMountHook | VNodeMountHook[]
  onVnodeUnmounted?: VNodeMountHook | VNodeMountHook[]
}

type VNodeChildAtom =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | void

export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren

export type VNodeNormalizedChildren =
  | string
  | VNodeArrayChildren
  | RawSlots
  | null

/**
 * VNode 是 Vue 渲染器内部的统一节点描述对象。
 *
 * 主要功能：
 * - 用一份统一结构描述元素、组件、Fragment、Teleport、Suspense 等不同节点
 * - 作为 `render()` 的输出以及 `patch()` 的输入
 *
 * 关键字段：
 * - `type`：节点类型
 * - `props`：属性和事件描述
 * - `children`：子节点描述
 * - `shapeFlag`：节点大类位标记
 * - `el`：真实宿主节点引用
 * - `component`：如果是组件节点，这里会指向组件实例
 */
export interface VNode<
  HostNode = RendererNode,
  HostElement = RendererElement,
  ExtraProps = { [key: string]: any },
> {
  /**
   * @internal
   */
  __v_isVNode: true

  /**
   * @internal
   */
  [ReactiveFlags.SKIP]: true

  type: VNodeTypes
  props: (VNodeProps & ExtraProps) | null
  key: PropertyKey | null
  ref: VNodeNormalizedRef | null
  /**
   * SFC only. This is assigned on vnode creation using currentScopeId
   * which is set alongside currentRenderingInstance.
   */
  scopeId: string | null
  /**
   * SFC only. This is assigned to:
   * - Slot fragment vnodes with :slotted SFC styles.
   * - Component vnodes (during patch/hydration) so that its root node can
   *   inherit the component's slotScopeIds
   * @internal
   */
  slotScopeIds: string[] | null
  children: VNodeNormalizedChildren
  component: ComponentInternalInstance | null
  dirs: DirectiveBinding[] | null
  transition: TransitionHooks<HostElement> | null

  // DOM
  el: HostNode | null
  placeholder: HostNode | null // async component el placeholder
  anchor: HostNode | null // fragment anchor
  target: HostElement | null // teleport target
  targetStart: HostNode | null // teleport target start anchor
  targetAnchor: HostNode | null // teleport target anchor
  /**
   * number of elements contained in a static vnode
   * @internal
   */
  staticCount: number

  // suspense
  suspense: SuspenseBoundary | null
  /**
   * @internal
   */
  ssContent: VNode | null
  /**
   * @internal
   */
  ssFallback: VNode | null

  // optimization only
  shapeFlag: number
  patchFlag: number
  /**
   * @internal
   */
  dynamicProps: string[] | null
  /**
   * @internal
   */
  dynamicChildren: (VNode[] & { hasOnce?: boolean }) | null

  // application root node only
  appContext: AppContext | null

  /**
   * @internal lexical scope owner instance
   */
  ctx: ComponentInternalInstance | null

  /**
   * @internal attached by v-memo
   */
  memo?: any[]
  /**
   * @internal index for cleaning v-memo cache
   */
  cacheIndex?: number
  /**
   * @internal __COMPAT__ only
   */
  isCompatRoot?: true
  /**
   * @internal custom element interception hook
   */
  ce?: (instance: ComponentInternalInstance) => void
}

// Since v-if and v-for are the two possible ways node structure can dynamically
// change, once we consider v-if branches and each v-for fragment a block, we
// can divide a template into nested blocks, and within each block the node
// structure would be stable. This allows us to skip most children diffing
// and only worry about the dynamic nodes (indicated by patch flags).
export const blockStack: VNode['dynamicChildren'][] = []
export let currentBlock: VNode['dynamicChildren'] = null
// `blockStack` / `currentBlock` 共同维护“当前正在收集哪一个 block 的动态子节点”。
// 编译器会把模板切成若干 block，运行时只把真正需要 patch 的节点放进这里，
// 这样更新时就不必全量递归扫描整个子树。

/**
 * Open a block.
 * This must be called before `createBlock`. It cannot be part of `createBlock`
 * because the children of the block are evaluated before `createBlock` itself
 * is called. The generated code typically looks like this:
 *
 * ```js
 * function render() {
 *   return (openBlock(),createBlock('div', null, [...]))
 * }
 * ```
 * disableTracking is true when creating a v-for fragment block, since a v-for
 * fragment always diffs its children.
 *
 * @private
 */
export function openBlock(disableTracking = false): void {
  /**
   * 打开一个 block 收集上下文。
   *
   * 主要功能：
   * - 为接下来创建的一段 VNode 树准备 `dynamicChildren` 收集容器
   * - 让编译优化后的 patch 可以只关注动态节点
   *
   * 参数：
   * - `disableTracking`：是否禁用当前 block 的动态子节点收集，`v-for` Fragment 常见
   */
  blockStack.push((currentBlock = disableTracking ? null : []))
}

export function closeBlock(): void {
  // 退出当前 block，恢复到父级 block 的动态节点收集上下文。
  blockStack.pop()
  currentBlock = blockStack[blockStack.length - 1] || null
}

// Whether we should be tracking dynamic child nodes inside a block.
// Only tracks when this value is > 0
// We are not using a simple boolean because this value may need to be
// incremented/decremented by nested usage of v-once (see below)
export let isBlockTreeEnabled = 1

/**
 * Block tracking sometimes needs to be disabled, for example during the
 * creation of a tree that needs to be cached by v-once. The compiler generates
 * code like this:
 *
 * ``` js
 * _cache[1] || (
 *   setBlockTracking(-1, true),
 *   _cache[1] = createVNode(...),
 *   setBlockTracking(1),
 *   _cache[1]
 * )
 * ```
 *
 * @private
 */
export function setBlockTracking(value: number, inVOnce = false): void {
  /**
   * 临时调节 block 动态节点收集开关。
   *
   * 主要功能：
   * - 在某些场景下暂停动态节点收集
   * - 典型场景是 `v-once` 缓存树创建，避免把这段本应稳定的树再次记为动态节点
   *
   * 参数：
   * - `value`：通常传 `1` 或 `-1`，通过累加计数支持嵌套开关
   * - `inVOnce`：当前是否处在 `v-once` 生成逻辑里
   */
  isBlockTreeEnabled += value
  if (value < 0 && currentBlock && inVOnce) {
    // mark current block so it doesn't take fast path and skip possible
    // nested components during unmount
    currentBlock.hasOnce = true
  }
}

function setupBlock(vnode: VNode) {
  /**
   * 把一个 vnode 收尾为 block 根节点。
   *
   * 主要功能：
   * - 把当前收集到的 `dynamicChildren` 挂到 block 根上
   * - 关闭当前 block，恢复父级 block 上下文
   * - 再把当前 block 根登记到父级 block 中
   *
   * 为什么要这样做：
   * - block 是“局部稳定子树”的边界
   * - patch 时只要拿到 block 根上的 `dynamicChildren`，就能直接走优化路径
   */
  // save current block children on the block vnode
  vnode.dynamicChildren =
    isBlockTreeEnabled > 0 ? currentBlock || (EMPTY_ARR as any) : null
  // close block
  closeBlock()
  // a block is always going to be patched, so track it as a child of its
  // parent block
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(vnode)
  }
  return vnode
}

/**
 * @private
 */
export function createElementBlock(
  type: string | typeof Fragment,
  props?: Record<string, any> | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[],
  shapeFlag?: number,
): VNode {
  return setupBlock(
    createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      true /* isBlock */,
    ),
  )
}

/**
 * Create a block root vnode. Takes the same exact arguments as `createVNode`.
 * A block root keeps track of dynamic nodes within the block in the
 * `dynamicChildren` array.
 *
 * @private
 */
export function createBlock(
  type: VNodeTypes | ClassComponent,
  props?: Record<string, any> | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[],
): VNode {
  /**
   * 创建 block 根节点。
   *
   * 与普通 `createVNode()` 的差别：
   * - block 会额外挂上 `dynamicChildren`
   * - 后续 patch 可以利用它跳过整段稳定子树
   */
  return setupBlock(
    createVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      true /* isBlock: prevent a block from tracking itself */,
    ),
  )
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  /**
   * 判断两个 vnode 是否可以复用同一个宿主节点/组件实例。
   *
   * 判定标准非常严格：
   * - `type` 相同
   * - `key` 相同
   *
   * 只要其中一个不同，渲染器就会走卸载旧节点 + 挂载新节点，
   * 因为它们已经不是“同一个位置上的同一个逻辑节点”。
   */
  if (__DEV__ && n2.shapeFlag & ShapeFlags.COMPONENT && n1.component) {
    const dirtyInstances = hmrDirtyComponents.get(n2.type as ConcreteComponent)
    if (dirtyInstances && dirtyInstances.has(n1.component)) {
      // #7042, ensure the vnode being unmounted during HMR
      // bitwise operations to remove keep alive flags
      n1.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      n2.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
      // HMR only: if the component has been hot-updated, force a reload.
      return false
    }
  }
  return n1.type === n2.type && n1.key === n2.key
}

let vnodeArgsTransformer:
  | ((
      args: Parameters<typeof _createVNode>,
      instance: ComponentInternalInstance | null,
    ) => Parameters<typeof _createVNode>)
  | undefined

/**
 * Internal API for registering an arguments transform for createVNode
 * used for creating stubs in the test-utils
 * It is *internal* but needs to be exposed for test-utils to pick up proper
 * typings
 */
export function transformVNodeArgs(
  transformer?: typeof vnodeArgsTransformer,
): void {
  // 这是一个内部扩展点，主要给 test-utils / 兼容层在 createVNode 入参前做拦截改写。
  vnodeArgsTransformer = transformer
}

const createVNodeWithArgsTransform = (
  ...args: Parameters<typeof _createVNode>
): VNode => {
  return _createVNode(
    ...(vnodeArgsTransformer
      ? vnodeArgsTransformer(args, currentRenderingInstance)
      : args),
  )
}

const normalizeKey = ({ key }: VNodeProps): VNode['key'] =>
  key != null ? key : null

const normalizeRef = ({
  ref,
  ref_key,
  ref_for,
}: VNodeProps): VNodeNormalizedRefAtom | null => {
  /**
   * 把用户写法多样的 ref 归一化成渲染器统一结构。
   *
   * 输出里的关键字段：
   * - `i`：ref 所属组件实例，后续写回 refs 时要靠它找到 owner
   * - `r`：原始 ref 描述，可能是字符串 / ref 对象 / 函数
   * - `k`：编译器生成的 ref key，某些场景要额外挂到 `refs[key]`
   * - `f`：是否来自 `ref_for`
   */
  if (typeof ref === 'number') {
    ref = '' + ref
  }
  return (
    ref != null
      ? isString(ref) || isRef(ref) || isFunction(ref)
        ? { i: currentRenderingInstance, r: ref, k: ref_key, f: !!ref_for }
        : ref
      : null
  ) as any
}

function createBaseVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag = 0,
  dynamicProps: string[] | null = null,
  shapeFlag: number = type === Fragment ? 0 : ShapeFlags.ELEMENT,
  isBlockNode = false,
  needFullChildrenNormalization = false,
): VNode {
  /**
   * 创建最底层的 VNode 对象。
   *
   * 它是 `createVNode` 的基础实现，负责：
   * - 组装 VNode 全字段结构
   * - 处理 key/ref 归一化
   * - 根据 children 形态补全 children 类型位
   * - 在合适时机把当前 vnode 收集进父 block 的动态子节点列表
   *
   * 参数补充：
   * - `isBlockNode`：当前 vnode 自己是不是 block 根；是的话不能把自己再次收进自己的动态列表
   * - `needFullChildrenNormalization`：是否需要完整 children 归一化；编译产物某些路径可走更轻量分支
   */
  const vnode = {
    // 从这里开始，元素、组件、Fragment、Teleport 等各种节点
    // 都被投影成统一的 VNode 数据结构，后续 patch 只需要面对这一种中间表示。
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    // `dynamicProps` 只记录“编译器明确知道会动态变化的 prop 名”，
    // patch 时可据此跳过无关 prop。
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
    ctx: currentRenderingInstance,
  } as VNode

  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children)
    // normalize suspense children
    if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
      ;(type as typeof SuspenseImpl).normalize(vnode)
    }
  } else if (children) {
    // compiled element vnode - if children is passed, only possible types are
    // string or Array.
    vnode.shapeFlag |= isString(children)
      ? ShapeFlags.TEXT_CHILDREN
      : ShapeFlags.ARRAY_CHILDREN
  }

  // validate key
  if (__DEV__ && vnode.key !== vnode.key) {
    warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type)
  }

  // track vnode for block tree
  if (
    isBlockTreeEnabled > 0 &&
    // avoid a block node from tracking itself
    !isBlockNode &&
    // has current parent block
    currentBlock &&
    // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (vnode.patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
    // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    vnode.patchFlag !== PatchFlags.NEED_HYDRATION
  ) {
    // 只有真正会参与后续更新的节点才会收进 block。
    // 纯静态节点不记录，避免无意义地增加更新扫描成本。
    currentBlock.push(vnode)
  }

  if (__COMPAT__) {
    convertLegacyVModelProps(vnode)
    defineLegacyVNodeProperties(vnode)
  }

  return vnode
}

export { createBaseVNode as createElementVNode }

export const createVNode = (
  __DEV__ ? createVNodeWithArgsTransform : _createVNode
) as typeof _createVNode

function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false,
): VNode {
  /**
   * VNode 创建总入口。
   *
   * 主要功能：
   * - 归一化组件类型
   * - 归一化 props 中的 class / style / ref / key
   * - 根据类型计算 `shapeFlag`
   * - 进一步归一化 children
   *
   * 所在链路：
   * - 编译产物中的 `createVNode / createElementBlock / createBlock`
   * - 手写 render / `h()` 最终也会落到这里
   */
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    if (__DEV__ && !type) {
      warn(`Invalid vnode type when creating vnode: ${type}.`)
    }
    type = Comment
  }

  if (isVNode(type)) {
    // createVNode receiving an existing vnode. This happens in cases like
    // <component :is="vnode"/>
    // #2078 make sure to merge refs during the clone instead of overwriting it
    const cloned = cloneVNode(type, props, true /* mergeRef: true */)
    if (children) {
      normalizeChildren(cloned, children)
    }
    if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
      // `<component :is="existingVNode" />` 这类场景会直接复用现成 vnode。
      // 如果它本来就是组件，要把 block 里原位置替换成克隆后的 vnode，
      // 保证后续 patch 使用的是这次 render 产出的最新节点对象。
      if (cloned.shapeFlag & ShapeFlags.COMPONENT) {
        currentBlock[currentBlock.indexOf(type)] = cloned
      } else {
        currentBlock.push(cloned)
      }
    }
    cloned.patchFlag = PatchFlags.BAIL
    return cloned
  }

  // class component normalization.
  if (isClassComponent(type)) {
    type = type.__vccOpts
  }

  // 2.x async/functional component compat
  if (__COMPAT__) {
    type = convertLegacyComponent(type, currentRenderingInstance)
  }

  // class & style normalization.
  if (props) {
    // class/style 在 vnode 创建阶段就先规范化，
    // 目的是把 patch 热路径里的格式分支尽量前移。
    // for reactive or proxy objects, we need to clone it to enable mutation.
    props = guardReactiveProps(props)!
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      // reactive state objects need to be cloned since they are likely to be
      // mutated
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // `shapeFlag` 是 vnode 大类位图。
  // 后续 patch 依赖它快速判断这是元素、组件、Teleport 还是 Suspense。
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
      ? ShapeFlags.SUSPENSE
      : isTeleport(type)
        ? ShapeFlags.TELEPORT
        : isObject(type)
          ? ShapeFlags.STATEFUL_COMPONENT
          : isFunction(type)
            ? ShapeFlags.FUNCTIONAL_COMPONENT
            : 0

  if (__DEV__ && shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
    type = toRaw(type)
    warn(
      `Vue received a Component that was made a reactive object. This can ` +
        `lead to unnecessary performance overhead and should be avoided by ` +
        `marking the component with \`markRaw\` or using \`shallowRef\` ` +
        `instead of \`ref\`.`,
      `\nComponent that was made reactive: `,
      type,
    )
  }

  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true,
  )
}

export function guardReactiveProps(
  props: (Data & VNodeProps) | null,
): (Data & VNodeProps) | null {
  // reactive/proxy 对象可能在后续归一化过程中被就地改写，
  // 这里先浅拷贝一份，避免直接污染用户原始响应式对象。
  if (!props) return null
  return isProxy(props) || isInternalObject(props) ? extend({}, props) : props
}

export function cloneVNode<T, U>(
  vnode: VNode<T, U>,
  extraProps?: (Data & VNodeProps) | null,
  mergeRef = false,
  cloneTransition = false,
): VNode<T, U> {
  /**
   * 克隆一个 vnode。
   *
   * 主要功能：
   * - 给现有 vnode 叠加额外 props
   * - 在需要时合并 ref
   * - 保留原 vnode 已经关联的宿主节点/组件实例引用
   * - 某些场景下重新克隆 transition hooks，避免钩子里持有旧 vnode
   *
   * 常见调用链：
   * - `<component :is="vnode" />`
   * - slot / children 复用时的 vnode 保护性复制
   * - keep-alive / transition / 编译优化路径
   */
  // This is intentionally NOT using spread or extend to avoid the runtime
  // key enumeration cost.
  const { props, ref, patchFlag, children, transition } = vnode
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props
  const cloned: VNode<T, U> = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref:
      extraProps && extraProps.ref
        ? // #2078 in the case of <component :is="vnode" ref="extra"/>
          // if the vnode itself already has a ref, cloneVNode will need to merge
          // the refs so the single vnode can be set on multiple refs
          mergeRef && ref
          ? isArray(ref)
            ? ref.concat(normalizeRef(extraProps)!)
            : [ref, normalizeRef(extraProps)!]
          : normalizeRef(extraProps)
        : ref,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children:
      __DEV__ && patchFlag === PatchFlags.CACHED && isArray(children)
        ? (children as VNode[]).map(deepCloneVNode)
        : children,
    target: vnode.target,
    targetStart: vnode.targetStart,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag:
      extraProps && vnode.type !== Fragment
        ? patchFlag === PatchFlags.CACHED // hoisted node
          ? PatchFlags.FULL_PROPS
          : patchFlag | PatchFlags.FULL_PROPS
        : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition,

    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    placeholder: vnode.placeholder,

    el: vnode.el,
    anchor: vnode.anchor,
    ctx: vnode.ctx,
    ce: vnode.ce,
  }

  // if the vnode will be replaced by the cloned one, it is necessary
  // to clone the transition to ensure that the vnode referenced within
  // the transition hooks is fresh.
  if (transition && cloneTransition) {
    setTransitionHooks(
      cloned as VNode,
      transition.clone(cloned as VNode) as TransitionHooks,
    )
  }

  if (__COMPAT__) {
    defineLegacyVNodeProperties(cloned as VNode)
  }

  return cloned
}

/**
 * Dev only, for HMR of hoisted vnodes reused in v-for
 * https://github.com/vitejs/vite/issues/2022
 */
function deepCloneVNode(vnode: VNode): VNode {
  // HMR 下被缓存/提升的 vnode 可能被多处复用，需要把 children 也深拷贝，
  // 避免热更新时多个位置共享同一份子节点引用。
  const cloned = cloneVNode(vnode)
  if (isArray(vnode.children)) {
    cloned.children = (vnode.children as VNode[]).map(deepCloneVNode)
  }
  return cloned
}

/**
 * @private
 */
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  // 文本节点也统一走 VNode 体系，便于 patch 把文本和其他节点一视同仁处理。
  return createVNode(Text, null, text, flag)
}

/**
 * @private
 */
export function createStaticVNode(
  content: string,
  numberOfNodes: number,
): VNode {
  // A static vnode can contain multiple stringified elements, and the number
  // of elements is necessary for hydration.
  const vnode = createVNode(Static, null, content)
  vnode.staticCount = numberOfNodes
  return vnode
}

/**
 * @private
 */
export function createCommentVNode(
  text: string = '',
  // when used as the v-else branch, the comment node must be created as a
  // block to ensure correct updates.
  asBlock: boolean = false,
): VNode {
  // `v-else` 一类条件分支里，注释占位有时也必须作为 block 创建，
  // 否则切换分支时 block 边界会不稳定。
  return asBlock
    ? (openBlock(), createBlock(Comment, null, text))
    : createVNode(Comment, null, text)
}

export function normalizeVNode(child: VNodeChild): VNode {
  /**
   * 把任意合法子节点值转换成标准 VNode。
   *
   * 这是 children 进入渲染器前的最后一道统一入口：
   * - `null/boolean` -> 注释占位
   * - 数组 -> Fragment
   * - 已是 vnode -> 复用或克隆
   * - 字符串/数字 -> Text
   */
  if (child == null || typeof child === 'boolean') {
    // empty placeholder
    return createVNode(Comment)
  } else if (isArray(child)) {
    // fragment
    return createVNode(
      Fragment,
      null,
      // #3666, avoid reference pollution when reusing vnode
      child.slice(),
    )
  } else if (isVNode(child)) {
    // already vnode, this should be the most common since compiled templates
    // always produce all-vnode children arrays
    return cloneIfMounted(child)
  } else {
    // strings and numbers
    return createVNode(Text, null, String(child))
  }
}

// optimized normalization for template-compiled render fns
export function cloneIfMounted(child: VNode): VNode {
  // 已挂载 vnode 不能直接在下一轮 render 里原样复用，
  // 否则旧的 el / component 引用会污染新的 patch 过程，所以这里按需克隆。
  return (child.el === null && child.patchFlag !== PatchFlags.CACHED) ||
    child.memo
    ? child
    : cloneVNode(child)
}

export function normalizeChildren(vnode: VNode, children: unknown): void {
  /**
   * 归一化 vnode.children。
   *
   * 主要功能：
   * - 把 children 统一整理成渲染器可识别的几种标准形态
   * - 同步更新 `shapeFlag` 上的 children 类型位
   *
   * 为什么重要：
   * - patch 不希望在热路径里反复判断“children 到底是字符串、数组还是插槽对象”
   * - 这里提前整理好，后面渲染器就能按位标记快速分支
   */
  let type = 0
  const { shapeFlag } = vnode
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.TELEPORT)) {
      // Normalize slot to plain children for plain element and Teleport
      // 原生元素 / Teleport 不保留“插槽对象”语义，要把 default slot 直接拍平成普通 children。
      const slot = (children as any).default
      if (slot) {
        // _c marker is added by withCtx() indicating this is a compiled slot
        slot._c && (slot._d = false)
        normalizeChildren(vnode, slot())
        slot._c && (slot._d = true)
      }
      return
    } else {
      type = ShapeFlags.SLOTS_CHILDREN
      // `_` 是编译器给 slots 打的稳定性标记，后续 diff 会用它判断是否需要强制更新插槽。
      const slotFlag = (children as RawSlots)._
      if (!slotFlag && !isInternalObject(children)) {
        // if slots are not normalized, attach context instance
        // (compiled / normalized slots already have context)
        ;(children as RawSlots)._ctx = currentRenderingInstance
      } else if (slotFlag === SlotFlags.FORWARDED && currentRenderingInstance) {
        // a child component receives forwarded slots from the parent.
        // its slot type is determined by its parent's slot type.
        if (
          (currentRenderingInstance.slots as RawSlots)._ === SlotFlags.STABLE
        ) {
          ;(children as RawSlots)._ = SlotFlags.STABLE
        } else {
          ;(children as RawSlots)._ = SlotFlags.DYNAMIC
          vnode.patchFlag |= PatchFlags.DYNAMIC_SLOTS
        }
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    children = String(children)
    // force teleport children to array so it can be moved around
    if (shapeFlag & ShapeFlags.TELEPORT) {
      type = ShapeFlags.ARRAY_CHILDREN
      children = [createTextVNode(children as string)]
    } else {
      type = ShapeFlags.TEXT_CHILDREN
    }
  }
  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}

export function mergeProps(...args: (Data & VNodeProps)[]): Data {
  /**
   * 合并多份 VNode props。
   *
   * 主要功能：
   * - class 合并成规范化 class
   * - style 合并成规范化 style
   * - 事件监听做数组拼接而不是直接覆盖
   * - 其他普通字段后写覆盖前写
   *
   * 常见来源：
   * - `cloneVNode()`
   * - `h()` / JSX 中多层 props 透传
   * - 编译产物里的 props 合并
   */
  const ret: Data = {}
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class])
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (isOn(key)) {
        const existing = ret[key]
        const incoming = toMerge[key]
        if (
          incoming &&
          existing !== incoming &&
          !(isArray(existing) && existing.includes(incoming))
        ) {
          ret[key] = existing
            ? [].concat(existing as any, incoming as any)
            : incoming
        } else if (
          incoming == null &&
          existing == null &&
          // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
          // the model listener.
          !isModelListener(key)
        ) {
          ret[key] = incoming
        }
      } else if (key !== '') {
        ret[key] = toMerge[key]
      }
    }
  }
  return ret
}

export function invokeVNodeHook(
  hook: VNodeHook,
  instance: ComponentInternalInstance | null,
  vnode: VNode,
  prevVNode: VNode | null = null,
): void {
  /**
   * 调用 vnode 级别生命周期钩子。
   *
   * 主要功能：
   * - 统一包装 `onVnodeBeforeMount / onVnodeUpdated` 等钩子的执行
   * - 让 vnode hook 也走统一的错误处理通道
   */
  callWithAsyncErrorHandling(hook, instance, ErrorCodes.VNODE_HOOK, [
    vnode,
    prevVNode,
  ])
}
