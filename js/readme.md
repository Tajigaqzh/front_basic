# Monaco + Yjs 协同代码编辑前端方案

## 背景

当前目录 `js/` 是前端工程，技术栈为 Vite + React + TypeScript。

业务目标是做一个代码协同编辑 demo：

- 代码编辑器使用 `monaco-editor`。
- 前端使用 `Yjs` 处理协同编辑数据。
- 后端暂定使用 Java，只负责 WebSocket 连接、房间管理、消息广播、权限校验和持久化。
- 代码主操作者是 A。
- 操作者 B 可以实时预览 A 的代码，也可以修改代码。
- 操作者 B 可以给代码添加注释，并选择一段代码做高亮标记。
- 操作者 B 可以选择一段代码添加备注。

## 推荐架构

```text
Browser A
  Monaco Editor
  Y.Doc
  WebSocket client
        |
        | Yjs update / awareness / room event
        v
Java WebSocket Server
  Room Manager
  Permission Check
  Update Broadcast
  Optional Persistence
        ^
        |
Browser B
  Monaco Editor
  Y.Doc
  Comments
  Highlights
  Remarks
```

核心原则：

- Monaco 只负责编辑器 UI。
- Yjs 负责代码文本、注释、高亮、备注等协同数据的冲突合并。
- Java 后端不解析 Monaco 文本增量，也不自己实现 OT。
- Java 后端可以不理解 Yjs update 的内部结构，先把它当作二进制消息按房间广播和持久化。

## 为什么不用手写 version + diff

手写 `version + rangeOffset + rangeLength` 适合演示单线编辑，但多人同时编辑同一段代码时会很快变复杂：

- 两个用户同时插入同一位置，需要处理顺序和光标偏移。
- 删除和插入交错时，需要转换 range。
- 注释、高亮和备注需要跟随文本移动，否则代码一改标注就错位。
- 离线重连、撤销重做、延迟消息都需要额外处理。

Yjs 已经解决这些 CRDT 合并问题，前端应该直接围绕 Yjs 建模。

## 前端数据模型

一个协同房间对应一个 `Y.Doc`。

建议在 `Y.Doc` 内维护这些共享类型：

```ts
type SharedModel = {
  code: Y.Text
  comments: Y.Map<CommentRecord>
  highlights: Y.Map<HighlightRecord>
  remarks: Y.Map<RemarkRecord>
}
```

代码文本：

```ts
const ydoc = new Y.Doc()
const codeText = ydoc.getText('code')
```

注释数据：

```ts
type CommentRecord = {
  id: string
  authorId: string
  authorName: string
  content: string
  status: 'open' | 'resolved'
  anchor: string
  head: string
  createdAt: number
  updatedAt: number
}
```

高亮数据：

```ts
type HighlightRecord = {
  id: string
  authorId: string
  color: string
  anchor: string
  head: string
  createdAt: number
}
```

备注数据：

```ts
type RemarkRecord = {
  id: string
  authorId: string
  authorName: string
  content: string
  anchor: string
  head: string
  createdAt: number
  updatedAt: number
}
```

这里的 `anchor` 和 `head` 不建议存 Monaco 的行列号，也不建议存普通 offset。

推荐存 `Y.RelativePosition` 编码后的值：

```ts
const anchor = Y.createRelativePositionFromTypeIndex(codeText, startIndex)
const head = Y.createRelativePositionFromTypeIndex(codeText, endIndex)
const encodedAnchor = encodeRelativePosition(anchor)
const encodedHead = encodeRelativePosition(head)
```

原因是代码变化后，`Y.RelativePosition` 可以跟随文本移动，更适合注释、高亮和备注。

## Monaco 绑定

前端用 `y-monaco` 把 `Y.Text` 和 Monaco model 绑定：

```ts
import * as Y from 'yjs'
import { MonacoBinding } from 'y-monaco'

const ydoc = new Y.Doc()
const codeText = ydoc.getText('code')
const model = monaco.editor.createModel('', 'javascript')

const binding = new MonacoBinding(
  codeText,
  model,
  new Set([editor]),
  awareness
)
```

