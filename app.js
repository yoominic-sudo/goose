const $ = (s) => document.querySelector(s);

const boardEl = $("#board");
const basketEl = $("#basket");
const scoreEl = $("#score");
const levelEl = $("#level");
const timeLeftEl = $("#timeLeft");
const goalEl = $("#goal");
const remainingEl = $("#remaining");
const hintEl = $("#hint");
const dangerFillEl = $("#dangerFill");

const btnRestart = $("#btnRestart");
const btnMute = $("#btnMute");
const btnShake = $("#btnShake");

const modal = $("#modal");
modal.hidden = true;
const modalTitle = $("#modalTitle");
const modalText = $("#modalText");
const btnNext = $("#btnNext");
const btnAgain = $("#btnAgain");

const KINDS = ["leaf", "star", "berry", "shell", "feather", "stone"];
const BAR_CAP = 7;
const LIMIT_SECONDS = 10 * 60;

let timer = null;

const state = {
  level: 1,
  score: 0,
  sound: true,
  secs: LIMIT_SECONDS,
  goal: 0,
  remaining: 0,
  grid: [],
  rows: 6,
  cols: 6,
  selected: null,
  bar: [],
  ended: false
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function svgIcon(kind) {
  return `<svg class="tileIcon" viewBox="0 0 64 64"><use href="./assets/kinds.svg#${kind}"></use></svg>`;
}

function beep(freq, ms, type = "sine", gain = 0.05) {
  if (!state.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = beep.ctx || (beep.ctx = new Ctx());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      o.disconnect();
      g.disconnect();
    }, ms);
  } catch {}
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function setHint(t) {
  hintEl.textContent = t;
}

function showModal(title, text) {
  modalTitle.textContent = title;
  modalText.textContent = text;
  modal.hidden = false;
}

function hideModal() {
  modal.hidden = true;
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  timeLeftEl.textContent = fmtTime(state.secs);
  goalEl.textContent = String(state.goal);
  remainingEl.textContent = String(state.remaining);
  btnMute.textContent = state.sound ? "Sound: on" : "Sound: off";
  dangerFillEl.style.width = `${Math.round((state.bar.length / BAR_CAP) * 100)}%`;
}

function computeSize() {
  const w = Math.max(boardEl.clientWidth || 0, window.innerWidth || 0);
  if (w < 520) return { rows: 5, cols: 5 };
  if (w < 900) return { rows: 6, cols: 6 };
  return { rows: 6, cols: 7 };
}

function topAt(r, c) {
  const stack = state.grid[r][c];
  return stack.length ? stack[stack.length - 1] : null;
}

function isTopVisible(r, c) {
  return !!topAt(r, c);
}

