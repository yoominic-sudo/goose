const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const bestEl = document.getElementById('best');
const finalScoreEl = document.getElementById('finalScore');
const startOverlay = document.getElementById('startOverlay');
const overOverlay = document.getElementById('overOverlay');
const btnStart = document.getElementById('btnStart');
const btnRetry = document.getElementById('btnRetry');

const LANE_COUNT = 4;
const CAR_W = 34;
const CAR_H = 60;

const state = {
  running: false,
  lane: 1,
  laneX: [],
  score: 0,
  best: Number(localStorage.getItem('apex-best') || 0),
  speed: 160,
  distance: 0,
  obstacles: [],
  spawnMs: 760,
  spawnTick: 0,
  lastTs: 0,
  roadOffset: 0
};

bestEl.textContent = String(state.best);

function resize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const laneWidth = w / LANE_COUNT;
  state.laneX = Array.from({ length: LANE_COUNT }, (_, i) => i * laneWidth + laneWidth / 2);
}

function carPos() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  return {
    x: state.laneX[state.lane],
    y: h - 78,
    w: CAR_W,
    h: CAR_H
  };
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const kind = Math.random() > 0.5 ? 'sedan' : 'truck';
  state.obstacles.push({
    lane,
    y: -90,
    w: kind === 'truck' ? 40 : 34,
    h: kind === 'truck' ? 72 : 60,
    kind
  });
}

function rectHit(a, b) {
  return !(a.x + a.w / 2 < b.x - b.w / 2 || a.x - a.w / 2 > b.x + b.w / 2 || a.y + a.h / 2 < b.y - b.h / 2 || a.y - a.h / 2 > b.y + b.h / 2);
}

function drawRoad(w, h, dt) {
  state.roadOffset += dt * (0.18 + state.speed / 2200);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1c244a');
  grad.addColorStop(0.55, '#0f1735');
  grad.addColorStop(1, '#080d1d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const laneW = w / LANE_COUNT;
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 1;
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = i * laneW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(90,220,255,.45)';
  ctx.lineWidth = 3;
  for (let y = -32 + (state.roadOffset % 34); y < h + 34; y += 34) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5 - 4, y);
    ctx.lineTo(w * 0.5 - 4, y + 16);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(w * .5, h * .8, 20, w * .5, h * .8, w * .6);
  glow.addColorStop(0, 'rgba(60,160,255,.16)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawCar(x, y, w, h, bodyColor, glassColor) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = bodyColor;
  roundRect(-w / 2, -h / 2, w, h, 8, true);

  ctx.fillStyle = glassColor;
  roundRect(-w / 2 + 6, -h / 2 + 10, w - 12, h - 24, 6, true);

  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(-w / 2 + 5, -h / 2 + 4, 7, 3);
  ctx.fillRect(w / 2 - 12, -h / 2 + 4, 7, 3);

  ctx.fillStyle = 'rgba(255,80,90,.9)';
  ctx.fillRect(-w / 2 + 5, h / 2 - 7, 7, 3);
  ctx.fillRect(w / 2 - 12, h / 2 - 7, 7, 3);

  ctx.restore();
}

function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
}

function update(dt) {
  state.speed = Math.min(360, state.speed + dt * 0.0048);
  state.distance += dt * state.speed * 0.0012;
  state.score = Math.floor(state.distance * 8);

  state.spawnMs = Math.max(260, 760 - state.speed * 1.1);
  state.spawnTick += dt;
  if (state.spawnTick >= state.spawnMs) {
    state.spawnTick = 0;
    spawnObstacle();
  }

  const v = dt * (0.22 + state.speed / 680);
  state.obstacles.forEach((o) => (o.y += v));
  state.obstacles = state.obstacles.filter((o) => o.y < stage.clientHeight + 120);

  const p = carPos();
  for (const o of state.obstacles) {
    const rect = { x: state.laneX[o.lane], y: o.y, w: o.w, h: o.h };
    if (rectHit(p, rect)) {
      gameOver();
      return;
    }
  }

  scoreEl.textContent = String(state.score);
  speedEl.textContent = String(Math.floor(state.speed));
}

function render(dt) {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  drawRoad(w, h, dt);

  for (const o of state.obstacles) {
    const x = state.laneX[o.lane];
    const color = o.kind === 'truck' ? 'linear-gradient' : 'linear-gradient';
    drawCar(x, o.y, o.w, o.h, o.kind === 'truck' ? '#ff6bb8' : '#ff90d0', 'rgba(45,8,38,.72)');
  }

  const p = carPos();
  drawCar(p.x, p.y, p.w, p.h, '#53e8ff', 'rgba(8,24,52,.82)');
}

function loop(ts) {
  if (!state.running) return;
  const dt = Math.min(40, ts - (state.lastTs || ts));
  state.lastTs = ts;

  update(dt);
  if (!state.running) return;
  render(dt);
  requestAnimationFrame(loop);
}

function start() {
  startOverlay.hidden = true;
  overOverlay.hidden = true;
  state.running = true;
  state.score = 0;
  state.speed = 160;
  state.distance = 0;
  state.obstacles = [];
  state.spawnTick = 0;
  state.lastTs = 0;
  state.lane = 1;
  scoreEl.textContent = '0';
  speedEl.textContent = '160';
  requestAnimationFrame(loop);
}

function gameOver() {
  state.running = false;
  finalScoreEl.textContent = String(state.score);
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('apex-best', String(state.best));
    bestEl.textContent = String(state.best);
  }
  overOverlay.hidden = false;
}

btnStart.addEventListener('click', start);
btnRetry.addEventListener('click', start);

let touchStartX = 0;
let touching = false;

function swipeStart(x) { touching = true; touchStartX = x; }
function swipeMove(x) {
  if (!touching || !state.running) return;
  const dx = x - touchStartX;
  if (Math.abs(dx) > 26) {
    state.lane = Math.max(0, Math.min(LANE_COUNT - 1, state.lane + (dx > 0 ? 1 : -1)));
    touchStartX = x;
  }
}
function swipeEnd() { touching = false; }

stage.addEventListener('touchstart', (e) => swipeStart(e.touches[0].clientX), { passive: true });
stage.addEventListener('touchmove', (e) => swipeMove(e.touches[0].clientX), { passive: true });
stage.addEventListener('touchend', swipeEnd);
stage.addEventListener('mousedown', (e) => swipeStart(e.clientX));
window.addEventListener('mousemove', (e) => swipeMove(e.clientX));
window.addEventListener('mouseup', swipeEnd);

window.addEventListener('resize', resize);
resize();
render(16);
