import { getVerse, getVerseRef, getTotalVerses } from './bible.js';

let overlay = null;
let wordEl = null;
let countdownEl = null;
let refEl = null;
let wpmEl = null;
let playPauseBtn = null;
let statsEl = null;

let currentVerseIndex = 0;
let words = [];
let wordIndex = 0;
let wpm = 300;
let timer = null;
let running = false;
let onClose = null;

// Stats tracking
let wordsRead = 0;
let startTime = 0;
let elapsedBeforePause = 0;
let statsTimer = null;

// Sentence rhythm tracking
let wordsIntoSentence = 0;

const MIN_WPM = 100;
const MAX_WPM = 1000;
const WPM_STEP = 50;

const SPEED_FONT_SIZES = [1.8, 2.2, 2.8, 3.4, 4.0];
const SPEED_FONT_KEY = 'ab_speed_fontsize';
let speedFontIndex = 2; // default 2.8rem

export function initSpeedReader({ onCloseHandler }) {
  overlay = document.getElementById('speed-overlay');
  wordEl = document.getElementById('speed-word');
  countdownEl = document.getElementById('speed-countdown');
  refEl = document.getElementById('speed-ref');
  wpmEl = document.getElementById('speed-wpm');
  playPauseBtn = document.getElementById('speed-playpause');
  statsEl = document.getElementById('speed-stats');
  onClose = onCloseHandler;

  document.getElementById('speed-close').addEventListener('click', close);
  document.getElementById('speed-slower').addEventListener('click', slower);
  document.getElementById('speed-faster').addEventListener('click', faster);
  document.getElementById('speed-font-down').addEventListener('click', () => changeSpeedFont(-1));
  document.getElementById('speed-font-up').addEventListener('click', () => changeSpeedFont(1));
  playPauseBtn.addEventListener('click', togglePause);

  // Load saved font size
  const savedFont = localStorage.getItem(SPEED_FONT_KEY);
  if (savedFont !== null) speedFontIndex = parseInt(savedFont);
  applySpeedFont();
}

export function startSpeedRead(verseIndex) {
  currentVerseIndex = verseIndex;
  loadWordsFromVerse(verseIndex);

  // Reset stats and rhythm
  wordsRead = 0;
  elapsedBeforePause = 0;
  startTime = 0;
  wordsIntoSentence = 0;
  updateStats();

  overlay.classList.add('active');
  wordEl.textContent = '';
  countdownEl.style.display = '';
  wordEl.style.display = 'none';
  refEl.textContent = getVerseRef(verseIndex);
  updateWpmDisplay();

  // Countdown: 3... 2... 1... Go!
  let count = 3;
  countdownEl.textContent = count;
  countdownEl.classList.add('pulse');

  const countInterval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
    } else if (count === 0) {
      countdownEl.textContent = 'Go!';
    } else {
      clearInterval(countInterval);
      countdownEl.style.display = 'none';
      countdownEl.classList.remove('pulse');
      wordEl.style.display = '';
      running = true;
      startTime = Date.now();
      updatePlayPauseIcon();
      startStatsTimer();
      tick();
    }
  }, 600);
}

function loadWordsFromVerse(startVi) {
  words = [];
  const total = getTotalVerses();
  for (let i = startVi; i < Math.min(startVi + 200, total); i++) {
    const v = getVerse(i);
    if (!v) continue;
    const verseWords = v.t.trim().split(/\s+/);
    for (const w of verseWords) {
      words.push({ word: w, vi: i });
    }
  }
  wordIndex = 0;
}

function tick() {
  if (!running) return;

  if (wordIndex >= words.length) {
    const lastVi = words[words.length - 1]?.vi ?? currentVerseIndex;
    const nextVi = lastVi + 1;
    if (nextVi < getTotalVerses()) {
      loadWordsFromVerse(nextVi);
    } else {
      pause();
      return;
    }
  }

  const entry = words[wordIndex];
  renderORP(entry.word);

  // Verse boundary pause — treat like a paragraph break (research: 2.5x)
  const verseBoundary = entry.vi !== currentVerseIndex;
  if (verseBoundary) {
    currentVerseIndex = entry.vi;
    refEl.textContent = getVerseRef(currentVerseIndex);
  }

  wordIndex++;
  wordsRead++;
  wordsIntoSentence++;

  let delay = computeDelay(entry.word);
  if (verseBoundary) {
    const baseDelay = 60000 / wpm;
    delay = Math.max(delay, baseDelay * 2.5);
  }
  timer = setTimeout(tick, delay);
}