这样本地编辑会自动写入 `Y.Text`，远端 update 应用后也会自动反映到 Monaco。

## WebSocket 协议建议

因为后端暂定 Java，不建议一开始强行实现完整 `y-websocket` 协议。

更务实的做法是：前端自己封装一个轻量 Yjs WebSocket provider，Java 后端只按房间转发消息。

### 连接地址

```text
ws://localhost:8080/collab?roomId=demo-room&role=A
ws://localhost:8080/collab?roomId=demo-room&role=B
```

### 消息类型

加入房间：

```json
{
  "type": "room:join",
  "roomId": "demo-room",
  "clientId": "u-1001",
  "role": "A",
  "name": "Alice"
}
```

Yjs 文档更新：

```json
{
  "type": "doc:update",
  "roomId": "demo-room",
  "clientId": "u-1001",
  "update": "base64 encoded Yjs update"
}
```

光标、选区、在线状态：

```json
{
  "type": "awareness:update",
  "roomId": "demo-room",
  "clientId": "u-1001",
  "state": {
    "name": "Alice",
    "role": "A",
    "color": "#2563eb",
    "cursor": {
      "anchorLineNumber": 3,
      "anchorColumn": 5,
      "positionLineNumber": 3,
      "positionColumn": 12
    }
  }
}
```

服务端同步快照：

```json
{
  "type": "doc:snapshot",
  "roomId": "demo-room",
  "updates": [
    "base64 encoded Yjs update"
  ]
}
```

说明：

- demo 阶段用 base64 放在 JSON 里最直观。
- 后续性能优化时，可以改成 WebSocket binary frame。
- Java 后端只需要保存和转发 update，不需要解析 update 内容。

## Java 后端职责边界

Java 后端暂定负责：

- WebSocket 连接管理。
- 按 `roomId` 管理在线客户端。
- 校验用户是否能进入房间。
- 校验用户角色，例如 A/B 是否有编辑、评论、高亮、备注权限。
- 收到 `doc:update` 后广播给同房间其他客户端。
- 可选：把 update 追加保存到数据库或对象存储。
- 可选：定期合并 update，生成房间快照，避免历史 update 无限增长。

Java 后端暂时不负责：

- 不计算 Monaco 文本 diff。
- 不解析 Yjs CRDT 内部结构。
- 不处理文本冲突合并。
- 不维护行列号级别的注释位置。

## A/B 权限模型

demo 阶段可以先做四个权限开关：

```ts
type RoomPermission = {
  canEditCode: boolean
  canComment: boolean
  canHighlight: boolean
  canRemark: boolean
}
```

推荐默认规则：

| 角色 | 实时预览 | 修改代码 | 添加注释 | 添加高亮 | 添加备注 |
|---|---:|---:|---:|---:|---:|
| A | 是 | 是 | 是 | 是 | 是 |
| B | 是 | 是 | 是 | 是 | 是 |
| viewer | 是 | 否 | 否 | 否 | 否 |

如果后续希望 B 只能预览不能修改，只需要把 B 的 `canEditCode` 改为 `false`，前端把 Monaco 设置为只读即可：

```ts
editor.updateOptions({ readOnly: !permission.canEditCode })
```

## 前端页面能力

第一版页面建议包含：

- 房间号输入。
- 用户名输入。
- 角色选择：A / B / viewer。
- WebSocket 连接状态。
- Monaco 代码编辑区。
- 在线用户列表。
- 远端光标和选区展示。
- 选中代码后添加注释。
- 选中代码后添加高亮。
- 选中代码后添加备注。
- 注释列表。
- 备注列表。
- 点击注释跳转到对应代码位置。
- 点击备注跳转到对应代码位置。

## 监视端 B 音视频和录制流程

监视端 B 进入房间后，需要额外执行摄像头、麦克风和页面录制相关流程。

简版流程：

1. 进入 `/monitor` 房间。
2. 检查麦克风、摄像头和录制权限。
3. 开启摄像头/麦克风并显示可拖动 video。
4. 请求后端接口获取直播 token 和录制房间号。
5. 后端调用声网 acquire。
6. 后端 2 秒内调用声网 start。
7. 定时检测页面加载和录制准备超时。
8. 后端通过声网 webhook 检查录制状态。

