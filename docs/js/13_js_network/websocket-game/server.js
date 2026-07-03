import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const clients = new Map();
const players = new Map();
let nextId = 1;

function makePlayer(id) {
  const hue = (id * 67) % 360;
  return {
    id,
    name: `P${id}`,
    x: 40 + ((id - 1) % 10) * 44,
    y: 40 + Math.floor((id - 1) / 10) * 44,
    color: `hsl(${hue} 80% 55%)`,
  };
}

function sendFrame(socket, data) {
  const payload = Buffer.from(JSON.stringify(data));
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  header[0] = 0x81;
  socket.write(Buffer.concat([header, payload]));
}

function sendClose(socket) {
  socket.write(Buffer.from([0x88, 0x00]));
}

function parseFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    const opcode = byte1 & 0x0f;
    const masked = (byte2 & 0x80) === 0x80;
    let length = byte2 & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      const big = buffer.readBigUInt64BE(offset + 2);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) break;
      length = Number(big);
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + length;
    if (offset + frameLength > buffer.length) break;

    let payload = buffer.slice(offset + headerLength + maskLength, offset + frameLength);
    if (masked) {
      const mask = buffer.slice(offset + headerLength, offset + headerLength + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }

    frames.push({ opcode, payload });
    offset += frameLength;
  }

  return { frames, rest: buffer.slice(offset) };
}

function broadcast(data) {
  for (const socket of clients.values()) {
    if (socket.writable) sendFrame(socket, data);
  }
}

function snapshot() {
  return {
    type: 'state',
    players: Array.from(players.values()),
  };
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const file = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, file);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const type = ext === '.html' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8';
    res.setHeader('Content-Type', type);
    res.end(content);
  });
});

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n')
  );

  const id = nextId++;
  const player = makePlayer(id);
  players.set(id, player);
  clients.set(id, socket);

  sendFrame(socket, { type: 'welcome', id, player });
  broadcast(snapshot());

  let buffer = Buffer.alloc(0);

  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = parseFrames(buffer);
    buffer = parsed.rest;

    for (const frame of parsed.frames) {
      if (frame.opcode === 0x8) {
        sendClose(socket);
        cleanup();
        socket.end();
        return;
      }
      if (frame.opcode !== 0x1) continue;

      let message;
      try {
        message = JSON.parse(frame.payload.toString('utf8'));
      } catch {
        continue;
      }

      if (message.type === 'move') {
        const current = players.get(id);
        if (!current) continue;
        const step = 24;
        if (message.direction === 'ArrowUp') current.y = Math.max(20, current.y - step);
        if (message.direction === 'ArrowDown') current.y = Math.min(556, current.y + step);
        if (message.direction === 'ArrowLeft') current.x = Math.max(20, current.x - step);
        if (message.direction === 'ArrowRight') current.x = Math.min(556, current.x + step);
        broadcast(snapshot());
      } else if (message.type === 'ping') {
        sendFrame(socket, { type: 'pong', ts: Date.now() });
      }
    }
  });

  socket.on('close', cleanup);
  socket.on('end', cleanup);
  socket.on('error', () => {
    cleanup();
  });

  function cleanup() {
    if (!clients.has(id)) return;
    clients.delete(id);
    players.delete(id);
    broadcast(snapshot());
  }
});

server.listen(PORT, HOST, () => {
  console.log(`WebSocket game running at http://${HOST}:${PORT}`);
});
