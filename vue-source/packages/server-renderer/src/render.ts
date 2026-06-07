import {
  Comment,
  type Component,
  type ComponentInternalInstance,
  type DirectiveBinding,
  Fragment,
  type FunctionalComponent,
  Static,
  Text,
  type VNode,
  type VNodeArrayChildren,
  type VNodeProps,
  mergeProps,
  ssrUtils,
  warn,
} from '@vue-source/runtime-dom'
import {
  NOOP,
  ShapeFlags,
  escapeHtml,
  escapeHtmlComment,
  isFunction,
  isPromise,
  isString,
  isVoidTag,
} from '@vue-source/shared'
import {
  type Props,
  type PushFn,
  type SSRBuffer,
  type SSRContext,
  createBuffer,
} from './buffer'
import { ssrRenderAttrs } from './helpers/ssrRenderAttrs'
import { ssrCompile } from './helpers/ssrCompile'
import { ssrRenderTeleport } from './helpers/ssrRenderTeleport'

const {
  createComponentInstance,
  setCurrentRenderingInstance,
  setupComponent,
  renderComponentRoot,
  normalizeVNode,
  pushWarningContext,
  popWarningContext,
} = ssrUtils

// 把组件 VNode 渲染成 buffer。
// 这里负责实例创建、setup、serverPrefetch，以及决定何时进入真正的子树渲染。
export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  const instance = (vnode.component = createComponentInstance(
    vnode,
    parentComponent,
    null,
  ))

  if (__DEV__) pushWarningContext(vnode)
  const res = setupComponent(instance, true /* isSSR */)
  if (__DEV__) popWarningContext()

  const hasAsyncSetup = isPromise(res)
  let prefetches = instance.sp /* LifecycleHooks.SERVER_PREFETCH */

  // SSR 必须等待 async setup 和 serverPrefetch 全部结束，
  // 否则首屏 HTML 会缺数据。
  if (hasAsyncSetup || prefetches) {
    const p: Promise<unknown> = Promise.resolve(res as Promise<void>)
      .then(() => {
        // async setup resolve 之后，serverPrefetch 才可能真正挂到实例上。
        if (hasAsyncSetup) prefetches = instance.sp
        if (prefetches) {
          return Promise.all(
            prefetches.map(prefetch => prefetch.call(instance.proxy)),
          )
        }
      })
      // 生命周期包装层已经负责错误展示，这里只避免中断整条 Promise 链。
      .catch(NOOP)

    return p.then(() => renderComponentSubTree(instance, slotScopeId))
  } else {
    return renderComponentSubTree(instance, slotScopeId)
  }
}

function renderComponentSubTree(
  instance: ComponentInternalInstance,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  if (__DEV__) pushWarningContext(instance.vnode)

  const comp = instance.type as Component
  const { getBuffer, push } = createBuffer()

  if (isFunction(comp)) {
    let root = renderComponentRoot(instance)

    // 函数组件没有显式 props 声明时，scopeId 透传可能丢失，
    // 这里把形如 `data-v-*` 的作用域属性手动补回根节点。
    if (!(comp as FunctionalComponent).props) {
      for (const key in instance.attrs) {
        if (key.startsWith(`data-v-`)) {
          ;(root.props || (root.props = {}))[key] = ``
        }
      }
    }

    renderVNode(push, (instance.subTree = root), instance, slotScopeId)
  } else {
    // 普通对象组件优先走专用的 ssrRender。
    // 只有在没有现成 ssrRender、但存在 template 时，才退回运行时编译。
    if (
      (!instance.render || instance.render === NOOP) &&
      !instance.ssrRender &&
      !comp.ssrRender &&
      isString(comp.template)
    ) {
      comp.ssrRender = ssrCompile(comp.template, instance)
    }

    const ssrRender = instance.ssrRender || comp.ssrRender
    if (ssrRender) {
      // 编译产物路径会把 fallthrough attrs、scopeId、slot scopeId
      // 一起整理后交给专用 ssrRender。
      let attrs = instance.inheritAttrs !== false ? instance.attrs : undefined
      let hasCloned = false

      let cur = instance
      while (true) {
        const scopeId = cur.vnode.scopeId
        if (scopeId) {
          if (!hasCloned) {
            attrs = { ...attrs }
            hasCloned = true
          }
          attrs![scopeId] = ''
        }

        const parent = cur.parent
        if (parent && parent.subTree && parent.subTree === cur.vnode) {
          // 如果父组件是“以当前 vnode 作为根节点”的非 SSR 编译组件，
          // 还要继续继承父链上的 scopeId，避免样式作用域断掉。
          cur = parent
        } else {
          break
        }
      }

      if (slotScopeId) {
        if (!hasCloned) attrs = { ...attrs }
        const slotScopeIdList = slotScopeId.trim().split(' ')
        for (let i = 0; i < slotScopeIdList.length; i++) {
          attrs![slotScopeIdList[i]] = ''
        }
      }

      // 某些运行时解析逻辑依赖“当前渲染实例”，例如资源解析和告警上下文。
      const prev = setCurrentRenderingInstance(instance)
      try {
        ssrRender(
          instance.proxy,
          push,
          instance,
          attrs,
          // 这些参数布局由编译器生成的 ssrRender 调用约定决定。
          instance.props,
          instance.setupState,
          instance.data,
          instance.ctx,
        )
      } finally {
        setCurrentRenderingInstance(prev)
      }
    } else if (instance.render && instance.render !== NOOP) {
      // 没有专门 ssrRender 时，退回通用 render -> vnode -> SSR 分发流程。
      renderVNode(
        push,
        (instance.subTree = renderComponentRoot(instance)),
        instance,
        slotScopeId,
      )
    } else {
      const componentName = comp.name || comp.__file || `<Anonymous>`
      warn(`Component ${componentName} is missing template or render function.`)
      push(`<!---->`)
    }
  }

  if (__DEV__) popWarningContext()
  return getBuffer()
}