// ORP (Optimal Recognition Point) — the letter your eye naturally fixates on
// Roughly 25-35% into the word, slightly left of center
function getORPIndex(word) {
  const letters = word.replace(/[^a-zA-Z]/g, '');
  const len = letters.length;
  if (len <= 1) return 0;
  if (len <= 3) return 1;
  if (len <= 5) return 1;
  if (len <= 7) return 2;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function renderORP(word) {
  // Find ORP position in the actual word (including punctuation)
  const orpInLetters = getORPIndex(word);

  // Map letter-index to character-index (skip leading punctuation)
  let letterCount = 0;
  let orpCharIndex = 0;
  for (let i = 0; i < word.length; i++) {
    if (/[a-zA-Z]/.test(word[i])) {
      if (letterCount === orpInLetters) {
        orpCharIndex = i;
        break;
      }
      letterCount++;
    }
  }

  const before = word.slice(0, orpCharIndex);
  const orp = word[orpCharIndex] || '';
  const after = word.slice(orpCharIndex + 1);

  // Use a table layout to pin the ORP letter to the center guide
  wordEl.innerHTML =
    `<span class="orp-before">${before}</span>` +
    `<span class="orp-letter">${orp}</span>` +
    `<span class="orp-after">${after}</span>`;
}

// Natural reading rhythm model — based on RSVP research:
// - Punctuation pauses: multiplicative, not additive (Masson 1983, pasky/speedread, DashReader)
// - Word length: sublinear sqrt scaling (pasky/speedread)
// - Sentence momentum: heuristic for natural pacing
function computeDelay(word) {
  const baseDelay = 60000 / wpm;

  // 1. Word length — sublinear sqrt scaling (diminishing returns for long words)
  const letters = word.replace(/[^a-zA-Z]/g, '');
  const len = letters.length;
  const lengthMultiplier = 0.8 + (Math.sqrt(len) * 0.12);
  // 3-char ≈ 1.01x, 5-char ≈ 1.07x, 8-char ≈ 1.14x, 12-char ≈ 1.22x

  // 2. Sentence momentum — start slow, build speed, plateau
  let momentumMultiplier;
  if (wordsIntoSentence <= 1) {
    momentumMultiplier = 1.2; // sentence opener: brain is parsing new context
  } else if (wordsIntoSentence === 2) {
    momentumMultiplier = 1.1;
  } else if (wordsIntoSentence <= 4) {
    momentumMultiplier = 1.0;
  } else {
    momentumMultiplier = 0.95; // cruising, brain has full context
  }

  // 3. Punctuation pauses — multiplicative on base delay (research consensus)
  let punctuationMultiplier = 1.0;
  if (/\.{2,}|…$/.test(word)) {
    // Ellipsis — dramatic pause
    punctuationMultiplier = 2.5;
    wordsIntoSentence = 0;
  } else if (/[.!?]$/.test(word)) {
    // Sentence end — longest pause (research: 2.0–3.0x)
    punctuationMultiplier = 2.5;
    wordsIntoSentence = 0;
  } else if (/[;]$/.test(word)) {
    // Semicolon — major clause break (research: 2.0x)
    punctuationMultiplier = 2.0;
  } else if (/[:]$/.test(word)) {
    // Colon — introducing something (research: 2.0x)
    punctuationMultiplier = 2.0;
  } else if (/[,]$/.test(word)) {
    // Comma — brief breath (research: 1.5–2.0x)
    punctuationMultiplier = 1.5;
  } else if (/[—–\-]$/.test(word) || /^[—–\-]/.test(word)) {
    // Dash — parenthetical or interruption
    punctuationMultiplier = 1.5;
  }

  // 4. Opening quotes — slight extra pause for new speaker/quote
  if (/^["'\u201C\u2018]/.test(word) && wordsIntoSentence <= 1) {
    punctuationMultiplier = Math.max(punctuationMultiplier, 1.3);
  }

  return baseDelay * lengthMultiplier * momentumMultiplier * punctuationMultiplier;
}

function getElapsed() {
  if (running && startTime) {
    return elapsedBeforePause + (Date.now() - startTime);
  }
  return elapsedBeforePause;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function updateStats() {
  if (!statsEl) return;
  const elapsed = getElapsed();
  const timeStr = formatTime(elapsed);
  statsEl.textContent = `${wordsRead} words \u00B7 ${timeStr}`;
}

function startStatsTimer() {
  stopStatsTimer();
  statsTimer = setInterval(updateStats, 500);
}

function stopStatsTimer() {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
}

function pause() {
  if (running) {
    elapsedBeforePause += Date.now() - startTime;
    startTime = 0;
  }
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  stopStatsTimer();
  updateStats(); // one final update
  updatePlayPauseIcon();
}

function resume() {
  running = true;
  startTime = Date.now();
  updatePlayPauseIcon();
  startStatsTimer();
  tick();
}

function togglePause() {
  if (running) {
    pause();
  } else {
    resume();
  }
}

function slower() {
  wpm = Math.max(MIN_WPM, wpm - WPM_STEP);
  updateWpmDisplay();
}

function faster() {
  wpm = Math.min(MAX_WPM, wpm + WPM_STEP);
  updateWpmDisplay();
}

function updateWpmDisplay() {
  wpmEl.textContent = `${wpm} wpm`;
}

function changeSpeedFont(delta) {
  speedFontIndex = Math.max(0, Math.min(SPEED_FONT_SIZES.length - 1, speedFontIndex + delta));
  localStorage.setItem(SPEED_FONT_KEY, String(speedFontIndex));
  applySpeedFont();
}

function applySpeedFont() {
  const size = SPEED_FONT_SIZES[speedFontIndex];
  wordEl.style.fontSize = size + 'rem';
  document.getElementById('speed-font-label').textContent = `Font ${speedFontIndex + 1}/${SPEED_FONT_SIZES.length}`;
}

function updatePlayPauseIcon() {
  playPauseBtn.innerHTML = running
    ? '<i class="fa-solid fa-pause"></i>'
    : '<i class="fa-solid fa-play"></i>';
}

function close() {
  pause();
  overlay.classList.remove('active');
  if (onClose) onClose(currentVerseIndex);
}

export function isSpeedReadActive() {
  return overlay && overlay.classList.contains('active');
}
