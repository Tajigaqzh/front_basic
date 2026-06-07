/**
 * 文件作用：为 runtime-core 暴露 Chrome DevTools 自定义格式化器。
 *
 * 它只在开发环境参与调试链路，不参与真实渲染。
 * 主要职责是把组件实例、ref、reactive、readonly 等对象格式化成更适合在 DevTools 中查看的结构。
 */

import {
  type Ref,
  isReactive,
  isReadonly,
  isRef,
  isShallow,
  pauseTracking,
  resetTracking,
  toRaw,
} from '@vue-source/reactivity'
import { EMPTY_OBJ, extend, isArray, isFunction, isObject } from '@vue-source/shared'
import type { ComponentInternalInstance, ComponentOptions } from './component'
import type { ComponentPublicInstance } from './componentPublicInstance'

export function initCustomFormatter(): void {
  /* eslint-disable no-restricted-globals */
  if (!__DEV__ || typeof window === 'undefined') {
    // 生产环境或非浏览器环境都不需要注册 DevTools 自定义格式化器。
    return
  }

  // 这几组样式对象会复用到不同类型值的展示节点上，避免重复拼接内联样式。
  const vueStyle = { style: 'color:#3ba776' }
  const numberStyle = { style: 'color:#1677ff' }
  const stringStyle = { style: 'color:#f5222d' }
  const keywordStyle = { style: 'color:#eb2f96' }

  // custom formatter for Chrome
  // https://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html
  const formatter = {
    __vue_custom_formatter: true,
    /**
     * 作用：生成对象在 DevTools 摘要区的显示结果。
     *
     * 依赖关系：
     * - 识别组件实例、Ref、Reactive、Readonly 等对象类型。
     * - 读取 ref.value 前会暂停依赖收集，避免调试时意外建立响应式追踪。
     */
    header(obj: unknown) {
      // TODO also format ComponentPublicInstance & ctx.slots/attrs in setup
      if (!isObject(obj)) {
        return null
      }

      if (obj.__isVue) {
        return ['div', vueStyle, `VueInstance`]
      } else if (isRef(obj)) {
        // avoid tracking during debugger accessing
        pauseTracking()
        const value = obj.value
        resetTracking()
        // 读取 ref.value 时暂停追踪，避免“打开控制台看一下”也把调试器访问记成业务依赖。
        return [
          'div',
          {},
          ['span', vueStyle, genRefFlag(obj)],
          '<',
          formatValue(value),
          `>`,
        ]
      } else if (isReactive(obj)) {
        return [
          'div',
          {},
          ['span', vueStyle, isShallow(obj) ? 'ShallowReactive' : 'Reactive'],
          '<',
          formatValue(obj),
          `>${isReadonly(obj) ? ` (readonly)` : ``}`,
        ]
      } else if (isReadonly(obj)) {
        return [
          'div',
          {},
          ['span', vueStyle, isShallow(obj) ? 'ShallowReadonly' : 'Readonly'],
          '<',
          formatValue(obj),
          '>',
        ]
      }
      return null
    },
    hasBody(obj: unknown) {
      // 只有 Vue 组件公开实例在展开时需要额外展示分块内容。
      return obj && (obj as any).__isVue
    },
    /**
     * 作用：组件实例展开后，按块展示 props/setup/data/computed/inject 等内部状态。
     */
    body(obj: unknown) {
      if (obj && (obj as any).__isVue) {
        return [
          'div',
          {},
          ...formatInstance((obj as ComponentPublicInstance).$),
        ]
      }
    },
  }

  function formatInstance(instance: ComponentInternalInstance) {
    // `blocks` 保存多个信息区块，最后统一交给 formatter 渲染。
    const blocks = []
    if (instance.type.props && instance.props) {
      blocks.push(createInstanceBlock('props', toRaw(instance.props)))
    }
    if (instance.setupState !== EMPTY_OBJ) {
      blocks.push(createInstanceBlock('setup', instance.setupState))
    }
    if (instance.data !== EMPTY_OBJ) {
      blocks.push(createInstanceBlock('data', toRaw(instance.data)))
    }
    const computed = extractKeys(instance, 'computed')
    if (computed) {
      blocks.push(createInstanceBlock('computed', computed))
    }
    const injected = extractKeys(instance, 'inject')
    if (injected) {
      blocks.push(createInstanceBlock('injected', injected))
    }

    blocks.push([
      'div',
      {},
      [
        'span',
        {
          style: keywordStyle.style + ';opacity:0.66',
        },
        '$ (internal): ',
      ],
      ['object', { object: instance }],
    ])
    // 最后一块故意把内部实例 `$` 也暴露出来，便于深挖 runtime 内部字段。
    return blocks
  }

  function createInstanceBlock(type: string, target: any) {
    // 先浅拷贝一份，避免调试展示过程直接触碰原对象上的 getter 或代理行为。
    target = extend({}, target)
    if (!Object.keys(target).length) {
      return ['span', {}]
    }
    return [
      'div',
      { style: 'line-height:1.25em;margin-bottom:0.6em' },
      [
        'div',
        {
          style: 'color:#476582',
        },
        type,
      ],
      [
        'div',
        {
          style: 'padding-left:1.25em',
        },
        ...Object.keys(target).map(key => {
          return [
            'div',
            {},
            ['span', keywordStyle, key + ': '],
            formatValue(target[key], false),
          ]
        }),
      ],
    ]
  }

  function formatValue(v: unknown, asRaw = true) {
    // formatter 需要返回描述数组；这里按值类型决定展示节点结构。
    if (typeof v === 'number') {
      return ['span', numberStyle, v]
    } else if (typeof v === 'string') {
      return ['span', stringStyle, JSON.stringify(v)]
    } else if (typeof v === 'boolean') {
      return ['span', keywordStyle, v]
    } else if (isObject(v)) {
      return ['object', { object: asRaw ? toRaw(v) : v }]
    } else {
      return ['span', stringStyle, String(v)]
    }
  }

  function extractKeys(instance: ComponentInternalInstance, type: string) {
    // 从实例上下文里筛出某一类来源的键，例如 computed / inject。
    const Comp = instance.type
    if (isFunction(Comp)) {
      // 函数组件没有 Options API 选项对象，这类来源信息不存在。
      return
    }
    const extracted: Record<string, any> = {}
    for (const key in instance.ctx) {
      if (isKeyOfType(Comp, key, type)) {
        extracted[key] = instance.ctx[key]
      }
    }
    return extracted
  }

  function isKeyOfType(Comp: ComponentOptions, key: string, type: string) {
    // 递归检查组件自身、extends、mixins，保证调试结果与真实选项合并结果一致。
    const opts = Comp[type]
    if (
      (isArray(opts) && opts.includes(key)) ||
      (isObject(opts) && key in opts)
    ) {
      return true
    }
    if (Comp.extends && isKeyOfType(Comp.extends, key, type)) {
      return true
    }
    if (Comp.mixins && Comp.mixins.some(m => isKeyOfType(m, key, type))) {
      return true
    }
  }

  function genRefFlag(v: Ref) {
    // 用统一标签区分普通 ref、浅层 ref 和 computed ref。
    if (isShallow(v)) {
      return `ShallowRef`
    }
    if ((v as any).effect) {
      return `ComputedRef`
    }
    return `Ref`
  }

  if ((window as any).devtoolsFormatters) {
    // 已有 formatter 数组时直接追加，避免覆盖其他库注册的自定义格式化器。
    ;(window as any).devtoolsFormatters.push(formatter)
  } else {
    ;(window as any).devtoolsFormatters = [formatter]
  }
}
