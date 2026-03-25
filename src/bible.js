let verses = null;
let chapters = null;

export async function loadBible() {
  const [vData, cData] = await Promise.all([
    fetch('/data/bible.json').then(r => r.json()),
    fetch('/data/chapters.json').then(r => r.json()),
  ]);
  verses = vData;
  chapters = cData;
}

export function getVerse(i) {
  if (i < 0 || i >= verses.length) return null;
  return verses[i];
}

export function getVersesInRange(start, end) {
  const s = Math.max(0, start);
  const e = Math.min(verses.length - 1, end);
  return verses.slice(s, e + 1);
}

export function getVerseRef(i) {
  const v = verses[i];
  if (!v) return '';
  return `${v.b} ${v.c}:${v.v}`;
}

export function getChapterForVerse(i) {
  const v = verses[i];
  if (!v) return null;
  return chapters[v.ci];
}

export function getChapterByIndex(ci) {
  return chapters[ci];
}

export function getTotalVerses() {
  return verses ? verses.length : 0;
}

export function getTotalChapters() {
  return chapters ? chapters.length : 0;
}

export function findVerseIndex(book, chapter, verse) {
  return verses.findIndex(v => v.b === book && v.c === chapter && v.v === verse);
}

export function getBooks() {
  if (!chapters) return [];
  const books = [];
  let lastBook = null;
  for (const ch of chapters) {
    if (ch.book !== lastBook) {
      books.push(ch.book);
      lastBook = ch.book;
    }
  }
  return books;
}

export function getChaptersForBook(book) {
  if (!chapters) return [];
  return chapters.filter(ch => ch.book === book);
}

export function getVersesForChapter(book, chapter) {
  if (!verses) return [];
  return verses.filter(v => v.b === book && v.c === chapter);
}
