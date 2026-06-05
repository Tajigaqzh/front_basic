# 请求流程

这里记录前端、后端和 OpenAI 之间的流式调用过程。

## 流程概览

1. 前端调用聊天接口，发送 `messages`。
2. 前端先在本地消息列表里插入一条用户消息和一条空的 assistant 消息。
3. 后端读取请求体并调用 OpenAI。
4. OpenAI 以流的方式逐段返回文本。
5. 后端把文本包装成 SSE 数据返回给前端。
6. 前端实时读取流并把内容追加到当前 assistant 消息中。
7. 收到 `[DONE]` 后，本轮流式响应结束。

## 时序图

```text
Frontend                    Backend                        OpenAI
   |                           |                              |
   | create user msg           |                              |
   | create empty assistant    |                              |
   | POST /api/chat + messages |                              |
   |-------------------------->|                              |
   |                           | parse req.json()            |
   |                           | create stream request       |
   |                           |----------------------------->|
   |                           |<-----------------------------|
   |                           | chunk #1                    |
   |<--------------------------| data: {"content":"..."}      |
   | append assistant content  |                              |
   |                           |<-----------------------------|
   |                           | chunk #2                    |
   |<--------------------------| data: {"content":"..."}      |
   | append assistant content  |                              |
   |                           |<-----------------------------|
   |                           | stream end                  |
   |<--------------------------| data: [DONE]                |
   | mark loading false        |                              |
```

## 页面索引

- [后端流式接口](./backend-stream.md)
- [前端流式消费](./frontend-stream.md)