推荐流程：

1. B 访问 `/monitor` 并进入协同房间。
2. 检查麦克风、摄像头和录制所需权限。
   - 前端先检查浏览器是否支持媒体能力：
     - `navigator.mediaDevices`
     - `navigator.mediaDevices.getUserMedia`
   - 前端请求摄像头和麦克风权限：

   ```ts
   const stream = await navigator.mediaDevices.getUserMedia({
     video: true,
     audio: true
   })
   ```

   - 如果用户拒绝权限，或者浏览器不支持，则直接退出进入流程：
     - 关闭 WebSocket / Yjs provider。
     - 停止已获取的媒体轨道。
     - 页面显示明确错误，例如“需要摄像头和麦克风权限后才能进入监视端”。
3. 权限通过后，开启摄像头和麦克风，并在右上角固定显示本地预览 `video`。
   - 使用 `video.srcObject = stream` 播放本地视频流。
   - 默认固定在右上角。
   - 支持拖动改变位置。
   - 后续可增加缩放、最小化、静音按钮。
4. 前端请求后端接口，获取直播 token 和页面录制房间号。

```text
POST /api/recording/prepare
```

请求参数建议：

```json
{
  "roomId": "demo-room",
  "clientId": "u-1001",
  "role": "B"
}
```

响应参数建议：

```json
{
  "appId": "agora-app-id",
  "rtcChannel": "demo-room",
  "rtcUid": 10001,
  "rtcToken": "rtc-token",
  "recordingRoomId": "recording-room-id",
  "recordingSessionId": "local-session-id"
}
```

5. 调用声网 Cloud Recording 的 `acquire` 接口。
   - 原因是 `acquire/start` 通常需要服务端持有声网 REST 凭证。
   - 前端不应该暴露声网 customer key / secret。
   - 因此前端不直接调用声网接口，Java 后端代为调用 `acquire`。
6. 后端拿到 `resourceId` 后，2 秒内调用一次声网 `start` 方法。
   - 如果 `start` 失败，后端返回失败状态，前端退出录制流程。
7. 定时检测页面加载和录制准备是否超时。
   - 进入房间、获取媒体权限、请求后端录制初始化、等待后端开始录制都应有超时。
   - 建议第一版总超时时间为 15 秒。
   - 任一步超时都要清理媒体流和协同连接，并显示失败原因。
8. 后端通过声网 webhook 回调检查录制状态。
   - 如果 webhook 返回异常状态，后端记录状态并通知前端。
   - 通知方式可以先用当前 WebSocket 通道广播房间事件。

建议增加的 WebSocket 房间事件：

```json
{
  "type": "recording:status",
  "roomId": "demo-room",
  "status": "recording" 
}
```

异常状态：

```json
{
  "type": "recording:status",
  "roomId": "demo-room",
  "status": "error",
  "reason": "agora-webhook-abnormal"
}
```

前端收到异常状态后：

- 停止本地摄像头和麦克风。
- 停止录制状态展示。
- 保留协同编辑连接，除非错误要求退出房间。
- 给用户明确提示。

### 监视端状态机

```text
idle
  -> joining-room
  -> requesting-media-permission
  -> media-ready
  -> preparing-recording
  -> recording
  -> recording-error
  -> exited
```

### 前端任务补充

- [ ] `/monitor` 进入时请求摄像头和麦克风权限。
- [ ] 权限失败时退出监视端进入流程。
- [ ] 右上角显示可拖动的本地 `video` 预览。
- [ ] 调用后端 `/api/recording/prepare` 获取 RTC token 和录制房间信息。
- [ ] 增加 15 秒页面加载/录制准备超时检测。
- [ ] 监听 WebSocket `recording:status` 事件。
- [ ] 收到录制异常时清理媒体流并提示用户。

## 前端工程

当前工程结构：

```text
js/
  package.json
  index.html
  vite.config.ts
  src/
    main.ts
    App.tsx
    collab/
      encoding.ts
      yjsMessageProvider.ts
      relativePosition.ts
    editor/
      MonacoCodeEditor.tsx
    styles.css
```

核心依赖：

