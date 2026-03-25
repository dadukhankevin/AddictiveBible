import { getVerse, getVerseRef, getBooks, getChaptersForBook, getVersesForChapter, findVerseIndex, getTotalVerses } from './bible.js';
import { likeVerse, isVerseLiked, getLikedVerses, unlikeVerse } from './signals.js';
import { getStreak, getStats, formatDuration } from './stats.js';

let modal = null;
let modalRef = null;
let modalText = null;
let modalLikeBtn = null;
let header = null;
let headerRef = null;
let shuffleBtn = null;
let bgImage = null;
let likesOverlay = null;
let likesListEl = null;
let navOverlay = null;
let navList = null;
let navTitle = null;
let navBack = null;
let currentModalVi = null;
let onNavigateToVerse = null;
let navState = 'books'; // 'books' | 'chapters' | 'verses'
let navSelectedBook = null;
let navSelectedChapter = null;

// Nature images — curated, royalty-free Unsplash photos
const NATURE_IMAGES = [
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=60',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=60',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=60',
  'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=60',
  'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800&q=60',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=60',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=60',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=60',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=60',
  'https://images.unsplash.com/photo-1490682143684-14369e18dce8?w=800&q=60',
  'https://images.unsplash.com/photo-1465189684280-6a8fa9b19a7a?w=800&q=60',
  'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=800&q=60',
  'https://images.unsplash.com/photo-1431512284068-4c4002298068?w=800&q=60',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=60',
  'https://images.unsplash.com/photo-1494825514961-674db1ac2700?w=800&q=60',
  'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=800&q=60',
];

let lastImageIndex = -1;

export function initUI({ onShuffle, onSpeedRead, onNavigate }) {
  modal = document.getElementById('modal');
  modalRef = document.getElementById('modal-ref');
  modalText = document.getElementById('modal-text');
  modalLikeBtn = document.getElementById('modal-like');
  header = document.getElementById('header');
  headerRef = document.getElementById('header-ref');
  shuffleBtn = document.getElementById('shuffle-btn');
  bgImage = document.getElementById('bg-image');
  likesOverlay = document.getElementById('likes-overlay');
  likesListEl = document.getElementById('likes-list');
  navOverlay = document.getElementById('nav-overlay');
  navList = document.getElementById('nav-list');
  navTitle = document.getElementById('nav-title');
  navBack = document.getElementById('nav-back');
  onNavigateToVerse = onNavigate;

  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  // Header ref tap → open nav picker
  document.getElementById('header-ref').addEventListener('click', openNavPicker);
  document.getElementById('nav-close').addEventListener('click', closeNavPicker);
  navBack.addEventListener('click', navGoBack);

  modalLikeBtn.addEventListener('click', () => {
    if (currentModalVi !== null) {
      const v = getVerse(currentModalVi);
      if (v) {
        likeVerse(currentModalVi, v.t);
        modalLikeBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Liked!';
        modalLikeBtn.classList.add('liked');
        const el = document.querySelector(`[data-vi="${currentModalVi}"]`);
        if (el) el.classList.add('liked');
      }
    }
  });

  // Speed read button
  document.getElementById('speed-btn').addEventListener('click', () => {
    if (onSpeedRead) onSpeedRead();
  });

  // Likes button
  document.getElementById('likes-btn').addEventListener('click', openLikes);
  document.getElementById('likes-close').addEventListener('click', closeLikes);

  // Stats button
  document.getElementById('stats-btn').addEventListener('click', openStats);
  document.getElementById('stats-close').addEventListener('click', closeStats);

  shuffleBtn.addEventListener('click', () => {
    shuffleBtn.classList.remove('spin');
    void shuffleBtn.offsetWidth;
    shuffleBtn.classList.add('spin');
    if (onShuffle) onShuffle();
  });
}

// ==================== STATS DASHBOARD ====================

