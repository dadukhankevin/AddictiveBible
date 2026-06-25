// Flappy Bible — a Flappy Bird mechanic where the "bird" is the current word of
// Scripture. Every flap stamps the word you were riding onto the sky (skywriting),
// advances to the next word, and gives the bird an upward impulse. You read by
// playing: the word on your soul is the word in your eye, and the trail behind
// lets you catch anything that flickered past. Undertale-flavored: pure black,
// white pixel text, a little red soul, chiptune blips.

import { getVerse, getVerseRef, getTotalVerses } from './bible.js';

// ---- Physics (logical CSS px, seconds) ----
const GRAVITY = 1500;
const FLAP = -430;
const MAX_VY = 620;
const SCROLL = 210;          // world scroll speed (px/s)
const PIPE_GAP = 190;
const PIPE_SPACING = 280;    // horizontal distance between pipes
const PIPE_W = 56;
const BIRD_R = 15;           // hitbox half-size (square)
const GROUND_H = 36;

const BEST_KEY = 'ab_flappy_best';
const MUTE_KEY = 'ab_flappy_mute';

let overlay, canvas, ctx, gameoverEl, fgStatsEl, muteBtn;
let dpr = 1, W = 0, H = 0, birdX = 0, groundY = 0;

let state = 'ready';         // 'ready' | 'playing' | 'dead'
let bird = { y: 0, vy: 0 };
let pipes = [];
let stamps = [];             // { word, x, y }
let distSince = 0;
let readyT = 0;
let lastT = 0;
let rafId = null;

// Word stream (mirrors speed-reader's flat {word, vi} buffer)
let words = [];
let wordIndex = 0;
let loadedTo = 0;
let currentWord = '';
let startVi = 0;
let currentVi = 0;
let wordsRead = 0;
let best = 0;

let muted = false;
let audioCtx = null;
let onClose = null;

export function initFlappy({ onCloseHandler }) {
  overlay = document.getElementById('flappy-overlay');
  canvas = document.getElementById('flappy-canvas');
  ctx = canvas.getContext('2d');
  gameoverEl = document.getElementById('flappy-gameover');
  fgStatsEl = document.getElementById('fg-stats');
  muteBtn = document.getElementById('flappy-mute');
  onClose = onCloseHandler;

  best = parseInt(localStorage.getItem(BEST_KEY)) || 0;
  muted = localStorage.getItem(MUTE_KEY) === '1';
  updateMuteIcon();

  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flapInput(); });
  document.getElementById('flappy-close').addEventListener('click', close);
  document.getElementById('flappy-retry').addEventListener('click', () => resumeFlappy());
  document.getElementById('flappy-exit').addEventListener('click', close);
  muteBtn.addEventListener('click', toggleMute);

  window.addEventListener('keydown', (e) => {
    if (!isActive()) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flapInput(); }
    else if (e.code === 'Escape') close();
  });
  window.addEventListener('resize', () => { if (isActive()) resize(); });
}

export function isFlappyActive() {
  return overlay && overlay.classList.contains('active');
}
function isActive() { return isFlappyActive(); }

// Fresh launch from the reader — (re)build the reading stream at this verse
export function startFlappy(verseIndex) {
  startVi = verseIndex;
  currentVi = verseIndex;
  resetWords(verseIndex);
  currentWord = words[0] ? words[0].word : '';
  beginLife();
}

// Retry after death — keep reading position, pick up where you fell
function resumeFlappy() {
  startVi = currentVi; // this life starts wherever the last one ended
  // words / wordIndex / currentWord / loadedTo are intentionally preserved
  beginLife();
}

