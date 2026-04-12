import { loadBible, getVerse, getChapterForVerse } from './bible.js';
import { initReader, loadPassage, getAnchorVerse } from './reader.js';
import { initGestures } from './gestures.js';
import { initSignals, setAnchor, onSwipeAway, likeVerse, saveLastVerse, getLastVerse } from './signals.js';
import { loadRecommendData, recommend, randomColdStart } from './recommend.js';
import { initUI, initHomeScreen, showReader, setBackgroundImage, updateHeader, showModal, closeModal, isModalOpen } from './ui.js';
import { initSpeedReader, startSpeedRead } from './speed-reader.js';
import { initStats, recordChapter } from './stats.js';
import { initWordHunt, pickTarget, checkWordTap, checkScrollPast, isWordHuntActive, toggleWordHunt } from './word-hunt.js';
import { initSettings } from './settings.js';

let readerInitialized = false;
let savePositionTimer = null;

async function init() {
  await Promise.all([loadBible(), loadRecommendData()]);
  initSettings();
  initSignals();
  initStats();
  initWordHunt({ onChange: updateWordHuntHUD });

  initHomeScreen((specificVerse) => {
    let vi;
    let highlight = false;
    if (specificVerse !== undefined) {
      vi = specificVerse;
      highlight = true;
    } else {
      // Resume where they left off, or cold start if first time
      const lastVi = getLastVerse();
      vi = lastVi !== null ? lastVi : randomColdStart();
    }
    startReading(vi, highlight);
  });

  initUI({
    onShuffle: handleShuffle,
    onSpeedRead: handleSpeedRead,
    onNavigate: (vi) => navigateToVerse(vi),
  });

  initSpeedReader({
    onCloseHandler: (vi) => {
      loadPassage(vi);
      updateHeader(vi);

      requestAnimationFrame(() => {
        document.querySelectorAll('.speed-highlight').forEach(el => el.classList.remove('speed-highlight'));
        const el = document.querySelector(`[data-vi="${vi}"]`);
        if (el) {
          el.classList.add('revealed');
          el.classList.add('speed-highlight');
        }
      });
    },
  });
}

function startReading(verseIndex, highlight = false) {
  showReader();

  if (!readerInitialized) {
    initReader({
      onVerseChange: (vi) => {
        updateHeader(vi);
        // Debounce position save — every 2 seconds while scrolling
        if (savePositionTimer) clearTimeout(savePositionTimer);
        savePositionTimer = setTimeout(() => saveLastVerse(vi), 2000);
        // Word hunt: check if target was scrolled past
        const missed = checkScrollPast(vi);
        if (missed) showWordHuntFeedback(false);
      },
      onNavigate: (vi) => navigateToVerse(vi),
    });

    initGestures({
      onSwipeHandler: handleSwipe,
      onTapHandler: handleTap,
      onDoubleTapHandler: handleDoubleTap,
    });

    readerInitialized = true;
  }

  navigateToVerse(verseIndex);

  if (highlight) {
    // Need multiple frames for loadPassage to render and revealVisibleVerses to run
    setTimeout(() => {
      const el = document.querySelector(`[data-vi="${verseIndex}"]`);
      if (el) {
        el.classList.add('revealed');
        el.classList.add('speed-highlight');
      }
    }, 300);
  }
}

function navigateToVerse(verseIndex) {
  loadPassage(verseIndex);
  setBackgroundImage();
  saveLastVerse(verseIndex);

  const v = getVerse(verseIndex);
  const ch = getChapterForVerse(verseIndex);
  if (v && ch) {
    const reader = document.getElementById('reader');
    setAnchor(verseIndex, v.t, ch.ci, reader.scrollTop);
    recordChapter(ch.ci);
  }

  // Pick a new word hunt target for this passage
  if (isWordHuntActive()) {
    pickTarget(verseIndex);
  }
}

function handleShuffle() {
  const reader = document.getElementById('reader');
  onSwipeAway(reader.scrollTop);
  const nextVerse = recommend();
  navigateToVerse(nextVerse);
}

function handleSpeedRead() {
  const vi = getAnchorVerse();
  startSpeedRead(vi);
}

function handleSwipe() {
  if (isModalOpen()) {
    closeModal();
    return;
  }
  handleShuffle();
}

function handleTap(verseIndex, tappedEl) {
  if (isModalOpen()) {
    closeModal();
    return;
  }

  // Word hunt: check if user tapped the target word
  if (isWordHuntActive() && tappedEl && tappedEl.classList.contains('w')) {
    const word = tappedEl.dataset.w;
    if (checkWordTap(word)) {
      tappedEl.classList.add('wh-found');
      showWordHuntFeedback(true);
      setTimeout(() => {
        const vi = getAnchorVerse();
        pickTarget(vi);
      }, 600);
      return;
    }
  }

  showModal(verseIndex);
}

function handleDoubleTap(verseIndex) {
  if (isModalOpen()) closeModal();
  const v = getVerse(verseIndex);
  if (v) {
    likeVerse(verseIndex, v.t);
    const el = document.querySelector(`[data-vi="${verseIndex}"]`);
    if (el) {
      el.classList.add('liked');
      el.style.transform = 'scale(1.02)';
      setTimeout(() => { el.style.transform = ''; }, 200);
    }
  }
}

// Word hunt UI
function updateWordHuntHUD(state) {
  const hud = document.getElementById('word-hunt-hud');
  const wordEl = document.getElementById('wh-word');
  const scoreEl = document.getElementById('wh-score');
  const bestEl = document.getElementById('wh-best');
  const readerScreen = document.getElementById('reader-screen');
  const toggleEl = document.getElementById('wordhunt-toggle');

  if (toggleEl) toggleEl.checked = state.active;

  if (state.active) {
    hud.classList.add('active');
    readerScreen.classList.add('wh-on');
    if (state.target) {
      wordEl.textContent = state.target.word;
    } else {
      wordEl.textContent = '\u2026';
    }
    scoreEl.textContent = state.score;
    bestEl.textContent = `Best: ${state.allTimeHigh}`;
  } else {
    hud.classList.remove('active');
    readerScreen.classList.remove('wh-on');
  }
}

function showWordHuntFeedback(isPositive) {
  const feedback = document.getElementById('wh-feedback');
  feedback.textContent = isPositive ? '+10' : '-10';
  feedback.className = 'wh-feedback ' + (isPositive ? 'wh-plus' : 'wh-minus');
  void feedback.offsetHeight;
  feedback.classList.add('wh-animate');
  setTimeout(() => {
    feedback.classList.remove('wh-animate', 'wh-plus', 'wh-minus');
  }, 1000);
}

// Word hunt toggle: from settings page and the HUD's close (X) button.
function handleWordHuntToggle() {
  const nowActive = toggleWordHunt();
  if (nowActive) {
    const vi = getAnchorVerse();
    pickTarget(vi);
  }
}

document.getElementById('wordhunt-toggle').addEventListener('change', handleWordHuntToggle);
document.getElementById('wh-close').addEventListener('click', handleWordHuntToggle);

init().catch(console.error);