- Vite
- TypeScript
- React
- monaco-editor
- yjs
- y-monaco

运行前端：

```bash
cd js
npm install
npm run dev
```

默认访问：

```text
http://localhost:5173
```

前端默认连接 Java WebSocket：

```text
ws://localhost:8080/collab
```

## 任务拆解

### 1. 初始化前端工程

- [x] 在 `js/` 下创建 Vite + React + TypeScript 项目。
- [x] 安装 `monaco-editor`、`yjs`、`y-monaco`。
- [x] 搭建基础页面布局。

### 2. 接入 Monaco

- [x] 创建 Monaco editor。
- [ ] 支持语言模式选择，第一版默认 `javascript`。
- [x] 支持只读模式。
- [x] 支持获取当前选区。

### 3. 接入 Yjs

- [x] 创建 `Y.Doc`。
- [x] 创建共享 `Y.Text('code')`。
- [x] 使用 `MonacoBinding` 绑定 Monaco model。
- [x] 验证本地编辑能写入 `Y.Text`。

### 4. 实现前端 WebSocket Provider

- [x] 连接 Java WebSocket 地址。
- [x] 进入房间时发送 `room:join`。
- [x] 监听 `ydoc.on('update')`，把 update 转成 base64 后发送。
- [x] 收到远端 `doc:update` 后执行 `Y.applyUpdate(ydoc, update)`。
- [x] 收到 `doc:snapshot` 后按顺序 apply 历史 updates。
- [x] 处理断线重连。

### 5. 实现在线状态和光标同步

- [x] 维护本地 awareness state。
- [x] 光标变化时发送 `awareness:update`。
- [x] 收到远端 awareness 后渲染用户列表。
- [ ] 渲染远端光标和远端选区到 Monaco decorations。

### 6. 实现注释

- [x] 用户选中代码后创建注释。
- [x] 把选区转换为 `Y.RelativePosition`。
- [x] 注释写入 `Y.Map('comments')`。
- [x] 注释列表实时渲染。
- [ ] 点击注释时还原位置并跳转 Monaco。

### 7. 实现高亮

- [x] 用户选中代码后创建高亮。
- [x] 高亮范围同样使用 `Y.RelativePosition`。
- [x] 高亮写入 `Y.Map('highlights')`。
- [x] 使用 Monaco decorations 渲染高亮。

### 8. 实现备注

- [x] 用户选中代码后创建备注。
- [x] 备注范围同样使用 `Y.RelativePosition`。
- [x] 备注写入 `Y.Map('remarks')`。
- [x] 备注列表实时渲染。
- [ ] 点击备注时还原位置并跳转 Monaco。
- [x] 备注可以和高亮共用 Monaco decorations，但样式应区分。

### 9. 权限控制

- [x] 根据角色控制 Monaco 是否只读。
- [x] 根据权限控制注释、高亮和备注按钮是否可用。
- [x] 前端只做体验控制，真实权限仍需要 Java 后端校验。

### 10. 联调 Java 后端

- 确认 WebSocket 地址和消息格式。
- 确认房间 join、广播、断开、重连行为。
- 确认后端是否持久化 Yjs updates。
- 确认刷新页面后是否能恢复房间内容。

### 11. 验收场景

- A 打开房间，输入代码。
- B 打开同一房间，能看到 A 的代码。
- A/B 同时编辑不同位置，内容能合并。
- A/B 同时编辑相近位置，不出现覆盖丢失。
- B 选中代码添加注释，A 能实时看到。
- B 选中代码添加高亮，A 能实时看到。
- B 选中代码添加备注，A 能实时看到。
- A 修改被注释的代码前后内容，注释位置仍尽量跟随文本。
- A 修改被备注的代码前后内容，备注位置仍尽量跟随文本。
- B 断线重连后能恢复最新内容。

## 后续可选方案

如果未来不想维护自定义 provider，可以考虑完整接入 `y-websocket` 协议。

但这要求 Java 后端实现 Yjs sync / awareness 协议，复杂度高于普通消息广播。除非明确需要兼容 `y-websocket` 官方客户端，否则第一版更建议使用自定义 WebSocket provider。
