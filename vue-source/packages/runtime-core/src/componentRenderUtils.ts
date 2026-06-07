/**
 * 文件作用：处理组件 render 返回值的规范化与根节点后处理。
 *
 * 这份文件负责 render 结果收口、attrs fallthrough、继承指令和过渡根节点处理等逻辑。
 */

import {
  type ComponentInternalInstance,
  type Data,
  type FunctionalComponent,
  getComponentName,
} from './component'
import {
  Comment,
  type VNode,
  type VNodeArrayChildren,
  blockStack,
  cloneVNode,
  createVNode,
  isVNode,
  normalizeVNode,
} from './vnode'
import { ErrorCodes, handleError } from './errorHandling'
import {
  PatchFlags,
  ShapeFlags,
  isModelListener,
  isObject,
  isOn,
  looseEqual,
} from '@vue-source/shared'
import { warn } from './warning'
import { isHmrUpdating } from './hmr'
import type { NormalizedProps } from './componentProps'
import { isEmitListener } from './componentEmits'
import { setCurrentRenderingInstance } from './componentRenderContext'
import {
  DeprecationTypes,
  isCompatEnabled,
  warnDeprecation,
} from './compat/compatConfig'
import { shallowReadonly } from '@vue-source/reactivity'
import { setTransitionHooks } from './components/BaseTransition'

// 这个标记用来记录当前 render 过程中是否访问过 `$attrs`，避免重复给出 fallthrough 告警。
let accessedAttrs: boolean = false
// 这是一次 render 级别的临时标记：
// - render 中显式访问过 `$attrs`，说明开发者已手动处理透传
// - 那么后面针对“无法自动 fallthrough”的开发告警就不应重复提示

/**
 * 作用：标记当前渲染函数显式访问过 `$attrs`。
 */
export function markAttrsAccessed(): void {
  accessedAttrs = true
}

type SetRootFn = ((root: VNode) => void) | undefined

/**
 * 作用：执行组件的 render，并把结果规范化成可继续 patch 的根 vnode。
 *
 * 参数说明：
 * - `instance`：当前要渲染的组件实例。
 *
 * 依赖关系：
 * - 会通过 `setCurrentRenderingInstance` 建立当前渲染上下文。
 * - 内部依赖 `normalizeVNode`、`cloneVNode`、`getFunctionalFallthrough` 等收口 render 结果。
 * - 渲染结束后还会处理 attrs 透传、指令继承、transition 根节点规范化。
 */