function openStats() {
  renderStats();
  document.getElementById('stats-overlay').classList.add('active');
}

function closeStats() {
  document.getElementById('stats-overlay').classList.remove('active');
}

function renderStats() {
  const s = getStats();
  const content = document.getElementById('stats-content');
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card stat-streak">
        <div class="stat-icon"><i class="fa-solid fa-fire"></i></div>
        <div class="stat-value">${s.streak}</div>
        <div class="stat-label">Day streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fa-solid fa-book-open"></i></div>
        <div class="stat-value">${s.chaptersExplored}</div>
        <div class="stat-label">Chapters explored</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fa-solid fa-clock"></i></div>
        <div class="stat-value">${formatDuration(s.totalTime)}</div>
        <div class="stat-label">Time reading</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fa-solid fa-percent"></i></div>
        <div class="stat-value">${s.percentBible}%</div>
        <div class="stat-label">of the Bible</div>
      </div>
    </div>
  `;
}

// ==================== VERSE OF THE X ====================

function seededRandom(seed) {
  // Simple hash-based PRNG so same seed = same verse
  let h = seed ^ 0xDEADBEEF;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

// Books worth showing as verse-of-the-X (no genealogies, census lists, etc.)
const GOOD_BOOKS = new Set([
  // Gospels
  'Matthew', 'Mark', 'Luke', 'John',
  // Wisdom & Poetry
  'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  // Paul's letters
  'Romans', 'I Corinthians', 'II Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', 'I Thessalonians', 'II Thessalonians',
  'I Timothy', 'II Timothy', 'Titus', 'Philemon',
  // Other letters
  'Hebrews', 'James', 'I Peter', 'II Peter', 'I John', 'II John', 'III John', 'Jude',
  // Prophets (selected)
  'Isaiah', 'Jeremiah', 'Lamentations', 'Micah', 'Habakkuk',
  // Revelation
  'Revelation of John',
]);

// Pre-filter verse indices to only good books (built once)
let goodVerseIndices = null;

function getGoodVerseIndices() {
  if (goodVerseIndices) return goodVerseIndices;
  goodVerseIndices = [];
  const total = getTotalVerses();
  for (let i = 0; i < total; i++) {
    const v = getVerse(i);
    if (v && GOOD_BOOKS.has(v.b)) {
      goodVerseIndices.push(i);
    }
  }
  return goodVerseIndices;
}

function populateVerseOfX() {
  const pool = getGoodVerseIndices();
  if (pool.length === 0) return;

  const now = new Date();

  const daySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const hourSeed = daySeed * 100 + now.getHours();
  const minuteSeed = hourSeed * 100 + now.getMinutes();
  const secondSeed = minuteSeed * 100 + now.getSeconds();

  setVerseOfX('verse-day', 'verse-day-ref', pool[seededRandom(daySeed) % pool.length]);
  setVerseOfX('verse-hour', 'verse-hour-ref', pool[seededRandom(hourSeed) % pool.length]);
  setVerseOfX('verse-minute', 'verse-minute-ref', pool[seededRandom(minuteSeed) % pool.length]);
  setVerseOfX('verse-second', 'verse-second-ref', pool[seededRandom(secondSeed) % pool.length]);
}

function setVerseOfX(textId, refId, vi) {
  const v = getVerse(vi);
  if (!v) return;
  const textEl = document.getElementById(textId);
  textEl.textContent = v.t;
  document.getElementById(refId).textContent = getVerseRef(vi);
  // Store verse index on the parent row for click handling
  textEl.closest('.home-verse-row').dataset.vi = vi;
}

export function initHomeScreen(onStart) {
  const home = document.getElementById('home');
  let triggered = false;

  // Populate streak and verses
  document.getElementById('streak-count').textContent = getStreak();
  populateVerseOfX();

  // Make verse-of-X rows clickable — go to that specific verse
  document.querySelectorAll('.home-verse-row').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const vi = parseInt(row.dataset.vi);
      if (isNaN(vi)) return;
      if (!triggered) {
        triggered = true;
        onStart(vi);
      }
    });
  });

  const trigger = () => {
    if (triggered) return;
    triggered = true;
    onStart(); // no argument = random cold start
  };

  // Only trigger after scrolling past the verse-of-second section
  const getScrollThreshold = () => {
    const lastRow = document.querySelector('.home-verse-row:last-child');
    if (lastRow) return lastRow.offsetTop + lastRow.offsetHeight - home.clientHeight + 40;
    return 200; // fallback
  };

  home.addEventListener('scroll', () => {
    if (home.scrollTop > getScrollThreshold()) trigger();
  }, { passive: true });

  // Wheel events need accumulation since each tick is small
  let wheelAccum = 0;
  home.addEventListener('wheel', (e) => {
    wheelAccum += e.deltaY;
    // Only trigger after substantial wheel scrolling
    if (wheelAccum > 300) trigger();
  }, { passive: true });

  // Touch drag — only use as fallback, the scroll listener is primary
  let touchStartY = 0;
  home.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  home.addEventListener('touchmove', (e) => {
    // Only trigger if scrolled past content (home.scrollTop handles most cases)
    if (home.scrollTop > getScrollThreshold()) trigger();
  }, { passive: true });
}

function openLikes() {
  renderLikesList();
  likesOverlay.classList.add('active');
}

function closeLikes() {
  likesOverlay.classList.remove('active');
}

function renderLikesList() {
  const liked = getLikedVerses();
  likesListEl.innerHTML = '';

  if (liked.length === 0) {
    likesListEl.innerHTML = '<div class="likes-empty"><i class="fa-regular fa-heart"></i><p>No liked verses yet</p><p class="likes-empty-hint">Double-tap any verse to like it</p></div>';
    return;
  }

  // Show newest first
  for (let i = liked.length - 1; i >= 0; i--) {
    const vi = liked[i];
    const v = getVerse(vi);
    if (!v) continue;

    const item = document.createElement('div');
    item.className = 'likes-item';
    item.innerHTML = `
      <div class="likes-item-content">
        <div class="likes-item-ref">${getVerseRef(vi)}</div>
        <div class="likes-item-text">${v.t}</div>
      </div>
      <button class="likes-item-remove" data-vi="${vi}" aria-label="Remove">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    // Tap the content to navigate
    item.querySelector('.likes-item-content').addEventListener('click', () => {
      closeLikes();
      if (onNavigateToVerse) onNavigateToVerse(vi);
    });

    // Remove button
    item.querySelector('.likes-item-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      unlikeVerse(vi);
      item.style.opacity = '0';
      item.style.transform = 'translateX(30px)';
      setTimeout(() => {
        item.remove();
        if (getLikedVerses().length === 0) renderLikesList();
      }, 250);
    });

    likesListEl.appendChild(item);
  }
}

