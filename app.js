const $ = (sel) => document.querySelector(sel);

const boardEl = $("#board");
const basketEl = $("#basket");
const scoreEl = $("#score");
const levelEl = $("#level");
const streakEl = $("#streak");
const goalEl = $("#goal");
const remainingEl = $("#remaining");
const hintEl = $("#hint");
const dangerFillEl = $("#dangerFill");
const btnRestart = $("#btnRestart");
const btnMute = $("#btnMute");

const modal = $("#modal");
const modalTitle = $("#modalTitle");
const modalText = $("#modalText");
const btnNext = $("#btnNext");
const btnAgain = $("#btnAgain");

const KINDS = ["leaf", "star", "berry", "shell", "feather", "stone"];
const BASKET_CAP = 7;

let state = {
  level: 1,
  score: 0,
  remaining: 0,
  goal: 0,
  sound: true,
  tiles: [],
  basket: [],
  streak: 0,
  lastMatchAt: 0
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
  return `
    <svg class="tileIcon" viewBox="0 0 64 64" aria-hidden="true">
      <use href="./assets/kinds.svg#${kind}"></use>
    </svg>
  `.trim();
}

function beep(freq, ms, type = "sine", gain = 0.05) {
  if (!state.sound) return;
  try {
    const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
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
  } catch {
    // ignore audio errors
  }
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  if (streakEl) streakEl.textContent = String(state.streak);
  goalEl.textContent = String(state.goal);
  remainingEl.textContent = String(state.remaining);
  btnMute.textContent = state.sound ? "Sound: on" : "Sound: off";

  const fill = Math.round((state.basket.length / BASKET_CAP) * 100);
  if (dangerFillEl) dangerFillEl.style.width = `${fill}%`;
}

function setHint(text) {
  hintEl.textContent = text;
}

function showModal(title, text) {
  modalTitle.textContent = title;
  modalText.textContent = text;
  modal.hidden = false;
}

function hideModal() {
  modal.hidden = true;
}

function computeLayout() {
  // responsive: choose columns based on width
  const w = boardEl.clientWidth;
  const cols = w < 520 ? 5 : w < 740 ? 6 : 7;
  const rows = w < 520 ? 7 : w < 740 ? 7 : 7;
  return { cols, rows };
}

function buildDeck(level) {
  const { cols, rows } = computeLayout();
  const base = cols * rows;

  // Make sure count is a multiple of 3 for match-3.
  const target = base - (base % 3);
  const kindsCount = clamp(3 + Math.floor(level / 2), 3, KINDS.length);
  const kinds = KINDS.slice(0, kindsCount);

  const deck = [];
  for (let i = 0; i < target; i++) {
    deck.push(kinds[i % kinds.length]);
  }
  shuffle(deck);

  state.goal = target;
  state.remaining = target;
  updateHud();

  return { deck, cols, rows };
}

function renderBoard(deck, cols, rows) {
  boardEl.innerHTML = "";
  boardEl.style.display = "grid";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  boardEl.style.gap = "10px";

  const tiles = deck.map((kind, idx) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "tile pop";
    el.dataset.kind = kind;
    el.dataset.id = String(idx);
    el.setAttribute("aria-label", `${kind} tile`);

    el.innerHTML = `
      <div class="tileInner">
        ${svgIcon(kind)}
        <div class="tileLabel">${kind}</div>
      </div>
    `;

    el.addEventListener("click", () => onPickTile(el));
    el.addEventListener("animationend", () => el.classList.remove("pop"), { once: true });
    return { kind, el, id: idx, removed: false };
  });

  // fill grid
  for (const t of tiles) boardEl.appendChild(t.el);
  state.tiles = tiles;
}

function renderBasket() {
  const slots = Array.from(basketEl.querySelectorAll(".slot"));
  for (let i = 0; i < BASKET_CAP; i++) {
    const slot = slots[i];
    slot.innerHTML = "";
    const item = state.basket[i];
    if (!item) continue;
    const div = document.createElement("div");
    div.className = "tile";
    div.dataset.kind = item.kind;
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.borderRadius = "12px";
    div.style.boxShadow = "none";
    div.innerHTML = `
      <div class="tileInner" style="gap:4px">
        ${svgIcon(item.kind)}
      </div>
    `;
    slot.appendChild(div);
  }
  updateHud();
}

function basketCountOf(kind) {
  let c = 0;
  for (const b of state.basket) if (b && b.kind === kind) c++;
  return c;
}