export function renderComponentRoot(
  instance: ComponentInternalInstance,
): VNode {
  // 这是组件 render 结果进入 patch 之前的最后一道收口。
  // render 可以返回很多形态，但离开这里时必须被整理成标准根 vnode，
  // 同时把 attrs fallthrough、指令继承、transition 根节点处理完。
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit,
    render,
    renderCache,
    props,
    data,
    setupState,
    ctx,
    inheritAttrs,
  } = instance
  const prev = setCurrentRenderingInstance(instance)

  // `result` 保存 render 原始返回值规范化后的 vnode。
  let result
  // `fallthroughAttrs` 保存后续可能要自动透传给根节点的 attrs。
  let fallthroughAttrs
  if (__DEV__) {
    accessedAttrs = false
  }

  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // 编译产物里的 `with` 语法需要使用 `withProxy`，手写 render 则直接走普通代理。
      const proxyToUse = withProxy || proxy
      // `<script setup>` 模板里不应该通过 `this` 访问状态，这里只在开发环境提示。
      const thisProxy =
        __DEV__ && setupState.__isScriptSetup
          ? new Proxy(proxyToUse!, {
              get(target, key, receiver) {
                warn(
                  `Property '${String(
                    key,
                  )}' was accessed via 'this'. Avoid using 'this' in templates.`,
                )
                return Reflect.get(target, key, receiver)
              },
            })
          : proxyToUse
      result = normalizeVNode(
        render!.call(
          thisProxy,
          proxyToUse!,
          renderCache,
          __DEV__ ? shallowReadonly(props) : props,
          setupState,
          data,
          ctx,
        ),
      )
      // 有状态组件默认把实例 attrs 作为 fallthrough 候选，后面再结合根节点形态决定是否真的透传。
      fallthroughAttrs = attrs
    } else {
      // 函数组件没有实例代理，render 直接由函数本身执行。
      const render = Component as FunctionalComponent
      // 函数组件未声明 props 时，attrs 和 props 复用同一个对象。
      if (__DEV__ && attrs === props) {
        markAttrsAccessed()
      }
      result = normalizeVNode(
        render.length > 1
          ? render(
              __DEV__ ? shallowReadonly(props) : props,
              __DEV__
                ? {
                    get attrs() {
                      markAttrsAccessed()
                      return shallowReadonly(attrs)
                    },
                    slots,
                    emit,
                  }
                : { attrs, slots, emit },
            )
          : render(
              __DEV__ ? shallowReadonly(props) : props,
              null as any /* we know it doesn't need it */,
            ),
      )
      // 函数组件如果声明了 props，则其余 attrs 可以整体透传；
      // 若未声明 props，只保留 class/style/onXxx 这类最安全的外层属性。
      fallthroughAttrs = Component.props
        ? attrs
        : getFunctionalFallthrough(attrs)
    }
  } catch (err) {
    // 渲染报错后要清掉 block 栈，避免后续 vnode 收集状态污染。
    blockStack.length = 0
    handleError(err, instance, ErrorCodes.RENDER_FUNCTION)
    result = createVNode(Comment)
  }

  // `root` 表示最终真正进入 patch 的根节点，开发环境下可能需要从 fragment 中再剥一层。
  let root = result
  let setRoot: SetRootFn = undefined
  if (
    __DEV__ &&
    result.patchFlag > 0 &&
    result.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
  ) {
    ;[root, setRoot] = getChildRoot(result)
  }

  if (fallthroughAttrs && inheritAttrs !== false) {
    const keys = Object.keys(fallthroughAttrs)
    const { shapeFlag } = root
    if (keys.length) {
      if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)) {
        if (propsOptions && keys.some(isModelListener)) {
          // 声明了对应 prop 的 v-model 监听器，应由组件自己消费，不能再透传到根节点。
          fallthroughAttrs = filterModelListeners(
            fallthroughAttrs,
            propsOptions,
          )
        }
        // 根节点可承接 attrs 时，直接克隆一份根 vnode 并把透传属性并进去。
        root = cloneVNode(root, fallthroughAttrs, false, true)
      } else if (__DEV__ && !accessedAttrs && root.type !== Comment) {
        const allAttrs = Object.keys(attrs)
        const eventAttrs: string[] = []
        const extraAttrs: string[] = []
        for (let i = 0, l = allAttrs.length; i < l; i++) {
          const key = allAttrs[i]
          if (isOn(key)) {
            if (!isModelListener(key)) {
              // 事件名告警时去掉 `on` 前缀，方便和用户模板写法对应。
              eventAttrs.push(key[2].toLowerCase() + key.slice(3))
            }
          } else {
            extraAttrs.push(key)
          }
        }
        if (extraAttrs.length) {
          warn(
            `Extraneous non-props attributes (` +
              `${extraAttrs.join(', ')}) ` +
              `were passed to component but could not be automatically inherited ` +
              `because component renders fragment or text or teleport root nodes.`,
          )
        }
        if (eventAttrs.length) {
          warn(
            `Extraneous non-emits event listeners (` +
              `${eventAttrs.join(', ')}) ` +
              `were passed to component but could not be automatically inherited ` +
              `because component renders fragment or text root nodes. ` +
              `If the listener is intended to be a component custom event listener only, ` +
              `declare it using the "emits" option.`,
          )
        }
      }
    }
  }

  if (
    __COMPAT__ &&
    isCompatEnabled(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE, instance) &&
    vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT &&
    root.shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)
  ) {
    const { class: cls, style } = vnode.props || {}
    if (cls || style) {
      if (__DEV__ && inheritAttrs === false) {
        warnDeprecation(
          DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE,
          instance,
          getComponentName(instance.type),
        )
      }
      root = cloneVNode(
        root,
        {
          // compat 下 `class/style` 仍允许像 Vue 2 一样从组件 vnode 直接压到最终根节点。
          class: cls,
          style: style,
        },
        false,
        true,
      )
    }
  }

  // 组件 vnode 上声明的指令需要继续继承到真正的元素根节点上。
  if (vnode.dirs) {
    if (__DEV__ && !isElementRoot(root)) {
      warn(
        `Runtime directive used on component with non-element root node. ` +
          `The directives will not function as intended.`,
      )
    }
    // clone before mutating since the root may be a hoisted vnode
    root = cloneVNode(root, null, false, true)
    root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs
  }
  // inherit transition data
  if (vnode.transition) {
    if (__DEV__ && !isElementRoot(root)) {
      warn(
        `Component inside <Transition> renders non-element root node ` +
          `that cannot be animated.`,
      )
    }
    setTransitionHooks(root, vnode.transition)
  }

  if (__DEV__ && setRoot) {
    // 开发环境若曾经从 DEV_ROOT_FRAGMENT 中抽出了真实根节点，这里要把变更同步写回原树。
    setRoot(root)
  } else {
    result = root
  }

  setCurrentRenderingInstance(prev)
  return result
}

