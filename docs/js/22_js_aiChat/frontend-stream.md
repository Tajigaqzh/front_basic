# 前端流式消费

这部分对应 `frontend/src/hooks/useStream.ts` 和 `frontend/src/App.tsx`，职责是发起请求、消费 SSE、更新聊天 UI。

## 前端做了什么

1. 管理消息列表 `messages`
2. 管理加载状态 `isLoading`
3. 管理错误状态 `error`
4. 发送用户输入到后端
5. 读取 `response.body` 的流
6. 解析 SSE 数据
7. 把返回内容持续追加到 assistant 消息中
8. 支持中断请求和清空会话

## useChatStream 的状态

### `messages`

保存完整聊天记录。每一项结构大致是：

```ts
{
  id: string;
  role: "user" | "assistant";
  content: string;
}
```

### `isLoading`

表示当前是否正处于一次流式请求中。发送请求后设为 `true`，收到 `[DONE]` 或出错后设回 `false`。

### `error`

请求失败或流解析失败时，把错误信息暴露给 UI。

### `abortControllerRef`

保存当前请求对应的 `AbortController`，用于主动取消请求。

## sendMessage 的执行过程

### 1. 过滤空输入和重复请求

```ts
if (!content || isLoading) {
  return;
}
```

空消息不发；如果当前已经在流式输出，也不再并发发起新请求。

### 2. 先更新本地消息列表

前端会先插入两条消息：

1. 用户刚发送的消息
2. 一条空内容的 assistant 消息

这样 UI 可以立即看到本轮问答已经开始，后续收到流时只需要不断更新这条 assistant 消息。

### 3. 发起 fetch

请求体里会把当前消息列表转成后端需要的格式：

```json
{
  "messages": [
    { "role": "user", "content": "..." }
  ]
}
```

### 4. 读取流

如果 `response.body` 存在，前端通过：

```ts
const reader = response.body.getReader();
```

逐段读取字节流，再使用 `TextDecoder` 解码成字符串。

### 5. 解析 SSE

前端会维护一个 `buffer`：

1. 每次把新解码的字符串拼到 `buffer`
2. 使用 `\n\n` 拆分成一个个完整事件
3. 保留最后一个不完整片段，等待下次补全

然后对每个事件：

1. 判断是否以 `data:` 开头
2. 取出实际数据
3. 如果是 `[DONE]`，结束本次请求
4. 否则把 JSON 解析成 `{ content }`

## 为什么要追加到同一条 assistant 消息

后端每次返回的只是“新增的一小段文本”，不是完整答案。  
所以前端要这样更新：

```ts
msg.content + payload.content
```

这样用户看到的 assistant 文本会持续增长，形成打字机式的流式效果。

## stop 和 reset

### `stop`

调用 `abortControllerRef.current?.abort()` 终止当前请求，并把 `isLoading` 设回 `false`。

### `reset`

先 `stop()`，再清空：

- `messages`
- `error`

相当于把聊天界面恢复成初始状态。

## App 组件如何使用这个 hook

`App.tsx` 里主要做了三件事：

1. 管理输入框内容 `input`
2. 调用 `useChatStream({ apiUrl })`
3. 把 `messages / isLoading / error / sendMessage / stop / reset` 绑定到界面

提交表单时：

1. 阻止默认提交行为
2. 取出当前输入
3. 清空输入框
4. 调用 `sendMessage(currentInput)`

## UI 表现

- 没有消息时显示空状态
- 有消息时按 `user` / `assistant` 区分渲染样式
- assistant 还没收到内容时显示 `...`
- 请求失败时显示错误文案
- 加载中时发送按钮会禁用，并显示 `Streaming...`

## 一个实现上的注意点

当前 `sendMessage` 直接读取了 `isLoading` 和 `messages`，所以它们在 `useCallback` 依赖数组里。  
如果后续要进一步稳定这个 hook，可以把这两个值改成 `ref` + 函数式更新，减少闭包依赖。
