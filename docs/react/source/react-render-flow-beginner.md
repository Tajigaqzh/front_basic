# React 渲染原理小白图解

对应源码目录：

```txt
react-source/packages
```

这篇文档按“一个按钮是怎么出现在页面上”的顺序读 React 复刻版源码。先记住一句话：

> React 不是直接把 JSX 变成 DOM，而是先变成 ReactElement，再变成 Fiber 树，最后在 commit 阶段统一改 DOM。

## 1. 总流程图

```mermaid
flowchart TD
  JSX["JSX / createElement"] --> Element["ReactElement<br/>type + key + props"]
  Element --> Root["createRoot(container).render(element)"]
  Root --> Update["updateContainer<br/>写入 HostRoot.pendingProps.children"]
  Update --> Schedule["scheduleUpdateOnFiber<br/>更新 lane 冒泡到 root"]
  Schedule --> Render["render 阶段<br/>beginWork + completeWork"]
  Render --> Commit["commit 阶段<br/>读取 flags 改 DOM"]
  Commit --> DOM["浏览器页面更新"]
```

入口源码：

- `react-source/packages/react/src/jsx/ReactJSXElement.ts`
- `react-source/packages/react-dom/src/client/ReactDOMRoot.ts`
- `react-source/packages/react-reconciler/src/ReactFiberWorkLoop.ts`

## 2. JSX 先变成普通对象

示例：

```tsx
<button className="primary">Click</button>
```

会变成类似：

```ts
createElement("button", { className: "primary" }, "Click")
```

复刻版的核心对象长这样：

```ts
{
  $$typeof: REACT_ELEMENT_TYPE,
  type: "button",
  key: null,
  props: {
    className: "primary",
    children: "Click"
  }
}
```

关键点：

- `ReactElement` 不是 DOM。
- `type` 决定后续 Fiber 类型。
- `key` 只给调和使用，不进入 `props`。
- `props.children` 保存子节点。

## 3. createRoot 做了什么

```ts
const root = createRoot(document.getElementById("app")!)
root.render(<App />)
```

调用图：

```mermaid
sequenceDiagram
  participant User as 用户代码
  participant DOMRoot as ReactDOMRoot
  participant Root as FiberRoot
  participant Loop as WorkLoop

  User->>DOMRoot: createRoot(container)
  DOMRoot->>Root: createFiberRoot(container)
  DOMRoot->>DOMRoot: markContainerAsRoot
  DOMRoot->>DOMRoot: listenToAllSupportedEvents
  User->>DOMRoot: root.render(element)
  DOMRoot->>Loop: updateContainer(element, fiberRoot)
```

`ReactDOMRoot` 是给用户用的外壳，真正的运行时根是 `FiberRoot`。

## 4. Fiber 是什么

可以把 Fiber 理解成 React 内部的“工作单元”。

ReactElement 只描述“想要什么”，Fiber 还记录“现在做到哪了、旧节点是什么、要不要插入/更新/删除”。

```mermaid
flowchart LR
  Element["ReactElement"] --> Fiber["Fiber"]
  Fiber --> State["memoizedState<br/>hooks/state"]
  Fiber --> Props["pendingProps / memoizedProps"]
  Fiber --> DOM["stateNode<br/>DOM 或实例"]
  Fiber --> Links["return / child / sibling"]
  Fiber --> Flags["flags / subtreeFlags"]
```

Fiber 的树形关系不是数组，而是三根指针：

- `child`：第一个子节点。
- `sibling`：下一个兄弟节点。
- `return`：父节点。

## 5. 双缓存：current 和 workInProgress

```mermaid
flowchart LR
  subgraph Current["current：页面上已经提交的树"]
    A["HostRoot"] --> B["App"] --> C["button"]
  end

  subgraph WIP["workInProgress：本次正在计算的新树"]
    A2["HostRoot.alternate"] --> B2["App.alternate"] --> C2["button.alternate"]
  end

  A <--> A2
  B <--> B2
  C <--> C2
  WIP --> Commit["commit 后 root.current = workInProgress"]
```

为什么要双缓存：

- 旧树不能在 render 阶段被直接改坏，因为 render 可能失败或被丢弃。
- 新树算完后一次性 commit，页面状态才切换。
- 下次更新可以复用旧对象、DOM、Hook 队列。

## 6. 更新如何调度到 root

当你调用 `setState` 或 `root.render`：

```mermaid
flowchart TD
  Update["setState / root.render"] --> Fiber["sourceFiber.lanes |= lane"]
  Fiber --> Parent["向父节点冒泡 childLanes"]
  Parent --> Root["找到 HostRoot.stateNode = FiberRoot"]
  Root --> Pending["root.pendingLanes |= lane"]
  Pending --> Scheduler["ensureRootIsScheduled(root)"]
```

小白版解释：

- `lane` 是更新优先级标签。
- 当前节点记录“我有更新”。
- 父节点记录“我的子树有更新”。
- 根节点记录“整个应用有待处理工作”。

