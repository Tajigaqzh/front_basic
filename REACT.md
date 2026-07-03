# React 面试题

## 一、React 基础

### 1. React 是什么？它解决了什么问题？

React 是一个用于构建用户界面的 JavaScript 库，核心思想是组件化和声明式渲染。

它主要解决：

- 复杂 UI 的状态和视图同步问题
- 页面模块复用问题
- 手动 DOM 操作带来的维护成本
- 大型前端应用的结构组织问题

### 2. React 的声明式渲染是什么意思？

声明式渲染指开发者只描述“当前状态下 UI 应该长什么样”，React 负责把状态变化同步到真实 DOM。

命令式写法关注过程：

```js
button.innerText = count;
button.addEventListener('click', () => {
  count++;
  button.innerText = count;
});
```

React 写法关注结果：

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### 3. JSX 是什么？浏览器能直接执行 JSX 吗？

JSX 是 JavaScript 的语法扩展，用来描述 UI 结构。浏览器不能直接执行 JSX，需要经过 Babel、TypeScript 或构建工具转换成普通 JavaScript。

示例：

```jsx
const element = <h1>Hello</h1>;
```

会被转换为类似：

```js
const element = React.createElement('h1', null, 'Hello');
```

### 4. 组件的本质是什么？

React 组件本质上是接收输入并返回 UI 描述的函数。

```jsx
function UserCard({ name }) {
  return <div>{name}</div>;
}
```

输入通常是 props、state、context，输出是 React Element。

### 5. React Element 和 React Component 有什么区别？

React Element 是描述 UI 的普通对象，不是真实 DOM。

React Component 是创建 React Element 的函数或类。

```jsx
function App() {
  return <h1>Hello</h1>;
}

const element = <App />;
```

这里 `App` 是组件，`<App />` 产生的是 React Element。

### 6. props 和 state 有什么区别？

props：

- 由父组件传入
- 子组件不应该直接修改
- 用于组件之间传递数据

state：

- 组件内部维护
- 通过 setState 或 Hooks 更新
- 更新后会触发组件重新渲染

### 7. 为什么不能直接修改 state？

React 依赖状态引用变化来判断是否需要更新 UI。直接修改 state 可能不会触发渲染，也会破坏状态快照。

错误示例：

```js
state.count++;
setState(state);
```

正确示例：

```js
setState(prev => ({
  ...prev,
  count: prev.count + 1,
}));
```

### 8. key 的作用是什么？

key 用于帮助 React 在列表更新时识别每个节点的身份，从而更准确地复用、移动或销毁元素。

稳定的 key 可以减少不必要的 DOM 更新，并避免组件状态错乱。

### 9. 为什么不推荐使用数组 index 作为 key？

当列表会新增、删除、排序时，index 会变化，React 可能错误复用组件，导致输入框内容、动画状态或组件内部 state 错乱。

只有列表完全静态、不排序、不增删时，index 才相对安全。

### 10. 什么是受控组件和非受控组件？

受控组件：表单值由 React state 控制。

```jsx
function Form() {
  const [value, setValue] = useState('');

  return <input value={value} onChange={e => setValue(e.target.value)} />;
}
```

非受控组件：表单值由 DOM 自己维护，React 通过 ref 获取。

```jsx
function Form() {
  const inputRef = useRef(null);

  return <input ref={inputRef} />;
}
```

## 二、生命周期与渲染机制

### 11. React 函数组件什么时候会重新渲染？

常见触发条件：

- state 更新
- props 变化
- context value 变化
- 父组件重新渲染
- 外部 store 订阅结果变化

### 12. 重新渲染是否一定会更新真实 DOM？

不一定。重新渲染会重新执行组件函数，生成新的 React Element。React 会通过协调过程比较前后结果，只有必要变化才会提交到真实 DOM。

### 13. React 的 render 阶段和 commit 阶段有什么区别？

render 阶段：

- 计算新的组件树
- 可以被中断、暂停、重新执行
- 不应该执行副作用

commit 阶段：

- 把变更提交到真实 DOM
- 执行 layout effect 和 effect
- 不会被中断

