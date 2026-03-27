import { getChapterByIndex, getTotalChapters, getVerse, getVerseRef, getChapterForVerse } from './bible.js';
import { getPositiveBuffer, getNegativeBuffer, getVisitedChapters, hasSignals } from './signals.js';

let vocab = null;
let vectors = null;
let termToIndex = null;

export function stem(word) {
  if (word.length < 4) return word;
  word = word.replace(/ing$/, '').replace(/tion$/, 't').replace(/sion$/, 's')
    .replace(/ness$/, '').replace(/ment$/, '').replace(/ful$/, '')
    .replace(/ous$/, '').replace(/ive$/, '').replace(/able$/, '')
    .replace(/ible$/, '').replace(/ies$/, 'i').replace(/ied$/, 'i')
    .replace(/es$/, '').replace(/ed$/, '').replace(/ly$/, '')
    .replace(/s$/, '');
  return word || word;
}

const STOPWORDS = new Set([
  'the','and','of','to','in','a','that','is','was','he','for','it','with','as',
  'his','on','be','at','by','i','this','had','not','are','but','from','or',
  'have','an','they','which','one','you','were','her','all','she','there',
  'would','their','we','him','been','has','when','who','will','no','more',
  'if','out','so','up','said','what','its','about','than','into','them',
  'can','only','other','new','some','could','time','these','two','may',
  'then','do','first','any','my','now','such','like','our','over','man',
  'me','even','most','made','after','also','did','many','before','must',
  'through','back','years','where','much','your','way','well','down','should',
  'because','each','just','those','people','how','too','little','state','good',
  'very','make','world','still','own','see','men','work','long','get','here',
  'between','both','life','being','under','never','day','same','another','know',
  'while','last','might','us','great','old','year','off','come','since','against',
  'go','came','right','used','take','three','shall','upon','does','got','let',
  'put','say','went','every','thing','things','am','unto','thou','thy','thee',
  'hath','ye','doth','thereof','wherefore','among','thus','also','whom',
]);

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

export function getWordIdf(word) {
  if (!vocab || !termToIndex) return -1;
  const stemmed = stem(word);
  const idx = termToIndex[stemmed];
  if (idx === undefined) return -1;
  return vocab.idf[idx];
}

export function isStopword(word) {
  return STOPWORDS.has(word);
}

export async function loadRecommendData() {
  const [vData, vecData] = await Promise.all([
    fetch('/data/vocab.json').then(r => r.json()),
    fetch('/data/vectors.json').then(r => r.json()),
  ]);
  vocab = vData;
  vectors = vecData;

  termToIndex = {};
  vocab.terms.forEach((term, i) => { termToIndex[term] = i; });
}

function textToVector(text) {
  const tokens = tokenize(text);
  const tf = {};
  for (const token of tokens) {
    const idx = termToIndex[token];
    if (idx !== undefined) {
      tf[idx] = (tf[idx] || 0) + 1;
    }
  }

  const vec = {};
  let norm = 0;
  for (const [idx, count] of Object.entries(tf)) {
    const weight = count * vocab.idf[idx];
    vec[idx] = weight;
    norm += weight * weight;
  }

  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (const idx of Object.keys(vec)) {
      vec[idx] /= norm;
    }
  }
  return vec;
}

function dot(a, b) {
  let sum = 0;
  for (const idx of Object.keys(a)) {
    if (b[idx]) sum += a[idx] * b[idx];
  }
  return sum;
}

// Curated starting passages — meaningful, beloved, diverse
const COLD_START_CHAPTERS = [
  // Psalms — poetry, comfort, praise
  ['Psalms', 23],   // The Lord is my shepherd
  ['Psalms', 91],   // He who dwells in the shelter of the Most High
  ['Psalms', 139],  // You have searched me and known me
  ['Psalms', 27],   // The Lord is my light and salvation
  ['Psalms', 46],   // God is our refuge and strength
  ['Psalms', 103],  // Bless the Lord, O my soul
  // Gospels — stories and teachings of Jesus
  ['Matthew', 5],   // Sermon on the Mount — Beatitudes
  ['Matthew', 6],   // Lord's Prayer, do not worry
  ['Luke', 15],     // Prodigal son, lost sheep
  ['John', 3],      // For God so loved the world
  ['John', 14],     // In my Father's house are many rooms
  ['John', 15],     // I am the vine
  // Paul's letters — encouragement and theology
  ['Romans', 8],    // Nothing can separate us from the love of God
  ['Romans', 12],   // Living sacrifice, gifts
  ['I Corinthians', 13], // Love is patient, love is kind
  ['Philippians', 4],    // Rejoice in the Lord always
  ['Ephesians', 6],      // Armor of God
  // Old Testament — narrative and prophecy
  ['Genesis', 1],   // In the beginning
  ['Isaiah', 40],   // Those who wait on the Lord
  ['Isaiah', 53],   // Man of sorrows
  ['Ecclesiastes', 3], // A time for everything
  ['Proverbs', 3],  // Trust in the Lord with all your heart
  // Hebrews & Revelation
  ['Hebrews', 11],  // Hall of faith
  ['Revelation of John', 21], // New heaven and new earth
];

