const SWIPE_THRESHOLD = 60;
const SWIPE_MAX_TIME = 500;
const DOUBLE_TAP_TIME = 300;
const EDGE_ZONE = 25;

let onSwipe = null;
let onTap = null;
let onDoubleTap = null;

let startX = 0;
let startY = 0;
let startTime = 0;
let tracking = false;
let lastTapTime = 0;
let lastTapTarget = null;
let container = null;

export function initGestures({ onSwipeHandler, onTapHandler, onDoubleTapHandler }) {
  onSwipe = onSwipeHandler;
  onTap = onTapHandler;
  onDoubleTap = onDoubleTapHandler;
  container = document.getElementById('reader');

  container.addEventListener('pointerdown', onPointerDown, { passive: true });
  container.addEventListener('pointermove', onPointerMove, { passive: true });
  container.addEventListener('pointerup', onPointerUp, { passive: true });
  container.addEventListener('pointercancel', onPointerCancel, { passive: true });
}

function onPointerDown(e) {
  // Ignore edge swipes (browser back gesture zone)
  if (e.clientX < EDGE_ZONE || e.clientX > window.innerWidth - EDGE_ZONE) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  startX = e.clientX;
  startY = e.clientY;
  startTime = Date.now();
  tracking = true;
}

function onPointerMove(e) {
  if (!tracking) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  // If moving more horizontally, show visual swipe feedback
  if (Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy)) {
    const damped = dx * 0.4;
    container.style.transform = `translateX(${damped}px)`;
    container.classList.add('swiping');
  }
}

function onPointerUp(e) {
  if (!tracking) return;
  tracking = false;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const dt = Date.now() - startTime;

  // Reset swipe visual
  container.style.transform = '';
  container.classList.remove('swiping');

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Check for swipe
  if (absDx > SWIPE_THRESHOLD && absDx > absDy * 1.5 && dt < SWIPE_MAX_TIME) {
    // Animate out then trigger
    const direction = dx > 0 ? 'right' : 'left';
    container.classList.add('snap-back');
    container.style.transform = `translateX(${dx > 0 ? '100%' : '-100%'})`;

    setTimeout(() => {
      container.style.transition = 'none';
      container.style.transform = `translateX(${dx > 0 ? '-100%' : '100%'})`;

      requestAnimationFrame(() => {
        container.style.transition = '';
        container.classList.remove('snap-back');

        if (onSwipe) onSwipe(direction);

        // Slide in from opposite side
        requestAnimationFrame(() => {
          container.classList.add('snap-back');
          container.style.transform = '';
          setTimeout(() => container.classList.remove('snap-back'), 300);
        });
      });
    }, 250);
    return;
  }

  // Check for tap (minimal movement)
  if (absDx < 10 && absDy < 10 && dt < 300) {
    const verseEl = findVerseElement(e.target);
    if (!verseEl) return;

    const now = Date.now();
    // Double tap detection
    if (now - lastTapTime < DOUBLE_TAP_TIME && lastTapTarget === verseEl.dataset.vi) {
      lastTapTime = 0;
      lastTapTarget = null;
      if (onDoubleTap) onDoubleTap(parseInt(verseEl.dataset.vi));
      return;
    }

    lastTapTime = now;
    lastTapTarget = verseEl.dataset.vi;

    // Delay single tap to allow double tap detection
    setTimeout(() => {
      if (lastTapTime === now) {
        if (onTap) onTap(parseInt(verseEl.dataset.vi));
      }
    }, DOUBLE_TAP_TIME);
  }
}

function onPointerCancel() {
  tracking = false;
  container.style.transform = '';
  container.classList.remove('swiping');
  container.classList.remove('snap-back');
}

function findVerseElement(el) {
  while (el && el !== container) {
    if (el.classList && el.classList.contains('verse')) return el;
    el = el.parentElement;
  }
  return null;
}