### 14. 什么是 Virtual DOM？

Virtual DOM 是 React 用 JavaScript 对象描述 UI 树的一种方式。React 通过比较新旧 Virtual DOM，计算出需要更新的真实 DOM 操作。

Virtual DOM 的价值不只是“更快”，更重要的是提供跨平台、声明式和批量更新的抽象。

### 15. Diff 算法的核心假设是什么？

React Diff 基于两个主要假设：

- 不同类型的元素会产生不同的树
- 开发者可以通过 key 提示哪些子元素是稳定的

这让 React 可以把复杂度从通用树比较的 O(n^3) 降低到更适合 UI 场景的 O(n)。

### 16. React 18 的自动批处理是什么？

自动批处理指 React 会把同一轮事件循环中的多个 state 更新合并成一次渲染，以减少渲染次数。

React 18 以后，不只 React 事件中会批处理，Promise、setTimeout、原生事件中的更新也会默认批处理。

### 17. setState 是同步还是异步？

更准确地说，setState 是“调度一次更新”，不是立即修改当前变量。

在同一次渲染中，state 是一个快照：

```jsx
setCount(count + 1);
console.log(count); // 仍然是当前渲染里的旧值
```

如果依赖上一次状态，应该使用函数式更新：

```jsx
setCount(prev => prev + 1);
```

### 18. 为什么函数组件每次渲染都会重新执行？

函数组件的返回值描述当前状态下的 UI。每次状态或 props 变化时，React 重新执行函数组件，得到新的 UI 描述，再与之前的结果进行协调。

### 19. StrictMode 为什么会让组件渲染两次？

开发环境下，StrictMode 会故意重复调用某些函数，用来帮助发现不纯的渲染逻辑和副作用问题。生产环境不会这样重复调用。

### 20. flushSync 有什么作用？

`flushSync` 可以强制 React 同步刷新更新，常用于需要立刻读取更新后 DOM 的场景。

```jsx
import { flushSync } from 'react-dom';

flushSync(() => {
  setOpen(true);
});

// 此时可以读取更新后的 DOM
```

它会打断 React 的批处理优化，不应滥用。

## 三、Hooks 高频题

### 21. Hooks 解决了什么问题？

Hooks 让函数组件可以使用 state、副作用、context、ref 等能力，也方便复用状态逻辑。

它主要改善：

- 类组件生命周期逻辑分散
- this 绑定复杂
- 高阶组件和 render props 嵌套过深
- 状态逻辑复用困难

### 22. Hooks 的使用规则是什么？

- 只在函数组件或自定义 Hook 顶层调用
- 不在条件、循环、嵌套函数中调用
- Hook 调用顺序必须在每次渲染中保持一致

### 23. 为什么 Hooks 不能写在条件语句中？

React 通过 Hook 的调用顺序来关联每个 Hook 对应的内部状态。如果条件调用导致顺序变化，React 就无法正确匹配状态。

错误示例：

```jsx
if (visible) {
  const [name, setName] = useState('');
}
```

### 24. useState 的初始值什么时候生效？

初始值只在组件首次挂载时生效，后续重新渲染不会重新初始化。

如果初始值计算成本较高，可以传入函数：

```jsx
const [value, setValue] = useState(() => expensiveInit());
```

### 25. useEffect 的作用是什么？

`useEffect` 用来处理渲染之后的副作用，比如请求数据、订阅事件、操作外部系统、设置定时器等。

```jsx
useEffect(() => {
  document.title = title;
}, [title]);
```

### 26. useEffect 的依赖数组有什么作用？

依赖数组决定 effect 什么时候重新执行。

```jsx
useEffect(() => {
  // 每次渲染后执行
});

useEffect(() => {
  // 只在挂载后执行一次
}, []);

useEffect(() => {
  // count 变化后执行
}, [count]);
```

### 27. useEffect 的清理函数什么时候执行？

清理函数会在组件卸载时执行，也会在下一次 effect 执行前先执行旧 effect 的清理函数。