export function randomColdStart() {
  const visited = getVisitedChapters();
  const available = [];

  for (const [book, chapter] of COLD_START_CHAPTERS) {
    const ch = findChapter(book, chapter);
    if (ch && !visited.has(ch.ci)) {
      available.push(ch);
    }
  }

  if (available.length > 0) {
    const pick = available[Math.floor(Math.random() * available.length)];
    return pick.startVerse;
  }

  // All curated visited — random chapter
  const total = getTotalChapters();
  const start = Math.floor(Math.random() * total);
  for (let i = 0; i < total; i++) {
    const ci = (start + i) % total;
    if (!visited.has(ci)) {
      return getChapterByIndex(ci).startVerse;
    }
  }
  return 0;
}

function findChapter(book, chapter) {
  const total = getTotalChapters();
  for (let ci = 0; ci < total; ci++) {
    const ch = getChapterByIndex(ci);
    if (ch.book === book && ch.chapter === chapter) return ch;
  }
  return null;
}

export function recommend() {
  const visited = getVisitedChapters();

  if (!hasSignals() || getPositiveBuffer().length === 0) {
    return randomColdStart();
  }

  const posText = getPositiveBuffer().join(' ');
  const negText = getNegativeBuffer().join(' ');
  const posVec = textToVector(posText);
  const negVec = negText ? textToVector(negText) : {};

  let bestScore = -Infinity;
  let bestCi = -1;

  for (const chVec of vectors) {
    if (visited.has(chVec.ci)) continue;

    const posScore = dot(posVec, chVec.v);
    const negScore = dot(negVec, chVec.v);
    const score = posScore - 0.5 * negScore;

    if (score > bestScore) {
      bestScore = score;
      bestCi = chVec.ci;
    }
  }

  if (bestCi === -1) {
    return randomColdStart();
  }

  const chapter = getChapterByIndex(bestCi);
  return chapter.startVerse;
}

// Find a similar verse from a different chapter for the surprise window
export function findSurpriseVerse(verseIndex) {
  const v = getVerse(verseIndex);
  if (!v || !vocab || !vectors) return null;

  const currentChapter = getChapterForVerse(verseIndex);
  if (!currentChapter) return null;

  // Vectorize the source verse text
  const queryVec = textToVector(v.t);

  // Check if the vector has any terms (very short verses may not)
  if (Object.keys(queryVec).length === 0) return null;

  // Find the most similar chapter that isn't the current one
  let bestScore = -Infinity;
  let bestCi = -1;

  for (const chVec of vectors) {
    if (chVec.ci === currentChapter.ci) continue;
    const score = dot(queryVec, chVec.v);
    if (score > bestScore) {
      bestScore = score;
      bestCi = chVec.ci;
    }
  }

  // Quality threshold — only show if there's a genuinely meaningful match
  // This naturally filters out generic/repetitive sections (e.g. Gospels with similar phrasing)
  if (bestCi === -1 || bestScore < 0.12) return null;

  // Pick a verse from that chapter — find the one most textually similar
  const ch = getChapterByIndex(bestCi);
  let bestVerseScore = -Infinity;
  let bestVerseIdx = ch.startVerse;

  for (let i = ch.startVerse; i <= ch.endVerse; i++) {
    const candidate = getVerse(i);
    if (!candidate) continue;
    const candVec = textToVector(candidate.t);
    const score = dot(queryVec, candVec);
    if (score > bestVerseScore) {
      bestVerseScore = score;
      bestVerseIdx = i;
    }
  }

  const surprise = getVerse(bestVerseIdx);
  if (!surprise) return null;

  return {
    verseIndex: bestVerseIdx,
    ref: getVerseRef(bestVerseIdx),
    text: surprise.t,
    chapterStart: ch.startVerse,
  };
}
