# Java 协同编辑后端

这个目录是协同编辑 demo 的 Java 后端工程，当前包含两类能力：

- `/collab`：WebSocket 协同编辑通道，用于同步 Yjs 文档更新、在线用户和光标状态。
- `/api/execute`：REST 代码执行接口，用于执行当前编辑器文件并返回 stdout、stderr、退出码和堆栈信息。

职责边界：

- 提供 `/collab` WebSocket endpoint。
- 按 `roomId` 管理房间。
- 广播前端发来的 Yjs update。
- 广播在线状态和光标 awareness。
- 提供 `/api/execute` 代码执行接口。
- 根据语言策略调用本机命令行运行 Java、JavaScript、TypeScript。
- demo 阶段把 Yjs update 保存在内存中，刷新后同房间客户端可以收到历史 update。

后续规划：

- 提供监视端录制初始化接口。
- 由后端调用声网 Cloud Recording 的 `acquire` 和 `start`。
- 接收声网 webhook 回调并更新房间录制状态。

运行：

```bash
cd java
mvn spring-boot:run
```

默认端口：

```text
ws://localhost:8080/collab
```

前端连接示例：

```text
ws://localhost:8080/collab?roomId=demo-room&role=A&name=Alice
```

## 目录结构

```text
src/main
├── java/com/example/collab
│   ├── CollabApplication.java
│   ├── config
│   │   └── WebSocketConfig.java
│   ├── controller
│   │   └── CodeExecutionController.java
│   ├── service
│   │   └── CodeExecutionService.java
│   ├── business
│   │   └── execution
│   │       ├── CommandRunner.java
│   │       ├── CommandResult.java
│   │       └── language
│   │           ├── CodeExecutionStrategy.java
│   │           ├── AbstractCommandExecutionStrategy.java
│   │           ├── JavaExecutionStrategy.java
│   │           ├── JavaScriptExecutionStrategy.java
│   │           └── TypeScriptExecutionStrategy.java
│   ├── dto
│   │   ├── CodeExecutionRequest.java
│   │   └── CodeExecutionResponse.java
│   ├── mapper
│   │   └── README.md
│   └── websocket
│       └── CollabWebSocketHandler.java
└── resources
    └── application.yml
```

分层说明：

- `controller`：HTTP 入口，只做请求校验和响应返回。
- `service`：应用服务层，负责选择业务策略、管理临时目录和兜底异常。
- `business`：核心业务实现。当前 `execution` 使用策略模式封装不同语言的执行流程。
- `dto`：接口请求和响应结构。
- `config`：Spring 配置。
- `websocket`：协同编辑 WebSocket 连接、房间和广播逻辑。
- `mapper`：预留持久化映射层；当前 demo 没有数据库，所以只保留占位说明。

## 代码执行流程

```text
前端点击执行
    │
    ▼
POST /api/execute
    │
    ▼
CodeExecutionController
    │  校验请求体
    ▼
CodeExecutionService
    │  1. 规范化 language
    │  2. 创建临时目录
    │  3. 查找 CodeExecutionStrategy
    ▼
Java / JavaScript / TypeScript Strategy
    │  写入源码文件，拼装编译或执行命令
    ▼
CommandRunner
    │  ProcessBuilder 执行命令，收集 stdout/stderr/exitCode
    ▼
CodeExecutionResponse
    │
    ▼
前端 Console 展示结果
```

执行接口：

```text
POST /api/execute
Content-Type: application/json
```

请求示例：

```json
{
  "language": "javascript",
  "fileName": "solution.js",
  "code": "console.log(1 + 2)"
}
```

响应示例：

```json
{
  "success": true,
  "language": "javascript",
  "exitCode": 0,
  "durationMs": 50,
  "stdout": "3\n",
  "stderr": "",
  "stackTrace": "",
  "error": null
}
```

扩展新语言：

1. 在 `business/execution/language` 下新增一个实现 `CodeExecutionStrategy` 的类。
2. 返回唯一的 `language()` 标识。
3. 在 `execute` 中把源码写入临时目录，并通过 `CommandRunner` 调用对应语言运行时。
4. 给类加 `@Component`，`CodeExecutionService` 会自动收集策略。

注意：当前执行逻辑直接调用本机命令行，线上环境应使用容器或沙箱隔离，并预装对应语言运行时。

## 监视端录制职责

监视端 B 进入房间时，前端会先获取摄像头和麦克风权限。权限通过后，前端调用后端录制初始化接口。

建议接口：

```text
POST /api/recording/prepare
```

请求：

```json
{
  "roomId": "demo-room",
  "clientId": "u-1001",
  "role": "B"
}
```

响应：

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

后端处理流程：

1. 校验用户是否可以进入房间。
2. 生成或查询声网 RTC token。
3. 生成页面录制使用的房间号 `recordingRoomId`。
4. 调用声网 Cloud Recording `acquire`。
5. 拿到 `resourceId` 后，在 2 秒内调用一次 `start`。
6. 保存 `resourceId`、`sid`、`recordingSessionId`、房间号和用户信息。
7. 返回前端录制初始化结果。

注意：

- 不要让前端直接调用声网 `acquire/start`，避免泄露声网 REST 凭证。
- `acquire` 成功但 `start` 失败时，后端必须返回失败状态，并记录可排查日志。
- 生产环境需要把录制会话状态持久化到数据库或 Redis。

## 声网 webhook

建议接口：

```text
POST /api/agora/webhook
```

职责：

- 校验 webhook 签名。
- 解析声网回调事件。
- 更新录制会话状态。
- 异常状态写入日志和数据库。
- 通过 `/collab` WebSocket 向房间广播 `recording:status`。

房间广播示例：

```json
{
  "type": "recording:status",
  "roomId": "demo-room",
  "status": "error",
  "reason": "agora-webhook-abnormal"
}
```
