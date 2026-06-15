# React API

这个目录整理 React 常用 API 示例、使用场景和高频面试题。

React API 可以按几类理解：

- 状态管理：`useState`、`useReducer`
- 副作用：`useEffect`、`useLayoutEffect`、`useInsertionEffect`
- 引用和命令式能力：`useRef`、`useImperativeHandle`
- 跨组件数据：`createContext`、`useContext`
- 性能优化：`memo`、`useMemo`、`useCallback`
- 并发与体验优化：`useTransition`、`useDeferredValue`、`useOptimistic`
- 外部状态订阅：`useSyncExternalStore`
- 表单与 Action：`useActionState`
- 代码拆分：`lazy`、`Suspense`
- DOM 相关：`createRoot`、`hydrateRoot`、`createPortal`、`flushSync`

## Hook 规则

Hook 是 React 函数组件中使用状态和其他 React 能力的 API。

Hook 有两个核心规则：

- 只能在 React 函数组件或自定义 Hook 顶层调用
- 不能在条件、循环、嵌套函数、普通函数中调用

错误示例：

```jsx
function User({ visible }) {
  if (visible) {
    const [name, setName] = useState('')
  }

  return null
}
```

正确示例：

```jsx
function User({ visible }) {
  const [name, setName] = useState('')

  if (!visible) {
    return null
  }

  return <div>{name}</div>
}
```

原因：React 依赖 Hook 的调用顺序来关联每一次渲染中的状态。如果 Hook 调用顺序不稳定，React 就无法正确找到对应状态。

## useState

`useState` 用于给函数组件添加局部状态。

```jsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  )
}
```

### 函数式更新

如果新状态依赖旧状态，推荐使用函数式更新。

```jsx
setCount((prevCount) => prevCount + 1)
```

连续更新时尤其重要：

```jsx
function addThree() {
  setCount((count) => count + 1)
  setCount((count) => count + 1)
  setCount((count) => count + 1)
}
```

### 惰性初始化

初始化逻辑比较重时，可以传入函数，React 只会在首次渲染时调用它。

```jsx
const [list, setList] = useState(() => {
  return createLargeList()
})
```

注意：`setState` 不会立即修改当前渲染中的变量，它会触发下一次渲染。

```jsx
function handleClick() {
  setCount(count + 1)
  console.log(count) // 仍然是当前这次渲染里的 count
}
```

## useReducer

`useReducer` 适合管理复杂状态，尤其是状态变化有明确动作类型时。

```jsx
import { useReducer } from 'react'

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 }
    case 'decrement':
      return { count: state.count - 1 }
    case 'reset':
      return { count: 0 }
    default:
      return state
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 })

  return (
    <>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <span>{state.count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
    </>
  )
}
```

适合场景：

- 状态字段较多
- 多个状态之间有关联
- 更新逻辑复杂
- 希望把状态更新逻辑集中到 reducer 中

`useState` 更适合简单状态，`useReducer` 更适合复杂状态流转。

## useEffect

`useEffect` 用于处理渲染之后的副作用。

常见副作用：

- 请求数据
- 订阅事件
- 操作浏览器 API
- 设置定时器
- 同步外部系统状态

```jsx
import { useEffect, useState } from 'react'

function UserList() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    let ignore = false

    async function loadUsers() {
      const response = await fetch('/api/users')
      const data = await response.json()

      if (!ignore) {
        setUsers(data)
      }
    }

    loadUsers()

    return () => {
      ignore = true
    }
  }, [])

  return users.map((user) => <div key={user.id}>{user.name}</div>)
}
```

### 依赖数组

```jsx
useEffect(() => {
  document.title = title
}, [title])
```

依赖数组含义：

- 不传依赖：每次渲染后都执行
- `[]`：组件挂载后执行一次，卸载时清理
- `[a, b]`：首次执行，并在 `a` 或 `b` 变化后重新执行

### 清理函数

清理函数用于取消订阅、清除定时器、取消请求等。

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log('tick')
  }, 1000)

  return () => {
    clearInterval(timer)
  }
}, [])
```

事件监听：

```jsx
useEffect(() => {
  function handleResize() {
    console.log(window.innerWidth)
  }

  window.addEventListener('resize', handleResize)

  return () => {
    window.removeEventListener('resize', handleResize)
  }
}, [])
```

常见误区：

- 把可以在渲染时计算的值放进 `useEffect`
- 为了消除依赖警告随意删依赖
- 在 effect 里无条件 setState，导致重复渲染
- 忘记清理定时器、事件监听、订阅和请求

## useLayoutEffect

`useLayoutEffect` 和 `useEffect` 类似，但执行时机更早：它会在浏览器绘制前同步执行。

适合场景：

- 读取 DOM 尺寸
- 根据布局结果同步调整样式
- 避免用户看到闪烁

```jsx
import { useLayoutEffect, useRef, useState } from 'react'