// ==================== NAV PICKER ====================

function openNavPicker() {
  navState = 'books';
  navSelectedBook = null;
  navSelectedChapter = null;
  renderNavBooks();
  navOverlay.classList.add('active');
}

function closeNavPicker() {
  navOverlay.classList.remove('active');
}

function navGoBack() {
  if (navState === 'verses') {
    navState = 'chapters';
    renderNavChapters(navSelectedBook);
  } else if (navState === 'chapters') {
    navState = 'books';
    renderNavBooks();
  }
}

function updateNavHeader(title, showBack) {
  navTitle.textContent = title;
  navBack.style.visibility = showBack ? 'visible' : 'hidden';
}

// Pretty display names for books
function displayBookName(book) {
  return book
    .replace(/^I /, '1 ')
    .replace(/^II /, '2 ')
    .replace(/^III /, '3 ')
    .replace('Psalms', 'Psalms')
    .replace('Revelation of John', 'Revelation');
}

function renderNavBooks() {
  updateNavHeader('Books', false);
  navList.innerHTML = '';

  const books = getBooks();

  // Group by testament
  const otBooks = books.slice(0, 39);
  const ntBooks = books.slice(39);

  const otLabel = document.createElement('div');
  otLabel.className = 'nav-section-label';
  otLabel.textContent = 'Old Testament';
  navList.appendChild(otLabel);

  const otGrid = document.createElement('div');
  otGrid.className = 'nav-grid';
  for (const book of otBooks) {
    otGrid.appendChild(createBookBtn(book));
  }
  navList.appendChild(otGrid);

  const ntLabel = document.createElement('div');
  ntLabel.className = 'nav-section-label';
  ntLabel.textContent = 'New Testament';
  navList.appendChild(ntLabel);

  const ntGrid = document.createElement('div');
  ntGrid.className = 'nav-grid';
  for (const book of ntBooks) {
    ntGrid.appendChild(createBookBtn(book));
  }
  navList.appendChild(ntGrid);
}