```jsx
useEffect(() => {
  const timer = setInterval(tick, 1000);

  return () => clearInterval(timer);
}, []);
```

### 28. useEffect 和 useLayoutEffect 有什么区别？

`useEffect` 在浏览器完成绘制后异步执行，不阻塞页面渲染。

`useLayoutEffect` 在 DOM 更新后、浏览器绘制前同步执行，适合读取布局并同步修改 DOM。

常规副作用优先使用 `useEffect`，只有避免闪烁或必须同步测量布局时才使用 `useLayoutEffect`。

### 29. useMemo 和 useCallback 有什么区别？

`useMemo` 缓存计算结果：

```jsx
const list = useMemo(() => filterItems(items, keyword), [items, keyword]);
```

`useCallback` 缓存函数引用：

```jsx
const handleClick = useCallback(() => {
  setCount(prev => prev + 1);
}, []);
```

本质上：

```js
useCallback(fn, deps);
useMemo(() => fn, deps);
```

### 30. useMemo 是否一定能提升性能？

不一定。`useMemo` 本身也有依赖比较和缓存成本。只有在计算昂贵、引用稳定对下游组件有意义，或避免重复创建复杂对象时才值得使用。

### 31. useRef 有哪些用途？

常见用途：

- 获取 DOM 节点
- 保存跨渲染的可变值
- 保存定时器 id
- 保存上一次 props 或 state
- 避免闭包读取旧值

```jsx
const countRef = useRef(0);
countRef.current += 1;
```

修改 `ref.current` 不会触发重新渲染。

### 32. useRef 和 useState 有什么区别？

`useState` 更新会触发重新渲染，适合影响 UI 的数据。

`useRef` 更新不会触发重新渲染，适合保存实例变量、DOM 引用或不直接影响视图的数据。

### 33. useReducer 适合什么场景？

`useReducer` 适合状态结构复杂、更新逻辑依赖 action、多个状态字段联动的场景。

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    default:
      return state;
  }
}
```

### 34. useContext 有什么问题？

`useContext` 会让消费该 context 的组件在 value 变化时重新渲染。若 context value 是一个频繁变化的大对象，可能导致不必要的渲染。

优化方式：

- 拆分 context
- memoize provider value
- 使用 selector 型状态库
- 把频繁变化的数据移到外部 store

### 35. 自定义 Hook 是什么？

自定义 Hook 是以 `use` 开头的函数，用于复用组件状态逻辑。

```jsx
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}
```

## 四、闭包、依赖与常见陷阱

### 36. 什么是 stale closure？

stale closure 指函数闭包捕获了某次渲染中的旧状态，后续执行时读到的不是最新值。

常见问题：

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(count + 1);
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

这里 `count` 一直是初始渲染时的值。

修复：

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(prev => prev + 1);
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

### 37. useEffect 依赖数组可以随便省略吗？

不可以。effect 中用到的外部变量通常都应该放进依赖数组。省略依赖可能导致读取旧值。

如果加入依赖导致循环，通常说明 effect 里混入了不该放在 effect 里的派生逻辑，或函数、对象引用需要稳定化。

### 38. 如何避免 useEffect 无限循环？

常见方法：

- 不在 effect 中无条件更新它依赖的 state
- 把对象和函数用 `useMemo`、`useCallback` 稳定引用
- 把派生状态改为渲染时计算
- 检查依赖是否每次渲染都会创建新引用

### 39. 什么时候不应该使用 useEffect？

以下场景通常不需要 effect：

- 根据 props 或 state 计算派生数据
- 处理用户事件
- 初始化可以在 `useState` 函数中完成的值
- 子组件通知父组件做同步状态转换

示例：

```jsx
const fullName = `${firstName} ${lastName}`;
```

不需要：

```jsx
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

### 40. 如何在事件回调里读取最新 state？

优先使用函数式更新：

```jsx
setCount(prev => prev + 1);
```

如果是异步回调或外部订阅，可以用 ref 保存最新值：

```jsx
const latestValue = useRef(value);

useEffect(() => {
  latestValue.current = value;
}, [value]);
```

## 五、性能优化

