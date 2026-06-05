# 后端流式接口

这部分对应 `backend/src/index.ts`，职责是接收前端消息、调用 OpenAI，并把结果按 SSE 持续返回。

## 职责拆分

1. 创建 OpenAI 客户端。
2. 解析 `POST` 请求体中的 `messages`。
3. 调用 `openai.chat.completions.create`，并开启 `stream: true`。
4. 遍历 OpenAI 返回的流式 `chunk`。
5. 从每个 `chunk` 里取出新增文本。
6. 把文本包装成 SSE 格式写入 `ReadableStream`。
7. 流结束后发送 `[DONE]` 并关闭响应流。
8. 出错时返回 `500` 和 JSON 错误体。

## 服务端代码流

### 1. 初始化客户端

服务启动时创建一个 `OpenAI` 实例，读取服务端环境变量里的 `OPEN_AI_KEY`。

### 2. 进入 POST 接口

接口接收 `Request`，然后执行：

```ts
const { messages } = await req.json();
```

这里约定前端传的是一个消息数组，每项至少包含：

```json
{
  "role": "user",
  "content": "你好"
}
```

### 3. 请求 OpenAI

后端调用：

```ts
openai.chat.completions.create({
  model: "gpt-4o",
  messages,
  stream: true
})
```

关键点是 `stream: true`。这样不会等完整回答生成后再返回，而是拿到一个可以异步遍历的流。

### 4. 把 OpenAI 流转成 SSE

后端创建 `ReadableStream`，在 `start(controller)` 中：

1. `for await...of` 遍历 OpenAI 返回的每个 `chunk`
2. 读取 `chunk.choices[0]?.delta?.content`
3. 如果本次有文本，就写出：

```text
data: {"content":"..."}

```

这就是标准 SSE 的 `data:` 消息格式。

### 5. 结束流

当 OpenAI 流结束后，后端会额外发送：

```text
data: [DONE]

```

然后调用 `controller.close()` 关闭流，前端据此结束当前一轮会话的加载状态。

## 响应头为什么这么配

- `Content-Type: text/event-stream; charset=utf-8`
  告诉客户端这是 SSE。
- `Cache-Control: no-cache, no-transform`
  防止缓存或中间代理改写流式内容。
- `Connection: keep-alive`
  保持连接，便于持续推送内容。

## 错误处理

如果解析请求、调用 OpenAI 或流式写入过程中出错，后端会：

1. `console.error(e)`
2. 返回 `500`
3. 返回 JSON：

```json
{
  "error": "stream creation failed"
}
```

## 示例

### 请求体

```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

### SSE 返回片段

```text
data: {"content":"你"}

data: {"content":"好"}

data: [DONE]
```