function buildLevel(level) {
  const { rows, cols } = computeSize();
  state.rows = rows;
  state.cols = cols;

  const totalCells = rows * cols;
  const layers = clamp(2 + Math.floor(level / 2), 2, 4);
  const kindsCount = clamp(4 + Math.floor(level / 2), 4, KINDS.length);
  const kinds = KINDS.slice(0, kindsCount);

  const totalItemsRaw = totalCells * layers;
  const totalItems = totalItemsRaw - (totalItemsRaw % 2); // pairs

  const pool = [];
  for (let i = 0; i < totalItems / 2; i++) {
    const k = kinds[i % kinds.length];
    pool.push(k, k);
  }
  shuffle(pool);

  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));

  // distribute by layers; each pass fills random subset of cells
  for (let d = 0; d < layers; d++) {
    const coords = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) coords.push([r, c]);
    shuffle(coords);
    const fillCount = clamp(totalCells - d * Math.floor(totalCells * 0.15), Math.floor(totalCells * 0.5), totalCells);
    for (let i = 0; i < fillCount && pool.length; i++) {
      const [r, c] = coords[i];
      grid[r][c].push(pool.pop());
    }
  }

  // if leftovers, place randomly
  while (pool.length) {
    const r = randInt(0, rows - 1);
    const c = randInt(0, cols - 1);
    grid[r][c].push(pool.pop());
  }

  state.grid = grid;
  state.goal = totalItems;
  state.remaining = totalItems;
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.display = "grid";
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, minmax(0, 1fr))`;
  boardEl.style.gap = "10px";

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const tile = topAt(r, c);
      const depth = state.grid[r][c].length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);

      if (!tile) {
        btn.disabled = true;
        btn.style.opacity = "0.25";
        btn.innerHTML = `<div class="tileInner"><div class="tileLabel">empty</div></div>`;
      } else {
        btn.dataset.kind = tile;
        btn.style.transform = `translateY(${-Math.min(depth - 1, 4) * 2}px)`;
        btn.innerHTML = `
          <div class="tileInner">
            ${svgIcon(tile)}
            <div class="tileLabel">${tile} · L${depth}</div>
          </div>
        `;
        if (state.selected && state.selected.r === r && state.selected.c === c) {
          btn.style.outline = "2px solid rgba(124,242,198,.9)";
          btn.style.outlineOffset = "1px";
        }
        btn.addEventListener("click", () => pick(r, c));
      }
      boardEl.appendChild(btn);
    }
  }
}

function renderBar() {
  const slots = Array.from(basketEl.querySelectorAll(".slot"));
  for (let i = 0; i < BAR_CAP; i++) {
    slots[i].innerHTML = "";
    const item = state.bar[i];
    if (!item) continue;
    const d = document.createElement("div");
    d.className = "tile";
    d.dataset.kind = item;
    d.style.width = "100%";
    d.style.height = "100%";
    d.style.borderRadius = "12px";
    d.style.boxShadow = "none";
    d.innerHTML = `<div class="tileInner">${svgIcon(item)}</div>`;
    slots[i].appendChild(d);
  }
  updateHud();
}

function neighbors(r, c) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1]
  ].filter(([nr, nc]) => nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols);
}

// path must go through currently empty top cells, can start/end on selected tiles
function hasPath(a, b) {
  const q = [[a.r, a.c]];
  const seen = new Set([`${a.r},${a.c}`]);

  while (q.length) {
    const [r, c] = q.shift();
    if (r === b.r && c === b.c) return true;

    for (const [nr, nc] of neighbors(r, c)) {
      const k = `${nr},${nc}`;
      if (seen.has(k)) continue;

      const isTarget = nr === b.r && nc === b.c;
      const passable = !topAt(nr, nc) || isTarget;
      if (!passable) continue;

      seen.add(k);
      q.push([nr, nc]);
    }
  }

  return false;
}

function removeTop(r, c) {
  if (!state.grid[r][c].length) return null;
  const k = state.grid[r][c].pop();
  state.remaining -= 1;
  return k;
}

function pushBar(kind) {
  state.bar.push(kind);
  if (state.bar.length > BAR_CAP) state.bar.length = BAR_CAP;
}

function clearPairFromBar(kind) {
  let need = 2;
  const next = [];
  for (const k of state.bar) {
    if (k === kind && need > 0) {
      need--;
      continue;
    }
    next.push(k);
  }
  state.bar = next;
}

function pick(r, c) {
  if (state.ended) return;
  const kind = topAt(r, c);
  if (!kind) return;

  if (!state.selected) {
    state.selected = { r, c, kind };
    pushBar(kind);
    setHint(`已选中 ${kind}，再选一个相同图案尝试消除。`);
    beep(480, 50, "sine", 0.04);
    renderBar();
    renderBoard();
    if (state.bar.length >= BAR_CAP) failByBar();
    return;
  }

  const a = state.selected;
  const sameCell = a.r === r && a.c === c;
  if (sameCell) {
    state.selected = null;
    setHint("已取消选中。");
    renderBoard();
    return;
  }

  pushBar(kind);

  const ok = a.kind === kind && hasPath(a, { r, c });
  if (ok) {
    removeTop(a.r, a.c);
    removeTop(r, c);
    clearPairFromBar(kind);
    state.score += 40;
    setHint(`消除成功：${kind}`);
    beep(720, 70, "triangle", 0.05);
    beep(960, 80, "triangle", 0.05);
  } else {
    state.score = Math.max(0, state.score - 5);
    setHint("无法消除：需要相同图案 + 连通路径 + 顶层无遮挡。");
    beep(170, 110, "square", 0.05);
  }

  state.selected = null;
  renderBar();
  renderBoard();
  updateHud();

  if (state.remaining <= 0) {
    win();
    return;
  }
  if (state.bar.length >= BAR_CAP) {
    failByBar();
  }
}

function win() {
  state.ended = true;
  stopTimer();
  showModal("抓到大鹅了!", `你在 ${fmtTime(LIMIT_SECONDS - state.secs)} 内清空了全部物品。`);
}

function taunt(reason) {
  return reason === "timeout"
    ? "大鹅：时间到咯，你这手速还得练练～"
    : "大鹅：物品栏都塞爆啦，还想抓我？";
}

function failByBar() {
  state.ended = true;
  stopTimer();
  showModal("失败", taunt("bar"));
}

function failByTimeout() {
  state.ended = true;
  stopTimer();
  showModal("超时", taunt("timeout"));
}

function shakePot() {
  if (state.ended) return;

  // random swap some top tiles
  const tops = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (topAt(r, c)) tops.push([r, c]);
    }
  }

  shuffle(tops);
  const swaps = Math.floor(tops.length * 0.2);
  for (let i = 0; i + 1 < swaps * 2; i += 2) {
    const [r1, c1] = tops[i];
    const [r2, c2] = tops[i + 1];
    const s1 = state.grid[r1][c1];
    const s2 = state.grid[r2][c2];
    const t1 = s1.pop();
    const t2 = s2.pop();
    s1.push(t2);
    s2.push(t1);
  }

  state.score = Math.max(0, state.score - 10);
  state.selected = null;
  setHint("颠锅成功：位置已重排（-10 分）。");
  beep(220, 80, "sawtooth", 0.05);
  boardEl.animate(
    [
      { transform: "translateX(0) rotate(0deg)" },
      { transform: "translateX(-8px) rotate(-1.8deg)" },
      { transform: "translateX(8px) rotate(1.8deg)" },
      { transform: "translateX(0) rotate(0deg)" }
    ],
    { duration: 320, easing: "ease-out" }
  );

  renderBoard();
  updateHud();
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    if (state.ended) return;
    state.secs -= 1;
    if (state.secs <= 0) {
      state.secs = 0;
      updateHud();
      failByTimeout();
      return;
    }
    updateHud();
  }, 1000);
}

function restart(level = 1) {
  hideModal();
  state.level = level;
  state.secs = LIMIT_SECONDS;
  state.selected = null;
  state.bar = [];
  state.ended = false;
  state.score = level === 1 ? 0 : state.score;

  buildLevel(level);
  renderBoard();
  renderBar();
  updateHud();
  setHint("点击两个相同且连通路径可达、且都在顶层的物品进行消除。");
  startTimer();
}

btnRestart.addEventListener("click", () => restart(1));
btnAgain.addEventListener("click", () => restart(1));
btnNext.addEventListener("click", () => restart(state.level + 1));

btnMute.addEventListener("click", () => {
  state.sound = !state.sound;
  updateHud();
});

btnShake.addEventListener("click", shakePot);

// shake via device motion
let lastShake = 0;
window.addEventListener("devicemotion", (e) => {
  if (!e.accelerationIncludingGravity) return;
  const a = e.accelerationIncludingGravity;
  const mag = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
  const now = Date.now();
  if (mag > 45 && now - lastShake > 1800) {
    lastShake = now;
    shakePot();
  }
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) hideModal();
});

let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    if (!state.ended) {
      const keepLevel = state.level;
      const keepScore = state.score;
      restart(keepLevel);
      state.score = keepScore;
      updateHud();
    }
  }, 200);
});

restart(1);
