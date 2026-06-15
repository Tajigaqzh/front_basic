import * as Y from 'yjs'
import { base64ToUint8Array, uint8ArrayToBase64 } from './encoding'

export type Role = 'A' | 'B' | 'viewer'

export type UserProfile = {
  clientId: string
  name: string
  role: Role
  color: string
}

export type AwarenessState = UserProfile & {
  cursor?: {
    anchorLineNumber: number
    anchorColumn: number
    positionLineNumber: number
    positionColumn: number
  }
}

type ProviderOptions = {
  serverUrl: string
  roomId: string
  user: UserProfile
  doc: Y.Doc
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void
  onUsersChange: (users: AwarenessState[]) => void
  onAwarenessChange: (state: AwarenessState) => void
  onSnapshotApplied?: () => void
}

type IncomingMessage =
  | { type: 'doc:snapshot'; updates: string[] }
  | { type: 'doc:update'; clientId: string; update: string }
  | { type: 'room:joined'; clientId: string }
  | { type: 'room:users'; users: AwarenessState[] }
  | { type: 'awareness:update'; clientId: string; state: AwarenessState }
  | { type: 'pong'; timestamp?: number }
  | { type: 'error'; code: string }

export class YjsMessageProvider {
  private static readonly HEARTBEAT_INTERVAL = 10000
  private static readonly STALE_CONNECTION_TIMEOUT = 30000
  private static readonly MAX_RECONNECT_DELAY = 15000

  private readonly options: ProviderOptions
  private socket: WebSocket | null = null
  private readonly queuedUpdates: string[] = []
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private reconnectAttempt = 0
  private lastMessageAt = 0
  private destroyed = false

  constructor(options: ProviderOptions) {
    this.options = options
    this.options.doc.on('update', this.handleLocalUpdate)
    this.connect()
  }

  destroy() {
    this.destroyed = true
    this.options.doc.off('update', this.handleLocalUpdate)
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
    }
    this.stopHeartbeat()
    this.socket?.close()
  }

  sendAwareness(state: AwarenessState) {
    this.send({
      type: 'awareness:update',
      roomId: this.options.roomId,
      clientId: this.options.user.clientId,
      state
    })
  }

  private connect() {
    this.stopHeartbeat()
    this.options.onStatusChange('connecting')
    const url = new URL(this.options.serverUrl)
    url.searchParams.set('roomId', this.options.roomId)
    url.searchParams.set('role', this.options.user.role)
    url.searchParams.set('name', this.options.user.name)

    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', this.handleOpen)
    this.socket.addEventListener('message', this.handleMessage)
    this.socket.addEventListener('close', this.handleClose)
    this.socket.addEventListener('error', this.handleError)
  }

  private handleOpen = () => {
    this.reconnectAttempt = 0
    this.lastMessageAt = Date.now()
    this.options.onStatusChange('connected')
    this.send({
      type: 'room:join',
      roomId: this.options.roomId,
      clientId: this.options.user.clientId,
      role: this.options.user.role,
      name: this.options.user.name
    })
    this.flushQueuedUpdates()
    this.sendAwareness(this.options.user)
    this.startHeartbeat()
  }

  private handleClose = () => {
    if (this.destroyed) {
      return
    }

    this.stopHeartbeat()
    this.options.onStatusChange('disconnected')
    this.scheduleReconnect()
  }

  private handleError = () => {
    this.options.onStatusChange('disconnected')
    this.socket?.close()
  }

  private handleMessage = (event: MessageEvent<string>) => {
    this.lastMessageAt = Date.now()
    const message = JSON.parse(event.data) as IncomingMessage

    if (message.type === 'pong') {
      return
    }

    if (message.type === 'doc:snapshot') {
      for (const update of message.updates) {
        Y.applyUpdate(this.options.doc, base64ToUint8Array(update), this)
      }
      this.options.onSnapshotApplied?.()
      return
    }

    if (message.type === 'doc:update' && message.clientId !== this.options.user.clientId) {
      Y.applyUpdate(this.options.doc, base64ToUint8Array(message.update), this)
      return
    }

    if (message.type === 'room:users') {
      this.options.onUsersChange(message.users)
      return
    }

    if (message.type === 'awareness:update' && message.clientId !== this.options.user.clientId) {
      this.options.onAwarenessChange(message.state)
    }
  }

  private handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) {
      return
    }

    const encoded = uint8ArrayToBase64(update)
    if (!this.sendDocUpdate(encoded)) {
      this.queuedUpdates.push(encoded)
    }
  }

  private flushQueuedUpdates() {
    while (this.queuedUpdates.length > 0) {
      const update = this.queuedUpdates.shift()
      if (update) {
        this.sendDocUpdate(update)
      }
    }
  }

  private sendDocUpdate(update: string) {
    return this.send({
      type: 'doc:update',
      roomId: this.options.roomId,
      clientId: this.options.user.clientId,
      update
    })
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        return
      }

      const now = Date.now()
      if (now - this.lastMessageAt > YjsMessageProvider.STALE_CONNECTION_TIMEOUT) {
        this.socket.close()
        return
      }

      this.send({
        type: 'ping',
        roomId: this.options.roomId,
        clientId: this.options.user.clientId,
        timestamp: now
      })
    }, YjsMessageProvider.HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
    }

    const baseDelay = Math.min(
      1000 * 2 ** this.reconnectAttempt,
      YjsMessageProvider.MAX_RECONNECT_DELAY
    )
    const jitter = Math.floor(Math.random() * 300)
    this.reconnectAttempt += 1
    this.reconnectTimer = window.setTimeout(() => this.connect(), baseDelay + jitter)
  }

  private send(payload: object) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false
    }
    this.socket.send(JSON.stringify(payload))
    return true
  }
}