## 7. render 阶段：只计算，不改页面

render 阶段由 `ReactFiberWorkLoop.ts` 驱动。

```mermaid
flowchart TD
  Start["performConcurrentWorkOnRoot"] --> Stack["prepareFreshStack"]
  Stack --> Unit["performUnitOfWork"]
  Unit --> Begin["beginWork<br/>向下生成 child Fiber"]
  Begin --> HasChild{"有 child?"}
  HasChild -->|yes| Unit
  HasChild -->|no| Complete["completeUnitOfWork"]
  Complete --> CompleteWork["completeWork<br/>向上创建 DOM / 汇总 flags"]
  CompleteWork --> Sibling{"有 sibling?"}
  Sibling -->|yes| Unit
  Sibling -->|no| Parent{"回到 parent"}
  Parent -->|未结束| CompleteWork
  Parent -->|结束| Commit["commitRoot"]
```

`beginWork` 做什么：

- `HostRoot`：读取根 element。
- `FunctionComponent`：执行函数组件，处理 Hooks。
- `HostComponent`：处理 DOM 标签的 children。
- `Fragment`、`Context`、`Suspense` 等：按各自规则生成 child Fiber。

`completeWork` 做什么：

- 首次渲染 DOM 标签时创建真实 DOM。
- 把子 DOM 挂到父 DOM。
- 汇总子树 `flags` 和 `childLanes`。
- 保存 `memoizedProps`，给下次 diff 用。

## 8. 调和：为什么 key 很重要

`ReactChildFiber.ts` 负责 children diff。

```mermaid
flowchart TD
  NewChild["新 child"] --> Compare{"key + type 和旧 Fiber 一样?"}
  Compare -->|yes| Reuse["createWorkInProgress<br/>复用旧 Fiber/DOM/Hook"]
  Reuse --> Update["标记 Update"]
  Compare -->|no| Create["createFiberFromNode"]
  Create --> Placement["标记 Placement"]
  Compare --> Delete["旧 Fiber 挂到 parent.deletions"]
  Delete --> ChildDeletion["父 Fiber 标记 ChildDeletion"]
```

小白版规则：

- 同一层对比。
- `key` 和 `type` 都一样，才复用。
- 不一样就创建新 Fiber，旧 Fiber 进入删除列表。
- DOM 不在这里改，只打 `flags`。

## 9. commit 阶段：真正改 DOM

`ReactFiberCommitWork.ts` 负责把 flags 转成 DOM 操作。

```mermaid
flowchart TD
  Commit["commitMutationEffects"] --> Traverse["遍历 Fiber 树"]
  Traverse --> Flag{"flags 是什么?"}
  Flag -->|Placement| Insert["找到宿主父节点 appendChild"]
  Flag -->|Update| Patch["updateProperties / 更新文本"]
  Flag -->|ChildDeletion| Remove["递归执行 cleanup 并 removeChild"]
  Insert --> Current["root.current = finishedWork"]
  Patch --> Current
  Remove --> Current
```

为什么不在 render 阶段直接改 DOM：

- render 阶段可能被中断或失败。
- commit 阶段必须短、同步、不可中断。
- 统一 commit 可以保证页面一次性从旧状态切到新状态。

## 10. 方法调用图

```mermaid
flowchart TD
  createElement["createElement"] --> ReactElement["ReactElement"]
  createRoot["createRoot"] --> createFiberRoot["createFiberRoot"]
  render["ReactDOMRoot.render"] --> updateContainer["updateContainer"]
  updateContainer --> scheduleUpdateOnFiber["scheduleUpdateOnFiber"]
  scheduleUpdateOnFiber --> ensureRootIsScheduled["ensureRootIsScheduled"]
  ensureRootIsScheduled --> performConcurrentWorkOnRoot["performConcurrentWorkOnRoot"]
  performConcurrentWorkOnRoot --> renderRootSync["renderRootSync"]
  renderRootSync --> performUnitOfWork["performUnitOfWork"]
  performUnitOfWork --> beginWork["beginWork"]
  performUnitOfWork --> completeUnitOfWork["completeUnitOfWork"]
  completeUnitOfWork --> completeWork["completeWork"]
  performConcurrentWorkOnRoot --> commitRoot["commitRoot"]
  commitRoot --> commitMutationEffects["commitMutationEffects"]
```

## 11. 建议阅读顺序

1. `packages/react/src/jsx/ReactJSXElement.ts`
2. `packages/react-dom/src/client/ReactDOMRoot.ts`
3. `packages/react-reconciler/src/ReactFiber.ts`
4. `packages/react-reconciler/src/ReactFiberRoot.ts`
5. `packages/react-reconciler/src/ReactFiberWorkLoop.ts`
6. `packages/react-reconciler/src/ReactFiberBeginWork.ts`
7. `packages/react-reconciler/src/ReactChildFiber.ts`
8. `packages/react-reconciler/src/ReactFiberCompleteWork.ts`
9. `packages/react-reconciler/src/ReactFiberCommitWork.ts`