/**
 * dev only
 * In dev mode, template root level comments are rendered, which turns the
 * template into a fragment root, but we need to locate the single element
 * root for attrs and scope id processing.
 */
const getChildRoot = (vnode: VNode): [VNode, SetRootFn] => {
  /**
   * 在开发环境下，从根 Fragment 里找出真正的单根节点。
   *
   * 为什么需要它：
   * - 开发环境会保留模板顶层注释
   * - 这样原本单根模板也可能临时表现成 Fragment
   * - 但 attrs 透传、scopeId、transition 继承等逻辑仍然需要定位到真正根节点
   */
  const rawChildren = vnode.children as VNodeArrayChildren
  const dynamicChildren = vnode.dynamicChildren
  const childRoot = filterSingleRoot(rawChildren, false)
  if (!childRoot) {
    return [vnode, undefined]
  } else if (
    __DEV__ &&
    childRoot.patchFlag > 0 &&
    childRoot.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
  ) {
    return getChildRoot(childRoot)
  }

  // `index` 是原始 children 中根节点所在位置。
  // `dynamicIndex` 是它在动态子节点列表中的位置，后面如果替换根节点，需要两边都同步更新。
  const index = rawChildren.indexOf(childRoot)
  const dynamicIndex = dynamicChildren ? dynamicChildren.indexOf(childRoot) : -1
  const setRoot: SetRootFn = (updatedRoot: VNode) => {
    // 原始 children 与 dynamicChildren 都可能缓存了根节点引用，替换时两边都要同步。
    rawChildren[index] = updatedRoot
    if (dynamicChildren) {
      if (dynamicIndex > -1) {
        dynamicChildren[dynamicIndex] = updatedRoot
      } else if (updatedRoot.patchFlag > 0) {
        // 原根节点原先不是动态节点，但替换后的根节点可能需要参与 block diff，这里补进列表。
        vnode.dynamicChildren = [...dynamicChildren, updatedRoot]
      }
    }
  }
  return [normalizeVNode(childRoot), setRoot]
}

export function filterSingleRoot(
  children: VNodeArrayChildren,
  recurse = true,
): VNode | undefined {
  /**
   * 从 children 中筛出“唯一非注释根节点”。
   *
   * 返回规则：
   * - 只有一个有效根节点时返回它
   * - 只要出现多个有效根节点，立即返回 `undefined`
   * - 普通用户注释节点会被忽略
   *
   * 参数：
   * - `children`：待检查的子节点数组
   * - `recurse`：是否继续递归展开开发环境下的根 Fragment
   */
  let singleRoot
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isVNode(child)) {
      // ignore user comment
      if (child.type !== Comment || child.children === 'v-if') {
        if (singleRoot) {
          // has more than 1 non-comment child, return now
          // 一旦出现第二个有效根节点，就不再是“单根”场景，后续 attrs/transition 都不能再自动继承。
          return
        } else {
          singleRoot = child
          if (
            __DEV__ &&
            recurse &&
            singleRoot.patchFlag > 0 &&
            singleRoot.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
          ) {
            return filterSingleRoot(singleRoot.children as VNodeArrayChildren)
          }
        }
      }
    } else {
      return
    }
  }
  return singleRoot
}

