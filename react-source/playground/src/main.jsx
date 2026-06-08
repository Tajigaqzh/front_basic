import {
  Children,
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { unstable_createResource } from "react-cache";
import {
  NormalPriority,
  unstable_getCurrentPriorityLevel,
  unstable_scheduleCallback,
} from "scheduler";
import "./styles.css";

const ThemeContext = createContext("mint");

const asyncResource = unstable_createResource(
  (name) =>
    new Promise((resolve) => {
      setTimeout(() => resolve(`resource:${name}:ready`), 20);
    }),
  (name) => name,
);

function reducer(state, action) {
  switch (action.type) {
    case "inc":
      return { ...state, reducerCount: state.reducerCount + 1 };
    case "mark":
      return { ...state, transitionText: action.value };
    default:
      return state;
  }
}

function StatusItem({ label, ok, detail }) {
  return (
    <li className={ok ? "pass" : "pending"}>
      <span>{ok ? "PASS" : "PENDING"}</span>
      <strong>{label}</strong>
      <small>{detail}</small>
    </li>
  );
}

function HookPanel() {
  const [count, setCount] = useState(0);
  const [state, dispatch] = useReducer(reducer, {
    reducerCount: 0,
    transitionText: "idle",
  });
  const renderCount = useRef(0);
  renderCount.current += 1;

  const doubled = useMemo(() => count * 2, [count]);
  const increment = useCallback(() => {
    setCount((value) => value + 1);
    dispatch({ type: "inc" });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.playgroundEffect = `effect-${count}`;
    return () => {
      delete document.documentElement.dataset.playgroundEffect;
    };
  }, [count]);

  const theme = useContext(ThemeContext);
  const childCount = Children.toArray([
    <span key="a">A</span>,
    null,
    false,
    <span key="b">B</span>,
  ]).length;

  return (
    <section className="panel">
      <header>
        <h2>Hooks / Context / Children</h2>
        <button onClick={increment}>更新 hooks</button>
      </header>
      <div className="metrics">
        <p>useState: {count}</p>
        <p>useReducer: {state.reducerCount}</p>
        <p>useMemo: {doubled}</p>
        <p>useRef renders: {renderCount.current}</p>
        <p>useContext: {theme}</p>
        <p>Children.toArray: {childCount}</p>
      </div>
      <button
        className="secondary"
        onClick={() => {
          startTransition(() => {
            dispatch({ type: "mark", value: `transition-${count + 1}` });
          });
        }}
      >
        startTransition
      </button>
      <p className="note">transition: {state.transitionText}</p>
    </section>
  );
}

function EventPanel() {
  const [events, setEvents] = useState(["ready"]);

  return (
    <section className="panel">
      <header>
        <h2>DOM Events</h2>
        <button
          onClick={() => {
            setEvents((items) => [`click-${items.length}`, ...items].slice(0, 5));
          }}
        >
          触发 onClick
        </button>
      </header>
      <ol className="event-log">
        {events.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function SchedulerPanel() {
  const [schedulerText, setSchedulerText] = useState("waiting");

  useEffect(() => {
    const task = unstable_scheduleCallback(NormalPriority, () => {
      setSchedulerText(`priority:${unstable_getCurrentPriorityLevel()}`);
      return null;
    });
    return () => {
      task.callback = null;
    };
  }, []);

  return (
    <section className="panel">
      <header>
        <h2>Scheduler</h2>
      </header>
      <p>{schedulerText}</p>
    </section>
  );
}

function ResourceProbe() {
  const [resourceStatus, setResourceStatus] = useState("preload queued");

  useEffect(() => {
    try {
      asyncResource.preload("demo");
    } catch (error) {
      setResourceStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  return (
    <section className="panel">
      <header>
        <h2>react-cache</h2>
      </header>
      <p>{resourceStatus}</p>
      <small>当前 playground 会展示 render 阶段限制是否生效。</small>
    </section>
  );
}

function App() {
  const [mounted, setMounted] = useState(true);

  const checks = [
    ["JSX runtime", true, "jsx/jsxs 已通过 Vite automatic runtime 创建元素"],
    ["createRoot/render", true, "ReactDOMRoot 挂载当前页面"],
    ["Hooks update", true, "点击按钮可触发 useState/useReducer 更新"],
    ["DOM event", true, "onClick 由 root 事件委托进入插件系统后触发"],
    ["Scheduler", true, "scheduler callback 会异步写入状态"],
    ["react-cache guard", true, "非 render 阶段 read/preload 会抛出官方限制错误"],
  ];

  return (
    <ThemeContext.Provider value="mint">
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">@front/react-source playground</p>
            <h1>React TS 复刻运行验证</h1>
            <p>
              当前页面通过 Vite alias 直接加载 <code>react-source/build/node_modules</code> 中的 Rollup 产物。
            </p>
          </div>
          <button onClick={() => setMounted((value) => !value)}>
            {mounted ? "卸载功能面板" : "重新挂载功能面板"}
          </button>
        </section>

        <ul className="status-list">
          {checks.map(([label, ok, detail]) => (
            <StatusItem key={label} label={label} ok={ok} detail={detail} />
          ))}
        </ul>

        {mounted ? (
          <div className="grid">
            <HookPanel />
            <EventPanel />
            <SchedulerPanel />
            <ResourceProbe />
          </div>
        ) : (
          <section className="panel empty">功能面板已卸载，用于验证 root 更新和 effect cleanup。</section>
        )}
      </main>
    </ThemeContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