function Tooltip() {
  const ref = useRef(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    setHeight(ref.current.getBoundingClientRect().height)
  }, [])

  return <div ref={ref}>height: {height}</div>
}
```

注意：`useLayoutEffect` 会阻塞浏览器绘制，不要滥用。大多数副作用应该优先使用 `useEffect`。

## useInsertionEffect

`useInsertionEffect` 主要给 CSS-in-JS 库使用，用于在布局 effect 前插入样式。

```jsx
useInsertionEffect(() => {
  insertStyle(rule)
}, [rule])
```

业务组件通常很少直接使用它。

## useRef

`useRef` 返回一个稳定对象，常用于保存 DOM 引用或跨渲染保存可变值。

```jsx
import { useRef } from 'react'

function InputFocus() {
  const inputRef = useRef(null)

  return (
    <>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>
        focus
      </button>
    </>
  )
}
```

保存可变值：

```jsx
function Timer() {
  const timerRef = useRef(null)

  function start() {
    timerRef.current = setInterval(() => {
      console.log('tick')
    }, 1000)
  }

  function stop() {
    clearInterval(timerRef.current)
  }

  return (
    <>
      <button onClick={start}>start</button>
      <button onClick={stop}>stop</button>
    </>
  )
}
```

`useRef` 和 `useState` 的区别：

- 修改 `ref.current` 不会触发重新渲染
- 修改 state 会触发重新渲染
- 需要展示到页面上的数据用 state
- 只想保存实例、DOM、定时器、最新值时用 ref

## useImperativeHandle

`useImperativeHandle` 用于自定义父组件通过 ref 能调用到的实例方法。

```jsx
import { forwardRef, useImperativeHandle, useRef } from 'react'

const SearchInput = forwardRef(function SearchInput(props, ref) {
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current.focus()
    },
    clear() {
      inputRef.current.value = ''
    }
  }), [])

  return <input ref={inputRef} />
})
```

使用：

```jsx
function Page() {
  const inputRef = useRef(null)

  return (
    <>
      <SearchInput ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>focus</button>
    </>
  )
}
```

注意：React 19 支持把 `ref` 作为 prop 传给函数组件；旧版本中函数组件接收 ref 通常需要 `forwardRef`。

## createContext 和 useContext

Context 用于跨层级传递数据，避免 props 一层层透传。

```jsx
import { createContext, useContext } from 'react'

const ThemeContext = createContext('light')

function App() {
  return (
    <ThemeContext value="dark">
      <Toolbar />
    </ThemeContext>
  )
}

function Toolbar() {
  return <Button />
}

function Button() {
  const theme = useContext(ThemeContext)

  return <button className={theme}>button</button>
}
```

React 19 可以直接使用 `<ThemeContext value={...}>` 作为 Provider。旧写法通常是：

```jsx
<ThemeContext.Provider value="dark">
  <Toolbar />
</ThemeContext.Provider>
```

Context 适合：

- 主题
- 国际化
- 当前登录用户
- 权限信息
- 全局配置

注意：

- Context 不是全局状态管理的万能替代
- Provider 的 `value` 变化会影响所有消费该 Context 的组件
- 大对象 value 建议配合拆分 Context 或 memo 化

## useMemo

`useMemo` 用于缓存计算结果。

```jsx
const filteredList = useMemo(() => {
  return list.filter((item) => item.name.includes(keyword))
}, [list, keyword])
```

适合场景：

- 计算成本较高
- 计算结果会作为子组件 props
- 希望保持引用稳定，避免子组件不必要渲染

不要滥用 `useMemo`。简单计算直接写更清楚：

```jsx
const fullName = `${firstName} ${lastName}`
```

## useCallback

`useCallback` 用于缓存函数引用。

```jsx
const handleSubmit = useCallback(() => {
  submit(form)
}, [form])
```

常见场景：

- 函数作为 props 传给被 `memo` 包裹的子组件
- 函数作为其他 Hook 的依赖
- 注册和取消外部事件时需要稳定引用

`useCallback(fn, deps)` 基本等价于 `useMemo(() => fn, deps)`。

## memo

`memo` 用于缓存组件渲染结果。只有 props 变化时才重新渲染。

```jsx
import { memo } from 'react'

const UserItem = memo(function UserItem({ user, onSelect }) {
  return (
    <button onClick={() => onSelect(user.id)}>
      {user.name}
    </button>
  )
})
```

如果父组件每次都传入新的对象或函数，`memo` 可能失效。

```jsx
<UserItem
  user={{ id: 1, name: 'Tom' }}
  onSelect={() => selectUser(1)}