// Reset everything that belongs to a single attempt (not the reading position)
function beginLife() {
  wordsRead = 0;
  stamps = [];
  pipes = [];
  distSince = 0;
  bird = { y: 0, vy: 0 };
  state = 'ready';
  readyT = 0;

  overlay.classList.add('active');
  gameoverEl.classList.remove('show');
  resize();
  bird.y = H * 0.42;

  lastT = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

// ---- Word stream ----
function resetWords(fromVi) {
  words = [];
  wordIndex = 0;
  loadedTo = fromVi;
  appendVerses(fromVi, 80);
}

function appendVerses(fromVi, n) {
  const total = getTotalVerses();
  const end = Math.min(fromVi + n, total);
  for (let i = fromVi; i < end; i++) {
    const v = getVerse(i);
    if (!v) continue;
    for (const w of v.t.trim().split(/\s+/)) {
      if (w) words.push({ word: w, vi: i });
    }
  }
  loadedTo = end;
}

function ensureWords() {
  if (wordIndex < words.length - 3) return;
  if (loadedTo < getTotalVerses()) appendVerses(loadedTo, 60);
}

function stampAndAdvance() {
  const cur = words[wordIndex];
  if (!cur) return;
  stamps.push({ word: cur.word, x: birdX, y: bird.y });
  wordIndex++;
  ensureWords();
  const next = words[wordIndex];
  if (next) {
    currentWord = next.word;
    if (next.vi !== currentVi) currentVi = next.vi;
  }
  wordsRead++;
  if (wordsRead > best) {
    best = wordsRead;
    localStorage.setItem(BEST_KEY, String(best));
  }
}

// ---- Input ----
function flapInput() {
  if (state === 'ready') {
    state = 'playing';
    lastT = performance.now();
    doFlap(false); // first tap starts + flaps; word[0] stays so they read it
  } else if (state === 'playing') {
    doFlap(true);
  }
  // 'dead' ignores canvas taps — retry/exit buttons handle it
}

function doFlap(advance) {
  if (advance) stampAndAdvance();
  bird.vy = FLAP;
  beep(660, 0.07, 'square', 0.05);
}

// ---- Loop ----
function loop(t) {
  const dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;
  update(dt);
  render();
  rafId = requestAnimationFrame(loop);
}

function update(dt) {
  if (state === 'ready') {
    readyT += dt;
    bird.y = H * 0.42 + Math.sin(readyT * 3) * 12;
    return;
  }
  if (state !== 'playing') return;

  bird.vy = Math.min(MAX_VY, bird.vy + GRAVITY * dt);
  bird.y += bird.vy * dt;

  const dx = SCROLL * dt;
  for (const p of pipes) p.x -= dx;
  for (const s of stamps) s.x -= dx;

  distSince += dx;
  if (distSince >= PIPE_SPACING) {
    distSince -= PIPE_SPACING;
    spawnPipe();
  }

  pipes = pipes.filter(p => p.x + PIPE_W > -10);
  stamps = stamps.filter(s => s.x > -220);

  checkCollisions();
}

function spawnPipe() {
  const minC = 70 + PIPE_GAP / 2;
  const maxC = groundY - 70 - PIPE_GAP / 2;
  const gapY = minC + Math.random() * Math.max(10, maxC - minC);
  pipes.push({ x: W + 10, gapY });
}

function checkCollisions() {
  const cx = birdX, cy = bird.y, r = BIRD_R;
  if (cy - r < 0 || cy + r > groundY) return die();
  for (const p of pipes) {
    if (cx + r > p.x && cx - r < p.x + PIPE_W) {
      const gapTop = p.gapY - PIPE_GAP / 2;
      const gapBot = p.gapY + PIPE_GAP / 2;
      if (cy - r < gapTop || cy + r > gapBot) return die();
    }
  }
}

function die() {
  if (state === 'dead') return;
  state = 'dead';
  beep(220, 0.14, 'square', 0.06);
  setTimeout(() => beep(120, 0.3, 'square', 0.06), 130);
  fgStatsEl.innerHTML =
    `* You read ${wordsRead} word${wordsRead === 1 ? '' : 's'}.<br>` +
    `* ${getVerseRef(startVi)} &rarr; ${getVerseRef(currentVi)}<br>` +
    `* Best: ${best} words`;
  gameoverEl.classList.add('show');
}

// ---- Rendering ----
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  for (const p of pipes) drawPipe(p);
  drawGround();
  drawStampsAndTrail();
  drawBird();
  drawHUD();
  if (state === 'ready') drawReady();
}

function drawPipe(p) {
  const gapTop = p.gapY - PIPE_GAP / 2;
  const gapBot = p.gapY + PIPE_GAP / 2;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.fillRect(p.x, 0, PIPE_W, gapTop);
  ctx.strokeRect(p.x + 1.5, -2, PIPE_W - 3, gapTop);
  ctx.fillRect(p.x, gapBot, PIPE_W, groundY - gapBot);
  ctx.strokeRect(p.x + 1.5, gapBot, PIPE_W - 3, groundY - gapBot + 2);
}

function drawGround() {
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();
}

function drawStampsAndTrail() {
  if (stamps.length > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(stamps[0].x, stamps[0].y);
    for (let i = 1; i < stamps.length; i++) ctx.lineTo(stamps[i].x, stamps[i].y);
    if (state === 'playing') ctx.lineTo(birdX, bird.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '21px VT323, monospace';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  for (const s of stamps) {
    let a = 0.82;
    if (s.x < 150) a *= Math.max(0, s.x / 150); // fade as it exits stage-left
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillText(s.word, s.x, s.y);
  }
  ctx.restore();
}

function drawBird() {
  // The word IS the bird now — render it centered on the hitbox
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 6;
  ctx.fillStyle = state === 'dead' ? 'rgba(255,45,45,0.5)' : '#ff2d2d';
  ctx.font = '31px VT323, monospace';
  ctx.fillText(currentWord, birdX, bird.y);
  ctx.restore();
}

function drawHUD() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = '22px "Press Start 2P", monospace';
  ctx.fillText(String(wordsRead), W / 2, 54);
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('WORDS READ', W / 2, 70);
  ctx.font = '18px VT323, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(getVerseRef(currentVi), W / 2, 92);
  ctx.restore();
}

function drawReady() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '15px "Press Start 2P", monospace';
  ctx.fillText('FLAPPY BIBLE', W / 2, H * 0.22);
  if (Math.floor(readyT * 2) % 2 === 0) {
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('▶ TAP TO BEGIN', W / 2, H * 0.72);
  }
  ctx.restore();
}

// ---- Sizing ----
function resize() {
  const rect = overlay.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  birdX = W * 0.42;
  groundY = H - GROUND_H;
}

// ---- Audio ----
function beep(freq, dur, type, vol) {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now);
    o.stop(now + dur);
  } catch { /* audio unavailable — silent */ }
}

function toggleMute() {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  updateMuteIcon();
}

function updateMuteIcon() {
  if (!muteBtn) return;
  muteBtn.innerHTML = muted
    ? '<i class="fa-solid fa-volume-xmark"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
}

function close() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  overlay.classList.remove('active');
  gameoverEl.classList.remove('show');
  if (onClose) onClose(currentVi);
}