function onPickTile(tileEl) {
  const id = Number(tileEl.dataset.id);
  const tile = state.tiles.find((t) => t.id === id);
  if (!tile || tile.removed) return;

  if (state.basket.length >= BASKET_CAP) {
    beep(150, 100, "square", 0.06);
    shake(tileEl);
    return;
  }

  tile.removed = true;
  tileEl.disabled = true;

  flyToBasket(tileEl, tile.kind);
  state.basket.push({ kind: tile.kind, from: tile.id });
  state.remaining -= 1;

  tileEl.style.opacity = "0.2";
  tileEl.style.transform = "scale(0.96)";
  tileEl.style.filter = "grayscale(0.2)";

  const count = basketCountOf(tile.kind);
  beep(420, 60, "sine", 0.04);

  if (count >= 3) {
    clearTriple(tile.kind);
  } else {
    setHint(`Picked ${tile.kind}. Need ${3 - count} more for a match.`);
  }

  if (state.remaining === 0) {
    win();
    return;
  }

  if (state.basket.length >= BASKET_CAP) {
    lose();
  }

  renderBasket();
}

function shake(el) {
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(3px)" },
      { transform: "translateX(-2px)" },
      { transform: "translateX(0)" }
    ],
    { duration: 220, easing: "ease-out" }
  );
}

function flyToBasket(fromEl, kind) {
  const slotEls = Array.from(basketEl.querySelectorAll(".slot"));
  const slotIdx = state.basket.length; // next
  const targetSlot = slotEls[Math.min(slotIdx, slotEls.length - 1)];

  const from = fromEl.getBoundingClientRect();
  const to = targetSlot.getBoundingClientRect();

  const ghost = document.createElement("div");
  ghost.className = "tile fly";
  ghost.dataset.kind = kind;
  ghost.innerHTML = `
    <div class="tileInner">
      ${svgIcon(kind)}
    </div>
  `;
  document.body.appendChild(ghost);

  const x0 = from.left + from.width / 2;
  const y0 = from.top + from.height / 2;
  const x1 = to.left + to.width / 2;
  const y1 = to.top + to.height / 2;

  ghost.style.transform = `translate(${x0 - 32}px, ${y0 - 32}px) scale(0.9)`;
  ghost.style.opacity = "0.95";

  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${x1 - 32}px, ${y1 - 32}px) scale(0.75)`;
    ghost.style.opacity = "0.0";
  });

  setTimeout(() => ghost.remove(), 280);
}

function clearTriple(kind) {
  let removed = 0;
  const next = [];
  for (const item of state.basket) {
    if (item.kind === kind && removed < 3) {
      removed++;
      continue;
    }
    next.push(item);
  }
  state.basket = next;

  const now = Date.now();
  const chain = now - state.lastMatchAt <= 2200;
  state.streak = chain ? state.streak + 1 : 1;
  state.lastMatchAt = now;

  const bonus = clamp(state.streak, 1, 8) * 5;
  state.score += 30 + bonus;

  setHint(`Match! Cleared 3 × ${kind}. +${bonus} bonus (streak ${state.streak}).`);
  beep(660, 70, "triangle", 0.05);
  beep(880, 70, "triangle", 0.05);

  basketEl.animate(
    [{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(1.02)", filter: "brightness(1.15)" }, { transform: "scale(1)", filter: "brightness(1)" }],
    { duration: 240, easing: "ease-out" }
  );

  renderBasket();
}

function win() {
  state.score += 100;
  updateHud();
  setHint("Board cleared!");
  beep(523, 90, "sine", 0.05);
  beep(659, 90, "sine", 0.05);
  beep(784, 110, "sine", 0.05);
  showModal("You win!", `Level ${state.level} cleared. Ready for the next one?`);
}

function lose() {
  setHint("Basket overflow!");
  state.streak = 0;
  state.lastMatchAt = 0;
  updateHud();
  beep(180, 140, "square", 0.06);
  beep(140, 180, "square", 0.06);
  showModal("Game over", "Your basket is full. Try again with better grouping.");
}

function restart(level = 1, keepScore = false) {
  hideModal();
  state.level = level;
  state.basket = [];
  state.streak = 0;
  state.lastMatchAt = 0;
  if (!keepScore) state.score = 0;

  const { deck, cols, rows } = buildDeck(state.level);
  renderBoard(deck, cols, rows);
  renderBasket();
  updateHud();

  setHint("Tap tiles. Match 3 of the same in the basket.");
}

btnRestart.addEventListener("click", () => restart(1, false));
btnMute.addEventListener("click", () => {
  state.sound = !state.sound;
  updateHud();
  if (state.sound) beep(520, 60, "sine", 0.04);
});

btnNext.addEventListener("click", () => {
  const next = state.level + 1;
  restart(next, true);
});

btnAgain.addEventListener("click", () => restart(1, false));

// Close modal when tapping backdrop
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    restart(1, false);
  }
});

// Keep layout stable on resize
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Re-render current level to match columns.
    restart(state.level, true);
  }, 180);
});

restart(1, false);
