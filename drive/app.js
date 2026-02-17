const game = document.getElementById('game');
const road = document.getElementById('road');
const carEl = document.getElementById('car');
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const overlay = document.getElementById('overlay');
const gameOver = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');
const btnStart = document.getElementById('btnStart');
const btnRetry = document.getElementById('btnRetry');
const btnPause = document.getElementById('btnPause');

const laneCount = 4;
let laneWidth = 0;
let laneCenters = [];

let running = false;
let paused = false;
let rafId = 0;
let lastTs = 0;
let spawnTimer = 0;
let spawnInterval = 780;
let speed = 1;
let score = 0;
let carLane = 1;
let obstacles = [];

function recalcLanes() {
  laneWidth = game.clientWidth / laneCount;
  laneCenters = Array.from({ length: laneCount }, (_, i) => i * laneWidth + laneWidth / 2);
  setCarLane(carLane, true);
}

function setCarLane(lane, instant = false) {
  carLane = Math.max(0, Math.min(laneCount - 1, lane));
  const x = laneCenters[carLane] - carEl.offsetWidth / 2;
  carEl.style.transition = instant ? 'none' : 'transform 130ms ease-out';
  carEl.style.transform = `translateX(${x - (game.clientWidth / 2 - carEl.offsetWidth / 2)}px)`;
  if (instant) requestAnimationFrame(() => (carEl.style.transition = 'transform 130ms ease-out'));
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * laneCount);
  const el = document.createElement('div');
  el.className = 'obstacle';
  game.appendChild(el);
  const x = laneCenters[lane] - el.offsetWidth / 2;
  el.style.left = `${x}px`;
  el.style.top = '-90px';
  obstacles.push({ el, lane, y: -90 });
}

function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function endGame() {
  running = false;
  cancelAnimationFrame(rafId);
  finalScore.textContent = Math.floor(score);
  gameOver.hidden = false;
}

function tick(ts) {
  if (!running || paused) return;
  const dt = Math.min(40, ts - (lastTs || ts));
  lastTs = ts;

  speed += dt * 0.00002;
  spawnInterval = Math.max(300, 820 - speed * 120);
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnObstacle();
  }

  score += dt * 0.03 * speed;
  scoreEl.textContent = Math.floor(score);
  speedEl.textContent = `${speed.toFixed(1)}x`;
  road.style.animationDuration = `${Math.max(0.32, 0.92 - speed * 0.08)}s`;

  const carRect = carEl.getBoundingClientRect();
  const vy = dt * (0.22 + speed * 0.13);

  obstacles = obstacles.filter((o) => {
    o.y += vy * 6;
    o.el.style.top = `${o.y}px`;

    if (o.y > game.clientHeight + 100) {
      o.el.remove();
      return false;
    }

    const hit = rectsOverlap(carRect, o.el.getBoundingClientRect());
    if (hit) {
      endGame();
      return false;
    }

    return true;
  });

  rafId = requestAnimationFrame(tick);
}

function reset() {
  obstacles.forEach((o) => o.el.remove());
  obstacles = [];
  speed = 1;
  score = 0;
  spawnTimer = 0;
  spawnInterval = 780;
  carLane = 1;
  scoreEl.textContent = '0';
  speedEl.textContent = '1.0x';
  gameOver.hidden = true;
  recalcLanes();
}

function startGame() {
  overlay.hidden = true;
  reset();
  running = true;
  paused = false;
  btnPause.textContent = 'Pause';
  lastTs = 0;
  rafId = requestAnimationFrame(tick);
}

btnStart.addEventListener('click', startGame);
btnRetry.addEventListener('click', startGame);
btnPause.addEventListener('click', () => {
  if (!running) return;
  paused = !paused;
  btnPause.textContent = paused ? 'Resume' : 'Pause';
  if (!paused) {
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }
});

let startX = 0;
let dragging = false;

function onStart(clientX) {
  startX = clientX;
  dragging = true;
}

function onMove(clientX) {
  if (!dragging || !running || paused) return;
  const dx = clientX - startX;
  if (Math.abs(dx) > 26) {
    if (dx > 0) setCarLane(carLane + 1);
    else setCarLane(carLane - 1);
    startX = clientX;
  }
}

function onEnd() { dragging = false; }

game.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), { passive: true });
game.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
game.addEventListener('touchend', onEnd);

game.addEventListener('mousedown', (e) => onStart(e.clientX));
window.addEventListener('mousemove', (e) => onMove(e.clientX));
window.addEventListener('mouseup', onEnd);

window.addEventListener('resize', recalcLanes);
recalcLanes();
