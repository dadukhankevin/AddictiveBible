import { getVerse, getVerseRef, getTotalVerses } from './bible.js';
import { findSurpriseVerse } from './recommend.js';

const BUFFER_SIZE = 80;
const LOAD_MORE = 30;
const REVEAL_DELAY = 120; // ms delay before a verse starts fading in
const MIN_SURPRISE_GAP = 18; // minimum verses between surprise windows
const SURPRISE_RANDOM_FACTOR = 0.5; // even with a good match, 50% chance to skip (keeps it unpredictable)

let container = null;
let versesEl = null;
let sentinelTop = null;
let sentinelBottom = null;
let renderedStart = 0;
let renderedEnd = 0;
let onVerseVisible = null;
let onSurpriseNavigate = null;
let topObserver = null;
let bottomObserver = null;
let revealObserver = null;
let lastSurpriseVi = -999; // verse index of last surprise shown

export function initReader({ onVerseChange, onNavigate }) {
  onSurpriseNavigate = onNavigate;
  container = document.getElementById('reader');
  versesEl = document.getElementById('verses');
  sentinelTop = document.getElementById('sentinel-top');
  sentinelBottom = document.getElementById('sentinel-bottom');
  onVerseVisible = onVerseChange;

  container.addEventListener('scroll', onScroll, { passive: true });

  // Infinite scroll sentinels
  topObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && renderedStart > 0) {
      prependVerses();
    }
  }, { root: container, rootMargin: '200px 0px 0px 0px' });

  bottomObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && renderedEnd < getTotalVerses() - 1) {
      appendVerses();
    }
  }, { root: container, rootMargin: '0px 0px 200px 0px' });

  // Fog of war: reveal verses as they enter viewport
  // Uses a negative root margin so verses only reveal when they're
  // actually in the visible area (not just near it)
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !entry.target.classList.contains('revealed')) {
        scheduleReveal(entry.target);
      }
    }
  }, {
    root: container,
    rootMargin: '-20px 0px -40px 0px', // tighter than viewport edges
    threshold: 0.01,
  });

  topObserver.observe(sentinelTop);
  bottomObserver.observe(sentinelBottom);
}

// Stagger reveals so they cascade in rather than all popping at once
let revealQueue = [];
let revealTimer = null;

function scheduleReveal(el) {
  revealQueue.push(el);
  if (!revealTimer) {
    processRevealQueue();
  }
}

function processRevealQueue() {
  if (revealQueue.length === 0) {
    revealTimer = null;
    return;
  }

  const batch = revealQueue.splice(0, 2);
  for (const el of batch) {
    el.classList.add('revealed');

    // Try to spawn a surprise window if far enough from last one
    if (el.dataset.vi) {
      const vi = parseInt(el.dataset.vi);
      if (vi - lastSurpriseVi >= MIN_SURPRISE_GAP) {
        maybeInsertSurprise(el, vi);
      }
    }
  }

  revealTimer = setTimeout(processRevealQueue, REVEAL_DELAY);
}

function maybeInsertSurprise(afterEl, verseIndex) {
  const result = findSurpriseVerse(verseIndex);
  if (!result) return; // no good match found (below quality threshold)

  // Even with a good match, add randomness so it's not predictable
  if (Math.random() > SURPRISE_RANDOM_FACTOR) return;

  // Don't insert if there's already a surprise nearby in DOM
  if (afterEl.nextElementSibling && afterEl.nextElementSibling.classList.contains('surprise-window')) return;

  lastSurpriseVi = verseIndex;

  const window = document.createElement('div');
  window.className = 'surprise-window';
  window.innerHTML = `
    <div class="surprise-label"><i class="fa-solid fa-wand-magic-sparkles"></i> Passage portal</div>
    <div class="surprise-ref">${result.ref}</div>
    <div class="surprise-text">${result.text}</div>
    <div class="surprise-cta">Go to passage <i class="fa-solid fa-arrow-right"></i></div>
  `;

  window.addEventListener('click', () => {
    if (onSurpriseNavigate) onSurpriseNavigate(result.chapterStart);
  });

  // Insert after the verse element
  if (afterEl.nextSibling) {
    versesEl.insertBefore(window, afterEl.nextSibling);
  } else {
    versesEl.appendChild(window);
  }

  // Observe for fog-of-war reveal
  revealObserver.observe(window);

  // Animate in with a slight delay
  requestAnimationFrame(() => {
    window.classList.add('revealed');
  });
}

function clearRevealQueue() {
  revealQueue = [];
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
}

export function loadPassage(verseIndex) {
  const total = getTotalVerses();
  const half = Math.floor(BUFFER_SIZE / 2);
  renderedStart = Math.max(0, verseIndex - half);
  renderedEnd = Math.min(total - 1, verseIndex + half);

  clearRevealQueue();
  lastSurpriseVi = -999;
  versesEl.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (let i = renderedStart; i <= renderedEnd; i++) {
    frag.appendChild(createVerseEl(i));
  }

  versesEl.appendChild(frag);

  // Scroll to target, then reveal the initially visible verses
  requestAnimationFrame(() => {
    const targetEl = versesEl.querySelector(`[data-vi="${verseIndex}"]`);
    if (targetEl) {
      container.scrollTop = targetEl.offsetTop - 60;
    }

    // Immediately reveal verses near the starting position
    // so the user doesn't see a blank screen
    revealVisibleVerses();
  });
}

