const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const playerIdEl = document.getElementById('playerId');
const countEl = document.getElementById('count');

const ws = new WebSocket(`ws://${location.host}`);
let myId = null;
let players = [];

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i <= 25; i++) {
    const step = canvas.width / 25;
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(canvas.width, i * step);
    ctx.stroke();
  }
}

function drawPlayers() {
  drawGrid();
  for (const player of players) {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, 28, 28);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '12px sans-serif';
    ctx.fillText(player.name, player.x, player.y - 6);
    if (player.id === myId) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x - 2, player.y - 2, 32, 32);
    }
  }
}

ws.addEventListener('open', () => {
  statusEl.textContent = 'connected';
});

ws.addEventListener('close', () => {
  statusEl.textContent = 'disconnected';
});

ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.type === 'welcome') {
    myId = data.id;
    playerIdEl.textContent = String(data.id);
  }
  if (data.type === 'state') {
    players = data.players;
    countEl.textContent = String(players.length);
    drawPlayers();
  }
});

window.addEventListener('keydown', event => {
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'move', direction: event.key }));
  }
});

drawPlayers();
