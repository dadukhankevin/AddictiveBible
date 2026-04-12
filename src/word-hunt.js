import { getVerse, getTotalVerses } from './bible.js';
import { getWordIdf, isStopword } from './recommend.js';

const STORAGE_KEY = 'ab_wordhunt';
const POINTS_FIND = 10;
const POINTS_MISS = 10;
const LOOK_AHEAD = 50;
const MIN_WORD_LENGTH = 4;

let active = false;
let todayScore = 0;
let allTimeHigh = 0;
let todayDate = '';
let currentTarget = null; // { word, verseIndex, idf }
let targetFound = false;
let onStateChange = null;
let recentWords = []; // last N target words to avoid repeats
const MAX_RECENT = 8;

export function initWordHunt({ onChange }) {
  onStateChange = onChange;
  load();
  notify();
}

function load() {
  active = true; // default for new users
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      allTimeHigh = data.allTimeHigh || 0;
      if (typeof data.active === 'boolean') active = data.active;
      const today = getToday();
      if (data.todayDate === today) {
        todayScore = data.todayScore || 0;
      } else {
        todayScore = 0;
      }
      todayDate = today;
    } catch {
      todayScore = 0;
      allTimeHigh = 0;
      todayDate = getToday();
    }
  } else {
    todayDate = getToday();
  }
}

function save() {
  todayDate = getToday();
  if (todayScore > allTimeHigh) {
    allTimeHigh = todayScore;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    todayScore,
    todayDate,
    allTimeHigh,
    active,
  }));
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function toggleWordHunt() {
  active = !active;
  if (!active) {
    currentTarget = null;
  }
  save();
  notify();
  return active;
}

export function isWordHuntActive() {
  return active;
}

export function getWordHuntState() {
  return {
    active,
    score: todayScore,
    allTimeHigh,
    target: currentTarget,
  };
}

export function pickTarget(fromVi) {
  if (!active) return;

  const endVi = Math.min(fromVi + LOOK_AHEAD, getTotalVerses() - 1);

  let bestWord = null;
  let bestIdf = -1;
  let bestVi = -1;

  for (let i = fromVi; i <= endVi; i++) {
    const v = getVerse(i);
    if (!v) continue;

    const words = v.t.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    for (const word of words) {
      if (word.length < MIN_WORD_LENGTH || isStopword(word)) continue;
      if (recentWords.includes(word)) continue;
      const idf = getWordIdf(word);
      if (idf > bestIdf) {
        bestIdf = idf;
        bestWord = word;
        bestVi = i;
      }
    }
  }

  if (bestWord) {
    currentTarget = { word: bestWord, verseIndex: bestVi, idf: bestIdf };
    targetFound = false;
    recentWords.push(bestWord);
    if (recentWords.length > MAX_RECENT) recentWords.shift();
  } else {
    currentTarget = null;
  }

  notify();
}

export function checkWordTap(tappedWord) {
  if (!active || !currentTarget || targetFound) return false;

  const clean = tappedWord.toLowerCase().replace(/[^a-z]/g, '');
  if (clean === currentTarget.word) {
    targetFound = true;
    todayScore += POINTS_FIND;
    save();
    notify();
    return true;
  }
  return false;
}

// Returns the missed target info if penalty triggered, false otherwise
export function checkScrollPast(anchorVi) {
  if (!active || !currentTarget || targetFound) return false;

  if (anchorVi > currentTarget.verseIndex + 3) {
    todayScore = Math.max(0, todayScore - POINTS_MISS);
    save();
    const missed = currentTarget;
    currentTarget = null;
    notify();
    pickTarget(anchorVi);
    return missed;
  }
  return false;
}

function notify() {
  if (onStateChange) onStateChange(getWordHuntState());
}
