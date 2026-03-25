import { loadBible, getVerse, getChapterForVerse } from './bible.js';
import { initReader, loadPassage, getAnchorVerse } from './reader.js';
import { initGestures } from './gestures.js';
import { initSignals, setAnchor, onSwipeAway, likeVerse, saveLastVerse, getLastVerse } from './signals.js';
import { loadRecommendData, recommend, randomColdStart } from './recommend.js';
import { initUI, initHomeScreen, showReader, setBackgroundImage, updateHeader, showModal, closeModal, isModalOpen } from './ui.js';
import { initSpeedReader, startSpeedRead } from './speed-reader.js';
import { initStats, recordChapter } from './stats.js';

let readerInitialized = false;
let savePositionTimer = null;

async function init() {
  await Promise.all([loadBible(), loadRecommendData()]);
  initSignals();
  initStats();

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

function handleTap(verseIndex) {
  if (isModalOpen()) {
    closeModal();
    return;
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

init().catch(console.error);
