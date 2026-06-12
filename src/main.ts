import { initDuckDB } from "./duck.ts";
import { GameOfLife } from "./gol.ts";
import { PATTERNS } from "./patterns.ts";

// --- Board geometry -------------------------------------------------------
const COLS = 100;
const ROWS = 60;
const CELL = 9; // logical pixels per cell

// --- DOM ------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = $("status");
const genEl = $("gen");
const liveEl = $("live");
const fpsEl = $("fps");
const playBtn = $("play") as HTMLButtonElement;

const dpr = window.devicePixelRatio || 1;
canvas.style.width = `${COLS * CELL}px`;
canvas.style.height = `${ROWS * CELL}px`;
canvas.width = COLS * CELL * dpr;
canvas.height = ROWS * CELL * dpr;
ctx.scale(dpr, dpr);

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const GRID = cssVar("--grid") || "#1c2230";
const CELLCOLOR = cssVar("--cell") || "#39d353";
const BORDER = cssVar("--border") || "#30363d";

// --- Rendering ------------------------------------------------------------
function draw(xs: Int32Array, ys: Int32Array) {
  ctx.fillStyle = GRID;
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

  // faint grid lines
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  for (let c = 0; c <= COLS; c++) {
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, ROWS * CELL);
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(COLS * CELL, r * CELL + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // live cells
  ctx.fillStyle = CELLCOLOR;
  for (let i = 0; i < xs.length; i++) {
    ctx.fillRect(xs[i] * CELL + 1, ys[i] * CELL + 1, CELL - 1, CELL - 1);
  }
}

// --- Boot -----------------------------------------------------------------
const conn = await initDuckDB();
const game = new GameOfLife(conn, COLS, ROWS);
await game.init();
await game.addCells(PATTERNS.gun, 2, 2); // a nice opening scene
statusEl.textContent = "Ready · running in DuckDB-WASM";

async function refresh(stepMs?: number) {
  const { xs, ys } = await game.snapshot();
  draw(xs, ys);
  genEl.textContent = String(game.generation);
  liveEl.textContent = String(xs.length);
  if (stepMs !== undefined) fpsEl.textContent = stepMs.toFixed(1);
}
await refresh();

// --- Animation loop -------------------------------------------------------
let playing = false;
let speed = 10; // generations per second
let lastTick = 0;
let busy = false;

async function loop(now: number) {
  if (playing) {
    const interval = 1000 / speed;
    if (now - lastTick >= interval && !busy) {
      busy = true;
      const t0 = performance.now();
      await game.step();
      const elapsed = performance.now() - t0;
      await refresh(elapsed);
      lastTick = now;
      busy = false;
    }
    requestAnimationFrame(loop);
  }
}

function setPlaying(on: boolean) {
  playing = on;
  playBtn.textContent = on ? "Pause" : "Play";
  playBtn.classList.toggle("btn-primary", !on);
  if (on) {
    lastTick = 0;
    requestAnimationFrame(loop);
  }
}

// --- Controls -------------------------------------------------------------
playBtn.onclick = () => setPlaying(!playing);

$("step").onclick = async () => {
  if (busy) return;
  setPlaying(false);
  const t0 = performance.now();
  await game.step();
  await refresh(performance.now() - t0);
};

$("clear").onclick = async () => {
  setPlaying(false);
  await game.clear();
  await refresh();
};

$("random").onclick = async () => {
  setPlaying(false);
  await game.randomFill(0.25);
  await refresh();
};

const speedInput = $("speed") as HTMLInputElement;
speedInput.oninput = () => {
  speed = Number(speedInput.value);
  $("speed-val").textContent = speedInput.value;
};

const presetSel = $("preset") as HTMLSelectElement;
presetSel.onchange = async () => {
  const key = presetSel.value;
  if (!key || !PATTERNS[key]) return;
  setPlaying(false);
  await game.clear();
  // center the pattern on the board
  const pts = PATTERNS[key];
  const w = Math.max(...pts.map((p) => p[0])) + 1;
  const h = Math.max(...pts.map((p) => p[1])) + 1;
  const ox = Math.floor((COLS - w) / 2);
  const oy = Math.floor((ROWS - h) / 2);
  await game.addCells(pts, ox, oy);
  await refresh();
};

// --- Click / drag to edit -------------------------------------------------
let painting = false;
let paintState = true;

function cellFromEvent(e: MouseEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
  return [x, y];
}

canvas.addEventListener("mousedown", async (e) => {
  setPlaying(false);
  const [x, y] = cellFromEvent(e);
  paintState = await game.toggle(x, y);
  painting = true;
  await refresh();
});

canvas.addEventListener("mousemove", async (e) => {
  if (!painting) return;
  const [x, y] = cellFromEvent(e);
  await game.setCell(x, y, paintState);
  await refresh();
});

window.addEventListener("mouseup", () => {
  painting = false;
});