const getFunctionalFallthrough = (attrs: Data): Data | undefined => {
  /**
   * 为函数组件筛选允许自动透传的 attrs。
   *
   * 为什么只保留 `class / style / onXxx`：
   * - 未声明 props 的函数组件本质上没有实例来消费其余 attrs
   * - Vue 只自动透传最常见、最安全的展示层属性和事件监听
   */
  let res: Data | undefined
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      ;(res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}

const filterModelListeners = (attrs: Data, props: NormalizedProps): Data => {
  /**
   * 过滤掉本该由组件自身消费的 `v-model` 监听器。
   *
   * 典型场景：
   * - 组件声明了 `modelValue` 或其他 model prop
   * - 父组件传进来的 `onUpdate:xxx` 不能继续向根元素透传
   * - 否则会把“组件级双向绑定事件”错误降级成“原生 DOM 事件监听”
   */
  const res: Data = {}
  for (const key in attrs) {
    // `onUpdate:xxx` 只有在组件未声明对应 model prop 时，才允许继续下沉到真实根节点。
    if (!isModelListener(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key]
    }
  }
  return res
}

const isElementRoot = (vnode: VNode) => {
  /**
   * 判断一个 vnode 能否被当作“元素型根节点”处理。
   *
   * 这里把组件也算进去，是因为组件最终可能仍然渲染成单个元素根；
   * 注释节点则主要服务于 `v-if` 分支切换时的占位场景。
   */
  return (
    vnode.shapeFlag & (ShapeFlags.COMPONENT | ShapeFlags.ELEMENT) ||
    vnode.type === Comment // potential v-if branch switch
  )
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode,
  optimized?: boolean,
): boolean {
  // 注意：这里判断的不是“组件内部响应式状态有没有变”，
  // 而是“父级这次传给当前子组件的输入视图，有没有变化到需要重跑子组件 render”。
  // 子组件自己内部状态触发的更新，不经过这里，而是直接由其 render effect 调度。
  /**
   * 判断组件这次是否需要进入更新流程。
   *
   * 主要功能：
   * - 利用 patchFlag 快速判断动态插槽 / 动态 props 是否变更
   * - 手写 render 场景下退化成更保守的全量比较
   * - 忽略 emits 监听器带来的伪变更
   *
   * 所在链路：
   * - `renderer.ts -> updateComponent`
   * - 只有这里返回 true，组件才会重新执行 render effect
   */
  const { props: prevProps, children: prevChildren, component } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  const emits = component!.emitsOptions

  // Parent component's render function was hot-updated. Since this may have
  // caused the child component's slots content to have changed, we need to
  // force the child to update as well.
  if (__DEV__ && (prevChildren || nextChildren) && isHmrUpdating) {
    return true
  }

  // force child update for runtime directive or transition on component vnode.
  if (nextVNode.dirs || nextVNode.transition) {
    return true
  }

  if (optimized && patchFlag >= 0) {
    // 编译优化分支优先依赖 patchFlag，尽量避免无意义全量 props 比较。
    if (patchFlag & PatchFlags.DYNAMIC_SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & PatchFlags.FULL_PROPS) {
      if (!prevProps) {
        return !!nextProps
      }
      // presence of this flag indicates props are always non-null
      return hasPropsChanged(prevProps, nextProps!, emits)
    } else if (patchFlag & PatchFlags.PROPS) {
      const dynamicProps = nextVNode.dynamicProps!
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if (
          hasPropValueChanged(nextProps!, prevProps!, key) &&
          !isEmitListener(emits, key)
        ) {
          return true
        }
      }
    }
  } else {
    // 手写 render 无法像编译产物那样拿到精确 patchFlag，
    // 因此这里只能采用更保守策略：只要 children 不稳定，就强制更新。
    if (prevChildren || nextChildren) {
      if (!nextChildren || !(nextChildren as any).$stable) {
        return true
      }
    }
    if (prevProps === nextProps) {
      return false
    }
    if (!prevProps) {
      return !!nextProps
    }
    if (!nextProps) {
      return true
    }
    return hasPropsChanged(prevProps, nextProps, emits)
  }

  return false
}

function hasPropsChanged(
  prevProps: Data,
  nextProps: Data,
  emitsOptions: ComponentInternalInstance['emitsOptions'],
): boolean {
  /**
   * 比较两次 props 是否真的发生了影响组件渲染的变化。
   *
   * 注意：
   * - emits 监听器变化不会触发组件更新
   * - 因为这类监听器是给组件 `emit()` 消费的，不属于组件 render 输入
   */
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (
      hasPropValueChanged(nextProps, prevProps, key) &&
      !isEmitListener(emitsOptions, key)
    ) {
      return true
    }
  }
  return false
}

function hasPropValueChanged(
  nextProps: Data,
  prevProps: Data,
  key: string,
): boolean {
  // style 允许对象形式，需要用宽松比较，避免引用变化但样式内容等价时误判更新。
  const nextProp = nextProps[key]
  const prevProp = prevProps[key]
  if (key === 'style' && isObject(nextProp) && isObject(prevProp)) {
    return !looseEqual(nextProp, prevProp)
  }
  return nextProp !== prevProp
}

export function updateHOCHostEl(
  { vnode, parent, suspense }: ComponentInternalInstance,
  el: typeof vnode.el, // HostNode
): void {
  /**
   * 向上同步高阶组件链路上的宿主元素引用。
   *
   * 为什么需要它：
   * - 某些包装组件本身不直接渲染真实元素，只是把子组件包一层
   * - 父级如果通过组件 vnode 取 `el`，仍然希望拿到最终真实宿主节点
   * - Suspense 还会代理 activeBranch 的 host node，因此这里要连同边界一起回传
   */
  while (parent) {
    const root = parent.subTree
    if (root.suspense && root.suspense.activeBranch === vnode) {
      // Suspense proxies its active branch host node, so keep propagating from
      // the boundary vnode to any wrapper components above it.
      root.suspense.vnode.el = root.el = el
      vnode = root
    }
    if (root === vnode) {
      ;(vnode = parent.vnode).el = el
      parent = parent.parent
    } else {
      break
    }
  }
  // also update suspense vnode el
  if (suspense && suspense.activeBranch === vnode) {
    suspense.vnode.el = el
  }
}