### 41. React 性能优化的方向有哪些？

常见方向：

- 减少不必要的重新渲染
- 降低单次渲染成本
- 拆分组件和状态作用域
- 虚拟列表
- 懒加载和代码分割
- 缓存昂贵计算
- 使用 transition 降低交互阻塞
- 服务端渲染或流式渲染改善首屏体验

### 42. React.memo 的作用是什么？

`React.memo` 用于缓存组件渲染结果。当 props 浅比较没有变化时，React 可以跳过该组件重新渲染。

```jsx
const UserItem = React.memo(function UserItem({ user }) {
  return <div>{user.name}</div>;
});
```

### 43. React.memo 为什么有时无效？

常见原因：

- 父组件每次传入新的对象或函数
- 子组件内部 state 或 context 变化
- props 虽然内容一样，但引用不同
- 自定义比较函数写得不正确

### 44. 如何优化大列表渲染？

常见方式：

- 使用虚拟列表，只渲染可视区域
- 分页或无限滚动
- 稳定 key
- 避免每个列表项创建过多匿名函数或对象
- 把列表项拆成 memo 组件

常用库包括 `react-window`、`react-virtualized`、`@tanstack/react-virtual`。

### 45. 什么是代码分割？

代码分割指把应用拆成多个 bundle，按需加载，减少首屏 JavaScript 体积。

```jsx
const Settings = React.lazy(() => import('./Settings'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Settings />
    </Suspense>
  );
}
```

### 46. useTransition 有什么作用？

`useTransition` 用于标记非紧急更新，让 React 优先处理输入、点击等紧急交互，延后处理昂贵的 UI 更新。

```jsx
const [isPending, startTransition] = useTransition();

function handleChange(value) {
  setInput(value);
  startTransition(() => {
    setQuery(value);
  });
}
```

### 47. useDeferredValue 有什么作用？

`useDeferredValue` 可以延迟某个值的更新，让昂贵的子树使用滞后的值渲染，从而保持输入流畅。

```jsx
const deferredQuery = useDeferredValue(query);
```

### 48. Suspense 可以做什么？

Suspense 可以在组件等待某些异步资源时显示 fallback。常见于代码分割、框架级数据获取、服务端组件和流式渲染。

```jsx
<Suspense fallback={<Spinner />}>
  <Profile />
</Suspense>
```

### 49. 如何定位 React 性能问题？

常用手段：

- React DevTools Profiler
- 浏览器 Performance 面板
- 查看组件重新渲染原因
- 检查大列表、昂贵计算、频繁 context 更新
- 分析 bundle 体积

### 50. 过度优化有哪些问题？

过度使用 `memo`、`useMemo`、`useCallback` 会增加代码复杂度，也会带来比较和缓存成本。优化应基于测量结果，而不是预设猜测。

## 六、组件设计与状态管理

### 51. 如何设计一个可复用组件？

关注点：

- 明确组件职责
- props API 简洁稳定
- 支持受控和非受控模式
- 合理暴露事件回调
- 组合优于配置
- 样式和业务逻辑解耦
- 可访问性友好

### 52. 什么是组件组合？

组件组合指通过 children 或插槽式 API 组合复杂 UI，而不是把所有行为塞进大量 props。

```jsx
function Card({ header, children, footer }) {
  return (
    <section>
      <header>{header}</header>
      <main>{children}</main>
      <footer>{footer}</footer>
    </section>
  );
}
```

### 53. props drilling 是什么？如何解决？

props drilling 指数据需要经过多层中间组件传递，但中间组件并不使用这些数据。

解决方式：

- 适当提升或下沉 state
- 组件组合
- Context
- 外部状态管理库

### 54. 如何判断 state 应该放在哪里？

原则：

- 谁需要读取，就放在最近公共父组件
- 只被一个组件使用，就放在该组件内部
- 多页面或跨模块共享，考虑外部 store
- 服务端数据优先交给请求缓存库或框架处理

### 55. React Context 适合管理所有状态吗？

不适合。Context 更适合低频变化的全局数据，比如主题、语言、当前用户、权限。

