/**
 * @beginner-module: 源码导读
 * 本文件把 JSX/createElement 调用转换为 ReactElement 描述对象。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 引入当前文件依赖的模块，后面的代码会使用这些能力。
import {
  REACT_CACHE_TYPE,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_PROFILER_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_STRICT_MODE_TYPE,
} from "shared";
// @beginner: 引入类型，只在 TypeScript 编译期使用，运行时不会生成代码。
import type { ElementType, Key, Props, ReactElement, ReactNode } from "shared";

// @beginner: RESERVED_PROPS 是 React 自己消费的特殊字段，不能透传到组件 props。
const RESERVED_PROPS = new Set(["key", "__self", "__source"]);

// @beginner: Fragment 对应 JSX 里的 <>...</>，它不会创建额外 DOM 节点。
export const Fragment = REACT_FRAGMENT_TYPE;
// @beginner: Profiler 是性能分析组件，Fiber 创建时会识别这个 symbol。
export const Profiler = REACT_PROFILER_TYPE;
// @beginner: Suspense 用于等待异步依赖，渲染时可能切换到 fallback 子树。
export const Suspense = REACT_SUSPENSE_TYPE;
// @beginner: StrictMode 给子树打严格模式标记，用于开发期额外检查。
export const StrictMode = REACT_STRICT_MODE_TYPE;
// @beginner: unstable_Cache 对应缓存边界，复刻版保留它的元素类型入口。
export const unstable_Cache = REACT_CACHE_TYPE;

// @beginner: 进入 ReactElement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function ReactElement<P extends Props>(
  type: ElementType,
  key: Key,
  props: P,
): ReactElement<P> {
  // ReactElement 是“你想渲染什么”的轻量描述对象，不是真实 DOM。
  // JSX `<div id="a" />` 编译后会调用 jsx/createElement，最后得到的就是这个对象。
  // reconciler 后续只读取 type/key/props：
  // - type 决定 Fiber tag：字符串是 HostComponent，函数是 FunctionComponent。
  // - key 用于同层 children diff，帮助判断旧 Fiber 能不能复用。
  // - props 保存组件参数、DOM 属性和 children。
  // 官方源码里还会记录 owner、debugStack 等开发态字段；复刻版保留主路径字段。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return {
    // $$typeof 是 ReactElement 的身份标记，防止普通对象被误认为 React 元素。
    $$typeof: REACT_ELEMENT_TYPE,
    // type 可以是 "div"、函数组件、Fragment、Suspense 等。
    type,
    // key 不会进入 props，它只服务于调和阶段的节点复用。
    key,
    // props 是渲染输入；children 也会被折叠进 props.children。
    props,
  };
}

// @beginner: 进入 createElement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function createElement<P extends Props>(
  type: ElementType,
  config: (P & { key?: Key }) | null,
  ...children: ReactNode[]
): ReactElement<P> {
  // props 从空对象开始收集。这里不直接复用 config，是为了剥离 key/__self/__source。
  // @beginner: props 是最终交给组件或 DOM 标签的参数对象。
  const props: Props = {};
  // key 默认为 null；只有用户显式传入 key 时才转成字符串。
  // @beginner: key 单独保存给 reconciler 使用，不放进 props。
  let key: Key = null;

  // @beginner: config 存在时，说明 JSX 里写了属性，例如 id、className、key。
  if (config !== null) {
    // key 是 React 自己使用的保留字段，不应该透传给组件的 props.key。
    // @beginner: 条件分支：根据当前值选择不同处理路径。
    if (config.key !== undefined && config.key !== null) {
      key = String(config.key);
    }

    // 把普通属性复制进 props；__self/__source 是 JSX 开发态调试字段，也不参与渲染。
    // @beginner: 遍历 JSX 属性，把普通属性复制到 props。
    for (const propName of Object.keys(config)) {
      // @beginner: 条件分支：根据当前值选择不同处理路径。
      if (!RESERVED_PROPS.has(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // React 的 children 规则：
  // - 一个 child：直接保存这个值。
  // - 多个 child：保存数组。
  // - 没有 child：不设置 props.children。
  // @beginner: children 参数个数决定 props.children 的最终形态。
  if (children.length === 1) {
    props.children = children[0];
  // @beginner: 继续判断另一个条件；前一个条件不满足时才会进入这里。
  } else if (children.length > 1) {
    props.children = children;
  }

  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return ReactElement(type, key, props as P);
}

// @beginner: 进入 isValidElement：这是一个可复用步骤，调用方通过它完成一段明确逻辑。
export function isValidElement(value: unknown): value is ReactElement {
  // 判断是否是 ReactElement 不看 type/props 是否合理，只看对象身份标记。
  // 这和官方 React.isValidElement 的核心思路一致。
  // @beginner: 返回当前函数的结果；调用方会基于这个值继续后续流程。
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ReactElement).$$typeof === REACT_ELEMENT_TYPE
  );
}