// 这是 SSR 的总分发器：根据 vnode 类型决定该如何向 buffer 推内容。
export function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  const { type, shapeFlag, children, dirs, props } = vnode

  // 指令在 SSR 中不会执行完整 DOM 生命周期，
  // 它们只能通过 `getSSRProps` 把结果折算成额外属性。
  if (dirs) {
    vnode.props = applySSRDirectives(vnode, props, dirs)
  }

  switch (type) {
    case Text:
      push(escapeHtml(children as string))
      break

    case Comment:
      push(
        children
          ? `<!--${escapeHtmlComment(children as string)}-->`
          : `<!---->`,
      )
      break

    case Static:
      push(children as string)
      break

    case Fragment:
      if (vnode.slotScopeIds) {
        slotScopeId =
          (slotScopeId ? slotScopeId + ' ' : '') + vnode.slotScopeIds.join(' ')
      }

      // Fragment 在 SSR 输出里需要显式注释边界，客户端 hydration 才能对齐。
      push(`<!--[-->`)
      renderVNodeChildren(
        push,
        children as VNodeArrayChildren,
        parentComponent,
        slotScopeId,
      )
      push(`<!--]-->`)
      break

    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        renderElementVNode(push, vnode, parentComponent, slotScopeId)
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        push(renderComponentVNode(vnode, parentComponent, slotScopeId))
      } else if (shapeFlag & ShapeFlags.TELEPORT) {
        renderTeleportVNode(push, vnode, parentComponent, slotScopeId)
      } else if (shapeFlag & ShapeFlags.SUSPENSE) {
        // SSR 下 suspense 直接渲染已决议的 ssContent。
        renderVNode(push, vnode.ssContent!, parentComponent, slotScopeId)
      } else {
        warn(
          '[@vue-source/server-renderer] Invalid VNode type:',
          type,
          `(${typeof type})`,
        )
      }
  }
}

export function renderVNodeChildren(
  push: PushFn,
  children: VNodeArrayChildren,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  for (let i = 0; i < children.length; i++) {
    renderVNode(push, normalizeVNode(children[i]), parentComponent, slotScopeId)
  }
}

function renderElementVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
) {
  const tag = vnode.type as string
  const { props, children, shapeFlag, scopeId } = vnode
  let openTag = `<${tag}`

  if (props) {
    openTag += ssrRenderAttrs(props, tag)
  }

  if (scopeId) {
    openTag += ` ${scopeId}`
  }

  // 如果当前元素是组件渲染结果的根节点，还要沿父链补齐继承下来的作用域标记。
  let curParent: ComponentInternalInstance | null = parentComponent
  let curVnode = vnode
  while (curParent && curVnode === curParent.subTree) {
    curVnode = curParent.vnode
    if (curVnode.scopeId) {
      openTag += ` ${curVnode.scopeId}`
    }
    curParent = curParent.parent
  }

  if (slotScopeId) {
    openTag += ` ${slotScopeId}`
  }

  push(openTag + `>`)

  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false

    // `innerHTML` / `textContent` / `textarea.value` 在 SSR 中优先级高于 children，
    // 因为它们代表更接近真实 DOM 最终结果的覆盖语义。
    if (props) {
      if (props.innerHTML) {
        hasChildrenOverride = true
        push(props.innerHTML)
      } else if (props.textContent) {
        hasChildrenOverride = true
        push(escapeHtml(props.textContent))
      } else if (tag === 'textarea' && props.value) {
        hasChildrenOverride = true
        push(escapeHtml(props.value))
      }
    }

    if (!hasChildrenOverride) {
      if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        push(escapeHtml(children as string))
      } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        renderVNodeChildren(
          push,
          children as VNodeArrayChildren,
          parentComponent,
          slotScopeId,
        )
      }
    }

    push(`</${tag}>`)
  }
}

function applySSRDirectives(
  vnode: VNode,
  rawProps: VNodeProps | null,
  dirs: DirectiveBinding[],
): VNodeProps {
  const toMerge: VNodeProps[] = []

  for (let i = 0; i < dirs.length; i++) {
    const binding = dirs[i]
    const {
      dir: { getSSRProps },
    } = binding

    if (getSSRProps) {
      const props = getSSRProps(binding, vnode)
      if (props) toMerge.push(props)
    }
  }

  return mergeProps(rawProps || {}, ...toMerge)
}

function renderTeleportVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
) {
  const target = vnode.props && vnode.props.to
  const disabled = vnode.props && vnode.props.disabled

  if (!target) {
    if (!disabled) {
      warn(`[@vue-source/server-renderer] Teleport is missing target prop.`)
    }
    return []
  }

  if (!isString(target)) {
    warn(
      `[@vue-source/server-renderer] Teleport target must be a query selector string.`,
    )
    return []
  }

  ssrRenderTeleport(
    push,
    push => {
      renderVNodeChildren(
        push,
        vnode.children as VNodeArrayChildren,
        parentComponent,
        slotScopeId,
      )
    },
    target,
    disabled || disabled === '',
    parentComponent,
  )
}
