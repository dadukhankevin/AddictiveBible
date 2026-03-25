import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const raw = JSON.parse(readFileSync('BSB.json', 'utf-8'));
const verses = [];
const chapters = [];
let globalIndex = 0;
let chapterIndex = 0;

for (const book of raw.books) {
  for (const ch of book.chapters) {
    const startVerse = globalIndex;
    for (const v of ch.verses) {
      verses.push({
        i: globalIndex,
        b: book.name,
        c: ch.chapter,
        v: v.verse,
        t: v.text.trim(),
        ci: chapterIndex,
      });
      globalIndex++;
    }
    chapters.push({
      ci: chapterIndex,
      book: book.name,
      chapter: ch.chapter,
      startVerse,
      endVerse: globalIndex - 1,
    });
    chapterIndex++;
  }
}

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/bible.json', JSON.stringify(verses));
writeFileSync('public/data/chapters.json', JSON.stringify(chapters));

console.log(`Built ${verses.length} verses, ${chapters.length} chapters`);