频繁变化的大型业务状态用 Context 可能导致大范围重新渲染，通常更适合 Zustand、Redux Toolkit、Jotai、Recoil 或 TanStack Query 等方案。

### 56. Redux 的核心思想是什么？

Redux 的核心思想：

- 单一数据源
- state 只读
- 使用纯函数 reducer 根据 action 生成新 state

现代 React 项目中通常使用 Redux Toolkit 简化样板代码。

### 57. Redux 和 Zustand 有什么区别？

Redux：

- 约束强
- 生态成熟
- DevTools 和中间件完善
- 更适合大型团队和复杂状态流

Zustand：

- API 简洁
- 样板代码少
- 基于 selector 订阅状态
- 更适合中小型项目或局部复杂状态

### 58. TanStack Query 解决什么问题？

TanStack Query 主要管理服务端状态，例如请求、缓存、重试、分页、失效刷新、乐观更新、请求去重。

它不是传统意义上的客户端状态管理库。

### 59. 客户端状态和服务端状态有什么区别？

客户端状态：

- 只存在于前端
- 由用户交互产生
- 例如弹窗开关、表单输入、主题

服务端状态：

- 来源于后端
- 需要请求、缓存、同步、失效
- 例如用户列表、订单数据、权限配置

### 60. 如何处理表单状态？

简单表单可以使用受控组件和 `useState`。

复杂表单可以使用：

- React Hook Form
- Formik
- Final Form
- Zod 或 Yup 做校验

大型表单要重点关注性能、校验时机、错误展示和可访问性。

## 七、路由、SSR 与服务端组件

### 61. React Router 的核心能力有哪些？

常见能力：

- 路由匹配
- 嵌套路由
- 动态路由参数
- 路由跳转
- 懒加载
- loader 和 action
- 错误边界

### 62. CSR、SSR、SSG 有什么区别？

CSR：

- 浏览器下载 JS 后渲染页面
- 首屏依赖客户端执行

SSR：

- 服务端每次请求生成 HTML
- 首屏更快，利于 SEO

SSG：

- 构建时生成静态 HTML
- 访问速度快，适合内容更新不频繁的页面

### 63. Hydration 是什么？

Hydration 指服务端返回 HTML 后，客户端 React 接管这些已有 DOM，并绑定事件、恢复交互能力。

如果服务端和客户端渲染结果不一致，就可能出现 hydration mismatch。

### 64. 常见 hydration mismatch 原因有哪些？

常见原因：

- 服务端和客户端时间、随机数不同
- 直接访问 `window`、`document`
- 用户本地化信息不一致
- 根据客户端环境渲染不同结构
- HTML 嵌套不合法

### 65. React Server Components 是什么？

React Server Components 是在服务端执行的 React 组件。它们可以直接访问服务端资源，比如数据库或文件系统，不会把组件代码发送到客户端。

它适合减少客户端 JavaScript 体积，并把数据获取靠近服务端。

### 66. Server Component 和 Client Component 有什么区别？

Server Component：

- 在服务端渲染
- 不能使用 state、effect、浏览器 API
- 可以直接访问服务端资源
- 不发送组件代码到客户端

Client Component：

- 在客户端运行
- 可以使用 state、effect、事件处理
- 可以访问浏览器 API
- 需要打包发送到浏览器

### 67. Next.js 中 `'use client'` 的作用是什么？

`'use client'` 用于声明当前文件是 Client Component 的入口。该文件及其依赖会进入客户端 bundle，可以使用 Hooks、事件和浏览器 API。

### 68. 服务端组件可以传函数给客户端组件吗？

通常不可以。Server Component 传给 Client Component 的 props 需要可序列化。事件处理函数应定义在 Client Component 中。

如果需要服务端动作，框架可能提供 Server Actions。

### 69. 什么是流式渲染？

流式渲染指服务端可以分段发送 HTML，让浏览器更早看到部分内容。配合 Suspense，慢组件可以后续补齐。

### 70. 错误边界是什么？

错误边界用于捕获子组件渲染阶段、生命周期或构造函数中的错误，并展示降级 UI。