/>
```

这种情况下可以把对象和函数提前定义，或配合 `useMemo`、`useCallback`。

## useTransition

`useTransition` 用于把某些状态更新标记为非紧急更新，让界面优先响应用户输入。

```jsx
import { useState, useTransition } from 'react'

function SearchPage({ allItems }) {
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState(allItems)
  const [isPending, startTransition] = useTransition()

  function handleChange(event) {
    const value = event.target.value

    setKeyword(value)

    startTransition(() => {
      setList(allItems.filter((item) => item.name.includes(value)))
    })
  }

  return (
    <>
      <input value={keyword} onChange={handleChange} />
      {isPending && <span>loading...</span>}
      {list.map((item) => <div key={item.id}>{item.name}</div>)}
    </>
  )
}
```

适合场景：

- 输入框要保持流畅
- 列表过滤、复杂渲染可以延后
- 切换 tab 时某些内容渲染较重

## useDeferredValue

`useDeferredValue` 用于延迟使用某个值，让昂贵渲染落后于用户输入。

```jsx
function SearchPage({ list }) {
  const [keyword, setKeyword] = useState('')
  const deferredKeyword = useDeferredValue(keyword)

  const filteredList = useMemo(() => {
    return list.filter((item) => item.name.includes(deferredKeyword))
  }, [list, deferredKeyword])

  return (
    <>
      <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
      <ResultList list={filteredList} />
    </>
  )
}
```

`useTransition` 是把某次更新标记为低优先级，`useDeferredValue` 是把某个值的使用延后。

## useId

`useId` 用于生成稳定的唯一 ID，常用于表单可访问性属性。

```jsx
function Field() {
  const id = useId()

  return (
    <>
      <label htmlFor={id}>用户名</label>
      <input id={id} />
    </>
  )
}
```

不要用 `useId` 生成列表 key。列表 key 应该来自数据本身。

## useSyncExternalStore

`useSyncExternalStore` 用于订阅 React 外部状态源，保证并发渲染下读取一致。

```jsx
import { useSyncExternalStore } from 'react'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)

  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot() {
  return navigator.onLine
}

function OnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot)

  return <span>{isOnline ? 'online' : 'offline'}</span>
}
```

适合封装外部 store、浏览器状态、第三方状态库订阅。

## useActionState

`useActionState` 用于根据表单 action 的执行结果更新状态，常见于 React 19 的表单和 Server Actions 场景。

```jsx
import { useActionState } from 'react'

async function submitForm(previousState, formData) {
  const name = formData.get('name')

  if (!name) {
    return { error: '请输入名称' }
  }

  return { error: null, name }
}

function Form() {
  const [state, formAction, isPending] = useActionState(submitForm, {
    error: null,
    name: ''
  })

  return (
    <form action={formAction}>
      <input name="name" />
      <button disabled={isPending}>submit</button>
      {state.error && <p>{state.error}</p>}
    </form>
  )
}
```

它适合把提交中、提交结果、错误信息和表单 action 绑定在一起。

## useOptimistic

`useOptimistic` 用于乐观更新。用户操作后先更新界面，再等待服务端确认。

```jsx
import { useOptimistic } from 'react'

function MessageList({ messages, sendMessage }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (currentMessages, newMessage) => [
      ...currentMessages,
      { id: 'temp', text: newMessage, sending: true }
    ]
  )

  async function handleSend(formData) {
    const text = formData.get('text')

    addOptimisticMessage(text)
    await sendMessage(text)
  }

  return (
    <form action={handleSend}>
      {optimisticMessages.map((message) => (
        <div key={message.id}>
          {message.text}
          {message.sending && ' sending...'}
        </div>
      ))}
      <input name="text" />
      <button>send</button>
    </form>
  )
}
```

适合点赞、评论、发送消息等希望先给用户反馈的场景。

## lazy 和 Suspense

`lazy` 用于懒加载组件，`Suspense` 用于展示加载中状态。

```jsx
import { lazy, Suspense } from 'react'

const AdminPage = lazy(() => import('./AdminPage.jsx'))

function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <AdminPage />
    </Suspense>
  )
}
```

适合路由级代码拆分、大组件延迟加载。

## createPortal

`createPortal` 可以把子节点渲染到当前 DOM 层级之外。

```jsx
import { createPortal } from 'react-dom'

function Modal({ children }) {
  return createPortal(
    <div className="modal">{children}</div>,
    document.body
  )
}
```

适合弹窗、气泡、全局提示、菜单等需要脱离父级 `overflow` 或 `z-index` 限制的 UI。

注意：Portal 只改变 DOM 位置，不改变 React 组件树关系。Context 和事件冒泡仍按 React 树工作。

## flushSync

`flushSync` 用于强制 React 同步刷新更新。

```jsx
import { flushSync } from 'react-dom'

