const MAX_BUFFER = 50;
const STORAGE_KEY = 'ab_signals';
const LIKES_KEY = 'ab_likes';
const LAST_VERSE_KEY = 'ab_last_verse';

let positiveBuffer = [];
let negativeBuffer = [];
let visitedChapters = new Set();
let likedVerses = []; // array of verse indices
let anchorVerse = null;
let anchorTime = 0;
let initialScrollTop = 0;

export function initSignals() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      positiveBuffer = data.positive || [];
      negativeBuffer = data.negative || [];
      visitedChapters = new Set(data.visited || []);
    } catch {}
  }

  const savedLikes = localStorage.getItem(LIKES_KEY);
  if (savedLikes) {
    try {
      likedVerses = JSON.parse(savedLikes);
    } catch {}
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    positive: positiveBuffer,
    negative: negativeBuffer,
    visited: [...visitedChapters],
  }));
}

function saveLikes() {
  localStorage.setItem(LIKES_KEY, JSON.stringify(likedVerses));
}

export function setAnchor(verseIndex, verseText, chapterIndex, scrollTop) {
  anchorVerse = { index: verseIndex, text: verseText, ci: chapterIndex };
  anchorTime = Date.now();
  initialScrollTop = scrollTop;
  visitedChapters.add(chapterIndex);
  save();
}

export function onSwipeAway(currentScrollTop) {
  if (!anchorVerse) return;

  const dwellTime = Date.now() - anchorTime;
  const scrollDelta = Math.abs(currentScrollTop - initialScrollTop);

  if (dwellTime < 3000 && scrollDelta < 100) {
    negativeBuffer.push(anchorVerse.text);
    if (negativeBuffer.length > MAX_BUFFER) negativeBuffer.shift();
  } else {
    positiveBuffer.push(anchorVerse.text);
    if (positiveBuffer.length > MAX_BUFFER) positiveBuffer.shift();
  }

  save();
  anchorVerse = null;
}

export function likeVerse(verseIndex, text) {
  // Add to positive buffer for recommendations
  positiveBuffer.push(text);
  if (positiveBuffer.length > MAX_BUFFER) positiveBuffer.shift();
  save();

  // Add to likes collection (store index only, no duplicates)
  if (!likedVerses.includes(verseIndex)) {
    likedVerses.push(verseIndex);
    saveLikes();
  }
}

export function unlikeVerse(verseIndex) {
  likedVerses = likedVerses.filter(vi => vi !== verseIndex);
  saveLikes();
}

export function isVerseLiked(verseIndex) {
  return likedVerses.includes(verseIndex);
}

export function getLikedVerses() {
  return likedVerses;
}

export function getPositiveBuffer() {
  return positiveBuffer;
}

export function getNegativeBuffer() {
  return negativeBuffer;
}

export function getVisitedChapters() {
  return visitedChapters;
}

export function hasSignals() {
  return positiveBuffer.length > 0 || negativeBuffer.length > 0;
}

export function saveLastVerse(vi) {
  localStorage.setItem(LAST_VERSE_KEY, String(vi));
}

export function getLastVerse() {
  const saved = localStorage.getItem(LAST_VERSE_KEY);
  if (saved !== null) return parseInt(saved);
  return null;
}