传统错误边界需要类组件：

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
```

错误边界不能捕获事件处理器、异步回调和服务端渲染错误。

## 八、React 19 相关

### 71. React 19 有哪些值得关注的变化？

React 19 引入和稳定了一些面向异步交互、表单和资源加载的能力，常见关注点包括：

- Actions
- `useActionState`
- `useOptimistic`
- `use`
- ref 作为普通 prop
- 改进 hydration 错误信息
- 支持文档元数据、样式表和异步脚本等资源管理能力

具体使用方式会受到框架版本影响，面试中应结合项目技术栈回答。

### 72. React 19 中 ref 作为 prop 是什么意思？

React 19 支持函数组件直接接收 `ref` prop，不再总是需要 `forwardRef` 包装。

```jsx
function MyInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}
```

兼容旧项目时仍要注意当前 React 版本和类型定义支持情况。

### 73. useOptimistic 适合什么场景？

`useOptimistic` 适合乐观更新。用户提交操作后，UI 可以先展示预期结果，再根据服务端结果确认或回滚。

常见场景：

- 点赞
- 评论提交
- 收藏
- 任务状态切换

### 74. useActionState 解决什么问题？

`useActionState` 用于根据表单 action 的执行结果更新状态，适合处理提交状态、错误信息和服务端返回结果。

### 75. React 19 的 use API 可以做什么？

`use` 可以在组件中读取 Promise 或 Context。当 Promise 尚未完成时，组件会挂起并由 Suspense 处理 fallback。

它通常与框架的数据获取和服务端能力结合使用。

## 九、测试与工程化

### 76. React 组件测试关注什么？

组件测试应更关注用户行为和可见结果，而不是组件内部实现。

常用工具：

- React Testing Library
- Jest
- Vitest
- Playwright
- Cypress

### 77. React Testing Library 的理念是什么？

React Testing Library 鼓励从用户视角测试组件，通过文本、角色、标签等方式查询元素，避免依赖内部实现细节。

### 78. 如何测试异步请求组件？

常见方式：

- mock 请求层
- 使用 MSW 模拟接口
- 等待 loading 消失或数据出现
- 断言错误状态和空状态

### 79. 如何做 React 项目的代码分层？

常见分层：

- components：通用组件
- pages 或 routes：页面和路由
- features：业务功能模块
- hooks：可复用 Hook
- services 或 api：请求层
- stores：状态管理
- utils：纯工具函数
- types：共享类型

实际项目应按团队规模和业务复杂度调整。

### 80. React 项目如何做错误监控？

常见方式：

- Error Boundary 捕获渲染错误
- window.onerror 捕获全局错误
- unhandledrejection 捕获未处理 Promise 错误
- 接入 Sentry、Datadog、LogRocket 等监控平台
- 上报用户行为、路由、版本号和 sourcemap

## 十、手写题与代码题

### 81. 手写 usePrevious

```jsx
function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
```

### 82. 手写 useDebounce

```jsx
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

### 83. 手写 useThrottle

```jsx
function useThrottle(value, delay) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const remaining = delay - (Date.now() - lastRun.current);

    if (remaining <= 0) {
      lastRun.current = Date.now();
      setThrottledValue(value);
      return;
    }

    const timer = setTimeout(() => {
      lastRun.current = Date.now();
      setThrottledValue(value);
    }, remaining);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return throttledValue;
}
```

### 84. 手写 useToggle

```jsx
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue(prev => !prev);
  }, []);

  return [value, toggle, setValue];
}
```

### 85. 手写 useLocalStorage

```jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors such as private mode or quota exceeded.
    }
  }, [key, value]);

  return [value, setValue];
}
```

### 86. 手写 useClickOutside

```jsx
function useClickOutside(ref, handler) {
  useEffect(() => {
    function handleClick(event) {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }

      handler(event);
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, handler]);
}
```

### 87. 手写 useInterval

```jsx
function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) {
      return;
    }

    const timer = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(timer);
  }, [delay]);
}
```

