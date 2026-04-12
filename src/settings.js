// Centralized settings: font sizes for reader + speed reader, bionic reading.
// Values persist in localStorage and subscribers get notified on change.

const BIONIC_ENABLED_KEY = 'ab_bionic_enabled';
const BIONIC_INTENSITY_KEY = 'ab_bionic_intensity';
const FONT_KEY = 'ab_fontsize';
const SPEED_FONT_KEY = 'ab_speed_fontsize';

export const FONT_SIZES = [0.9, 1.0, 1.15, 1.3, 1.5, 1.7];
export const SPEED_FONT_SIZES = [1.8, 2.2, 2.8, 3.4, 4.0];

// Intensity 1..5 → fraction of letters in each word to bold.
// ~50% is the standard bionic default; give users a range.
const INTENSITY_FRACTIONS = [0.3, 0.4, 0.5, 0.6, 0.7];

let bionicEnabled = false;
let bionicIntensity = 3;
let fontIndex = 2;      // default 1.15rem
let speedFontIndex = 2; // default 2.8rem

const subscribers = new Set();

export function initSettings() {
  bionicEnabled = localStorage.getItem(BIONIC_ENABLED_KEY) === 'true';

  const intensity = parseInt(localStorage.getItem(BIONIC_INTENSITY_KEY));
  if (!isNaN(intensity)) {
    bionicIntensity = Math.max(1, Math.min(INTENSITY_FRACTIONS.length, intensity));
  }

  const savedFont = parseInt(localStorage.getItem(FONT_KEY));
  if (!isNaN(savedFont)) {
    fontIndex = Math.max(0, Math.min(FONT_SIZES.length - 1, savedFont));
  }

  const savedSpeedFont = parseInt(localStorage.getItem(SPEED_FONT_KEY));
  if (!isNaN(savedSpeedFont)) {
    speedFontIndex = Math.max(0, Math.min(SPEED_FONT_SIZES.length - 1, savedSpeedFont));
  }

  applyFontSize();
}

// ---------- getters ----------
export function getBionicEnabled() { return bionicEnabled; }
export function getBionicIntensity() { return bionicIntensity; }
export function getFontIndex() { return fontIndex; }
export function getSpeedFontIndex() { return speedFontIndex; }
export function getSpeedFontRem() { return SPEED_FONT_SIZES[speedFontIndex]; }

// ---------- setters ----------
export function setBionicEnabled(v) {
  const next = !!v;
  if (next === bionicEnabled) return;
  bionicEnabled = next;
  localStorage.setItem(BIONIC_ENABLED_KEY, String(bionicEnabled));
  notify({ bionic: true });
}

export function setBionicIntensity(v) {
  const next = Math.max(1, Math.min(INTENSITY_FRACTIONS.length, v));
  if (next === bionicIntensity) return;
  bionicIntensity = next;
  localStorage.setItem(BIONIC_INTENSITY_KEY, String(bionicIntensity));
  notify({ bionic: true });
}

export function changeFontSize(delta) {
  const next = Math.max(0, Math.min(FONT_SIZES.length - 1, fontIndex + delta));
  if (next === fontIndex) return;
  fontIndex = next;
  localStorage.setItem(FONT_KEY, String(fontIndex));
  applyFontSize();
  notify({ fontSize: true });
}

export function changeSpeedFont(delta) {
  const next = Math.max(0, Math.min(SPEED_FONT_SIZES.length - 1, speedFontIndex + delta));
  if (next === speedFontIndex) return;
  speedFontIndex = next;
  localStorage.setItem(SPEED_FONT_KEY, String(speedFontIndex));
  notify({ speedFontSize: true });
}

function applyFontSize() {
  document.documentElement.style.setProperty('--verse-font-size', FONT_SIZES[fontIndex] + 'rem');
}

// ---------- subscribe ----------
export function onSettingsChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify(changes) {
  for (const fn of subscribers) {
    try { fn(changes); } catch (e) { console.error(e); }
  }
}

// ---------- bionic helpers ----------

// Given a word (may include punctuation), return the char-index at which
// the bold prefix ends. Returns 0 when bionic is disabled or the word has
// no letters to bold.
export function bionicSplitIndex(word) {
  if (!bionicEnabled || !word) return 0;
  const letters = word.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return 0;
  if (letters.length === 1) return word.length; // bold the whole short word

  const fraction = INTENSITY_FRACTIONS[bionicIntensity - 1];
  const boldLetterCount = Math.max(1, Math.ceil(letters.length * fraction));

  let seen = 0;
  for (let i = 0; i < word.length; i++) {
    if (/[a-zA-Z]/.test(word[i])) {
      seen++;
      if (seen >= boldLetterCount) return i + 1;
    }
  }
  return word.length;
}

// Convenience: split a (plain-text) word into { head, tail } for bionic rendering.
// Caller is responsible for HTML-escaping.
export function bionicSplit(word) {
  const idx = bionicSplitIndex(word);
  return { head: word.slice(0, idx), tail: word.slice(idx) };
}
