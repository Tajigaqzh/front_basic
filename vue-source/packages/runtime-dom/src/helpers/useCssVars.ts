/**
 * 文件作用：runtime-dom 的辅助模块。
 *
 * 当前文件 useCssVars.ts 负责把 SFC 编译生成的 CSS 变量结果同步到真实 DOM 节点。
 *
 * 它主要服务于 `<style vars>` / scoped CSS 变量场景，
 * 连接“组件状态变化”与“节点 style 上的 --xxx 自定义属性更新”。
 */

import {
  Fragment,
  Static,
  type VNode,
  getCurrentInstance,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  queuePostFlushCb,
  warn,
  watch,
} from '@vue-source/runtime-core'
import { NOOP, ShapeFlags, normalizeCssVarValue } from '@vue-source/shared'

export const CSS_VAR_TEXT: unique symbol = Symbol(__DEV__ ? 'CSS_VAR_TEXT' : '')
/**
 * 作用：把 SFC 编译生成的 CSS 变量 getter 接入当前组件实例的更新链路。
 *
 * 链路位置：
 * - setup 中调用
 * - mounted 后首次同步变量
 * - beforeUpdate / post-flush / Teleport 变更时继续刷新变量
 */
export function useCssVars(
  getter: (ctx: any) => Record<string, unknown>,
): void {
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()
  /* v8 ignore start */
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }
  /* v8 ignore stop */

  // `updateTeleports` 专门处理 Teleport 场景下被传送到组件树外的节点。
  const updateTeleports = (instance.ut = (vars = getter(instance.proxy)) => {
    Array.from(
      document.querySelectorAll(`[data-v-owner="${instance.uid}"]`),
    ).forEach(node => setVarsOnNode(node, vars))
  })

  if (__DEV__) {
    instance.getCssVars = () => getter(instance.proxy)
  }

  // 把最新 CSS 变量同步到组件当前渲染出来的真实节点上。
  const setVars = () => {
    const vars = getter(instance.proxy)
    if (instance.ce) {
      setVarsOnNode(instance.ce as any, vars)
    } else {
      setVarsOnVNode(instance.subTree, vars)
    }
    updateTeleports(vars)
  }

  // 子组件根节点变化时，先在本轮更新后再统一刷变量，避免挂载中途节点还不稳定。
  onBeforeUpdate(() => {
    queuePostFlushCb(setVars)
  })

  onMounted(() => {
    // 首次挂载后同步执行一次，后续变化则走 post-flush watch。
    watch(setVars, NOOP, { flush: 'post' })
    const ob = new MutationObserver(setVars)
    ob.observe(instance.subTree.el!.parentNode, { childList: true })
    onUnmounted(() => ob.disconnect())
  })
}

/**
 * 作用：沿着 vnode 结构把 CSS 变量下发到真正的元素节点。
 */
function setVarsOnVNode(vnode: VNode, vars: Record<string, unknown>) {
  if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    const suspense = vnode.suspense!
    vnode = suspense.activeBranch!
    if (suspense.pendingBranch && !suspense.isHydrating) {
      suspense.effects.push(() => {
        setVarsOnVNode(suspense.activeBranch!, vars)
      })
    }
  }

  // 高阶组件外壳本身不对应真实元素，要一直钻到最终子树。
  while (vnode.component) {
    vnode = vnode.component.subTree
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el) {
    setVarsOnNode(vnode.el as Node, vars)
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c => setVarsOnVNode(c, vars))
  } else if (vnode.type === Static) {
    let { el, anchor } = vnode
    while (el) {
      setVarsOnNode(el as Node, vars)
      if (el === anchor) break
      el = el.nextSibling
    }
  }
}

/**
 * 作用：把一组 CSS 变量直接写到某个真实 DOM 节点的 style 上。
 */
function setVarsOnNode(el: Node, vars: Record<string, unknown>) {
  if (el.nodeType === 1) {
    const style = (el as HTMLElement).style
    // `cssText` 额外缓存一份纯变量文本，后续 `patchStyle` 整段覆盖时会把它拼回去。
    let cssText = ''
    for (const key in vars) {
      const value = normalizeCssVarValue(vars[key])
      style.setProperty(`--${key}`, value)
      cssText += `--${key}: ${value};`
    }
    ;(style as any)[CSS_VAR_TEXT] = cssText
  }
}