function handleClick() {
  flushSync(() => {
    setOpen(true)
  })

  panelRef.current.focus()
}
```

适合在状态更新后立即读取 DOM 或操作焦点的少数场景。它会影响性能，不应作为常规状态更新手段。

## createRoot 和 hydrateRoot

客户端渲染入口：

```jsx
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
```

服务端渲染后的客户端激活：

```jsx
import { hydrateRoot } from 'react-dom/client'
import App from './App.jsx'

hydrateRoot(document.getElementById('root'), <App />)
```

`createRoot` 用于普通客户端渲染，`hydrateRoot` 用于接管服务端已经生成的 HTML。

## 自定义 Hook

自定义 Hook 是复用状态逻辑的函数，名称必须以 `use` 开头。

```jsx
import { useEffect, useState } from 'react'

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    function update() {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return isOnline
}
```

使用：

```jsx
function Status() {
  const isOnline = useOnlineStatus()

  return <span>{isOnline ? 'online' : 'offline'}</span>
}
```

自定义 Hook 不是共享状态本身，而是共享状态逻辑。每次调用 Hook 都会有独立状态。

## 高频面试题

### useState 和 useRef 的区别

`useState` 保存会影响渲染的数据，更新后触发重新渲染。`useRef` 保存跨渲染的可变值，修改 `ref.current` 不会触发重新渲染。

### useEffect 和 useLayoutEffect 的区别

`useEffect` 在浏览器绘制后执行，不阻塞绘制。`useLayoutEffect` 在浏览器绘制前同步执行，适合读取布局并同步修改 DOM，但会阻塞绘制。

### useMemo 和 useCallback 的区别

`useMemo` 缓存计算结果，`useCallback` 缓存函数引用。`useCallback(fn, deps)` 可以理解成 `useMemo(() => fn, deps)`。

### 为什么 Hook 不能写在 if 里

React 通过 Hook 的调用顺序关联状态。如果条件导致某次渲染少调用或多调用 Hook，后续状态位置会错乱。

### Context 会导致所有子组件都重新渲染吗

Provider 的 `value` 变化时，消费该 Context 的组件会重新渲染。没有消费 Context 的普通子组件是否重新渲染，还取决于父组件渲染、props 是否变化、是否使用 `memo` 等因素。

### React.memo 一定能减少渲染吗

不一定。`memo` 需要比较 props，本身也有成本。如果 props 每次都是新对象、新函数，`memo` 很难发挥效果。它更适合渲染成本高且 props 稳定的组件。

### key 为什么不能用数组下标

如果列表会插入、删除、排序，用下标作为 key 会导致 React 错误复用组件实例，可能出现输入框错位、状态错乱等问题。稳定 key 应该来自数据 id。

### useTransition 和 useDeferredValue 的区别

`useTransition` 标记一段状态更新为低优先级。`useDeferredValue` 延迟使用某个值，让当前输入等高优先级更新先完成。

## 常见误区

- 把所有逻辑都放进 `useEffect`
- 为了减少渲染滥用 `useMemo` 和 `useCallback`
- 认为 `setState` 后立刻能读到最新 state
- 忘记清理 effect 中的定时器、事件监听和订阅
- 用 Context 存放频繁变化的大对象
- 用数组下标作为动态列表 key
- 把 `useRef` 当成响应式状态使用
- 在 render 阶段执行有副作用的代码

## 学习建议

1. 先掌握 `useState`、`useEffect`、`useRef`。
2. 再学习 `useMemo`、`useCallback`、`memo` 的真实适用场景。
3. 状态复杂后再引入 `useReducer`。
4. 跨层级传递稳定数据时使用 Context。
5. 需要外部系统同步时，再考虑 `useSyncExternalStore`。
6. 表单、并发体验和乐观更新可以继续学习 `useActionState`、`useTransition`、`useDeferredValue`、`useOptimistic`。

## 小结

- Hook 只能在函数组件或自定义 Hook 顶层调用
- `useState` 管理简单状态，`useReducer` 管理复杂状态流转
- `useEffect` 处理渲染后的副作用，清理函数很重要
- `useRef` 保存 DOM 或可变值，但不会触发渲染
- Context 适合跨层级传递数据，但要注意 value 变化的渲染影响
- 性能 API 要基于真实问题使用，不要为了“优化”而过度使用
- React 19 增强了表单、乐观更新和 ref 使用方式

## 导航

- 返回 [React 模块](../index.md)
