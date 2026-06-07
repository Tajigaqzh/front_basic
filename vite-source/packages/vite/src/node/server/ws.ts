import { createHash } from 'node:crypto'
import { HMR_WS_PATH } from '../constants.js'

export interface WebSocketPayload {
  type: string
  [key: string]: unknown
}

export interface WebSocketServer {
  send(payload: WebSocketPayload): void
  close(): void
}

/**
 * 这里实现一个极小 WebSocket 服务端，避免引入 ws 依赖。
 * 它只支持服务端向浏览器发送文本帧，足够表达 Vite HMR 的核心：
 * 文件变化 -> 服务端广播 payload -> client 刷新或动态 import。
 */
export function createWebSocketServer(httpServer: any): WebSocketServer {
  const sockets = new Set<any>()

  httpServer.on('upgrade', (req: any, socket: any) => {
    if (req.url !== HMR_WS_PATH) {
      socket.destroy()
      return
    }

    const key = req.headers['sec-websocket-key']
    const accept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        '',
      ].join('\r\n'),
    )

    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => sockets.delete(socket))
    safeWrite(socket, encodeFrame(JSON.stringify({ type: 'connected' })), sockets)
  })

  return {
    send(payload) {
      const frame = encodeFrame(JSON.stringify(payload))
      for (const socket of sockets) safeWrite(socket, frame, sockets)
    },
    close() {
      for (const socket of sockets) socket.end()
      sockets.clear()
    },
  }
}

function safeWrite(socket: any, frame: Uint8Array, sockets: Set<any>): void {
  try {
    socket.write(frame)
  } catch {
    sockets.delete(socket)
    socket.destroy?.()
  }
}

function encodeFrame(message: string): Uint8Array {
  const payload = Buffer.from(message)
  const header: number[] = [0x81]

  if ((payload as any).length < 126) {
    header.push((payload as any).length)
  } else {
    header.push(126, ((payload as any).length >> 8) & 0xff, (payload as any).length & 0xff)
  }

  const frame = new Uint8Array(header.length + (payload as any).length)
  frame.set(header, 0)
  frame.set(payload as any, header.length)
  return frame
}