function revealVisibleVerses() {
  const scrollTop = container.scrollTop;
  const viewBottom = scrollTop + container.clientHeight;

  const children = versesEl.children;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (!el.dataset.vi) continue;
    const top = el.offsetTop;
    const bot = top + el.offsetHeight;
    // Reveal if it overlaps the viewport
    if (bot > scrollTop - 50 && top < viewBottom + 50) {
      el.classList.add('revealed');
    }
  }
}

export function getAnchorVerse() {
  const children = versesEl.children;
  const scrollTop = container.scrollTop + 70;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (!el.dataset.vi) continue;
    if (el.offsetTop + el.offsetHeight > scrollTop) {
      return parseInt(el.dataset.vi);
    }
  }
  return renderedStart;
}

export function getScrollDelta() {
  return Math.abs(container.scrollTop);
}

// Holy name words for bold treatment
const HOLY_WORDS = new Set(['lord', 'god', 'jesus', 'christ', 'messiah', 'almighty', 'holy', 'spirit']);
const GOLDEN_CHANCE = 0.007; // ~0.7% of verses get the golden treatment

function createVerseEl(i) {
  const v = getVerse(i);
  if (!v) return document.createDocumentFragment();

  const span = document.createElement('span');
  span.className = 'verse';
  span.dataset.vi = i;

  // Split text into words and whitespace, wrap each word in a tappable span
  const parts = v.t.split(/(\s+)/);
  let html = '';
  for (const part of parts) {
    if (/^\s*$/.test(part)) {
      html += part || '';
      continue;
    }
    const escaped = part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const clean = part.toLowerCase().replace(/[^a-z]/g, '');
    const isHoly = HOLY_WORDS.has(clean);
    const wordSpan = `<span class="w" data-w="${clean}">${escaped}</span>`;
    html += isHoly ? `<strong class="holy-name">${wordSpan}</strong>` : wordSpan;
  }
  html += ' ';
  span.innerHTML = html;

  // Rare golden verse effect
  if (Math.random() < GOLDEN_CHANCE) {
    span.classList.add('golden');
  }

  const frag = document.createDocumentFragment();

  if (v.v === 1 && i > renderedStart) {
    const brk = document.createElement('span');
    brk.className = 'chapter-break';
    frag.appendChild(brk);
  }

  frag.appendChild(span);

  // Observe for fog-of-war reveal
  revealObserver.observe(span);

  return frag;
}

function prependVerses() {
  const newStart = Math.max(0, renderedStart - LOAD_MORE);
  if (newStart >= renderedStart) return;

  const scrollHeightBefore = container.scrollHeight;
  const frag = document.createDocumentFragment();

  for (let i = newStart; i < renderedStart; i++) {
    const el = createVerseEl(i);
    frag.appendChild(el);
  }

  versesEl.insertBefore(frag, versesEl.firstChild);
  renderedStart = newStart;

  const scrollHeightAfter = container.scrollHeight;
  container.scrollTop += scrollHeightAfter - scrollHeightBefore;

  // Prepended verses (scrolled past) should be revealed immediately
  const children = versesEl.children;
  for (let i = 0; i < LOAD_MORE + 5 && i < children.length; i++) {
    if (children[i].dataset && children[i].dataset.vi) {
      children[i].classList.add('revealed');
    }
  }

  trimBottom();
}

function appendVerses() {
  const total = getTotalVerses();
  const newEnd = Math.min(total - 1, renderedEnd + LOAD_MORE);
  if (newEnd <= renderedEnd) return;

  const frag = document.createDocumentFragment();

  for (let i = renderedEnd + 1; i <= newEnd; i++) {
    frag.appendChild(createVerseEl(i));
  }

  versesEl.appendChild(frag);
  renderedEnd = newEnd;

  trimTop();
}

function trimBottom() {
  const maxRendered = BUFFER_SIZE + LOAD_MORE * 2;
  while (renderedEnd - renderedStart > maxRendered) {
    const last = versesEl.lastElementChild;
    if (last && last.dataset.vi) {
      revealObserver.unobserve(last);
      versesEl.removeChild(last);
      renderedEnd--;
    } else if (last) {
      versesEl.removeChild(last);
    } else break;
  }
}

function trimTop() {
  const maxRendered = BUFFER_SIZE + LOAD_MORE * 2;
  while (renderedEnd - renderedStart > maxRendered) {
    const first = versesEl.firstElementChild;
    if (!first) break;
    if (first.dataset && first.dataset.vi) {
      revealObserver.unobserve(first);
    }
    const heightBefore = container.scrollHeight;
    versesEl.removeChild(first);
    container.scrollTop -= heightBefore - container.scrollHeight;
    if (first.dataset && first.dataset.vi) {
      renderedStart = parseInt(first.dataset.vi) + 1;
    }
  }
}

let scrollTick = false;
function onScroll() {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => {
    scrollTick = false;
    const vi = getAnchorVerse();
    if (onVerseVisible) {
      onVerseVisible(vi);
    }
  });
}