### 88. 实现一个 Tabs 组件需要考虑什么？

需要考虑：

- 当前选中 tab 状态
- 受控和非受控模式
- 键盘导航
- ARIA 属性
- 内容懒加载
- tab 禁用状态
- 样式扩展能力

### 89. 实现一个 Modal 组件需要考虑什么？

需要考虑：

- Portal 渲染到 body
- Esc 关闭
- 点击遮罩关闭
- 焦点锁定
- 打开后禁止 body 滚动
- 关闭时恢复焦点
- 层级管理
- 可访问性属性

### 90. 实现虚拟列表的核心思路是什么？

核心思路：

- 根据滚动位置计算可视区域
- 只渲染可视区域内的元素
- 使用占位容器撑开总高度
- 通过 transform 或定位把可见元素放到正确位置
- 动态高度场景需要缓存测量结果

## 十一、开放题

### 91. 你在项目中如何做 React 性能优化？

回答建议：

- 先说明如何定位问题，而不是直接说用了 memo
- 说明具体业务场景
- 描述瓶颈，例如大列表、复杂表单、频繁 context 更新
- 说明优化方案和收益
- 说明是否有监控或 profile 数据

### 92. 你如何设计一个组件库？

回答建议：

- 组件分层：基础组件、业务组件、布局组件
- API 设计：受控、非受控、组合式 API
- 样式方案：CSS Modules、CSS-in-JS、Tailwind、Design Token
- 可访问性
- 主题系统
- 测试策略
- 文档和示例
- 打包产物和 tree shaking

### 93. React 项目首屏慢怎么排查？

排查方向：

- bundle 是否过大
- 是否有未拆分的重型依赖
- 接口是否慢
- SSR 或 hydration 是否耗时
- 图片、字体、第三方脚本是否阻塞
- 主线程是否被长任务占用
- CDN 和缓存策略是否合理

### 94. 如何处理 React 应用中的权限控制？

常见层次：

- 路由级权限
- 页面级权限
- 组件级权限
- 操作按钮级权限
- 接口级权限

前端权限只负责体验和展示，真正的安全必须由后端校验。

### 95. 如何做 React 应用的国际化？

常见方案：

- react-i18next
- FormatJS
- Lingui

需要考虑：

- 文案提取
- 插值和复数
- 日期、数字、货币格式
- 语言包懒加载
- SSR 场景下的语言协商

### 96. 微前端中 React 应用如何集成？

常见方案：

- qiankun
- single-spa
- Module Federation
- iframe

需要关注：

- 路由隔离
- 样式隔离
- 状态共享
- 依赖共享
- 构建和部署边界
- 通信机制

### 97. React 和 Vue 的主要区别是什么？

可以从以下角度回答：

- React 更偏 JavaScript 函数式组合，Vue 提供更多模板和框架约束
- React 使用 JSX，Vue 常用模板
- React 状态更新后重新执行组件函数，Vue 基于响应式依赖追踪
- React 生态选择更自由，Vue 官方方案更集中

不要简单说谁更好，应结合团队、项目和生态选择。

### 98. React 中如何避免内存泄漏？

常见做法：

- effect 中清理定时器
- 移除事件监听
- 取消订阅
- 组件卸载后避免更新状态
- 中断不再需要的请求

示例：

```jsx
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/user', { signal: controller.signal });

  return () => controller.abort();
}, []);
```

### 99. 你如何理解 React 的不可变数据？

不可变数据指更新状态时不修改原对象，而是创建新对象或新数组。这样可以让 React 更容易通过引用变化判断更新，也能减少副作用。

```js
setUsers(users.map(user => (
  user.id === id ? { ...user, name: nextName } : user
)));
```

### 100. React 面试中回答问题的原则是什么？

建议按这个结构回答：

1. 先给结论
2. 再解释原理
3. 补充适用场景
4. 说明边界和坑
5. 最后结合项目经验

例如问 `useMemo`：

先说它缓存计算结果，再说依赖变化才重新计算，然后说明适合昂贵计算或稳定引用，最后补充不是所有场景都能提升性能。