function createBookBtn(book) {
  const btn = document.createElement('button');
  btn.className = 'nav-item';
  btn.textContent = displayBookName(book);
  btn.addEventListener('click', () => {
    navSelectedBook = book;
    navState = 'chapters';
    renderNavChapters(book);
  });
  return btn;
}

function renderNavChapters(book) {
  updateNavHeader(displayBookName(book), true);
  navList.innerHTML = '';

  const chapters = getChaptersForBook(book);

  const grid = document.createElement('div');
  grid.className = 'nav-grid nav-grid-numbers';
  for (const ch of chapters) {
    const btn = document.createElement('button');
    btn.className = 'nav-item nav-item-number';
    btn.textContent = ch.chapter;
    btn.addEventListener('click', () => {
      navSelectedChapter = ch.chapter;
      // Go directly to chapter start
      closeNavPicker();
      const vi = findVerseIndex(book, ch.chapter, 1);
      if (vi >= 0 && onNavigateToVerse) onNavigateToVerse(vi);
    });
    grid.appendChild(btn);
  }
  navList.appendChild(grid);
}

export function showReader() {
  document.getElementById('home').classList.remove('active');
  document.getElementById('reader-screen').classList.add('active');
  header.classList.add('visible');
}

export function setBackgroundImage() {
  if (!bgImage) return;

  let idx;
  do {
    idx = Math.floor(Math.random() * NATURE_IMAGES.length);
  } while (idx === lastImageIndex && NATURE_IMAGES.length > 1);
  lastImageIndex = idx;

  const url = NATURE_IMAGES[idx];
  bgImage.classList.remove('active');

  setTimeout(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImage.style.backgroundImage = `url(${url})`;
      void bgImage.offsetHeight;
      bgImage.classList.add('active');
    };
    img.onerror = () => {
      bgImage.style.backgroundImage = `url(${url})`;
      void bgImage.offsetHeight;
      bgImage.classList.add('active');
    };
    img.src = url;
  }, 200);
}

export function updateHeader(verseIndex) {
  const ref = getVerseRef(verseIndex);
  if (ref && headerRef.textContent !== ref) {
    headerRef.textContent = ref;
  }
}

export function showModal(verseIndex) {
  const v = getVerse(verseIndex);
  if (!v) return;

  currentModalVi = verseIndex;
  modalRef.textContent = getVerseRef(verseIndex);
  modalText.textContent = v.t;

  if (isVerseLiked(verseIndex)) {
    modalLikeBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Liked!';
    modalLikeBtn.classList.add('liked');
  } else {
    modalLikeBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Like this verse';
    modalLikeBtn.classList.remove('liked');
  }

  modal.classList.add('active');
}

export function closeModal() {
  modal.classList.remove('active');
  currentModalVi = null;
}

export function isModalOpen() {
  return modal.classList.contains('active');
}
