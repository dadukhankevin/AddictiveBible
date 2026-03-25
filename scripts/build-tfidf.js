import { readFileSync, writeFileSync } from 'fs';

// Simple Porter stemmer (minimal implementation)
function stem(word) {
  if (word.length < 4) return word;
  // Step 1: common suffixes
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

const raw = JSON.parse(readFileSync('BSB.json', 'utf-8'));

// Build chapter documents
const chapterDocs = [];
let chapterIndex = 0;
for (const book of raw.books) {
  for (const ch of book.chapters) {
    const text = ch.verses.map(v => v.text).join(' ');
    chapterDocs.push({ ci: chapterIndex, tokens: tokenize(text) });
    chapterIndex++;
  }
}

const numDocs = chapterDocs.length;
console.log(`Processing ${numDocs} chapters...`);

// Compute document frequency
const df = {};
for (const doc of chapterDocs) {
  const seen = new Set(doc.tokens);
  for (const term of seen) {
    df[term] = (df[term] || 0) + 1;
  }
}

// Prune vocabulary: df >= 3 and df <= 80% of docs
const maxDf = Math.floor(numDocs * 0.8);
const vocab = Object.keys(df)
  .filter(term => df[term] >= 3 && df[term] <= maxDf)
  .sort();

const termToIndex = {};
vocab.forEach((term, i) => { termToIndex[term] = i; });

console.log(`Vocabulary: ${vocab.length} terms (pruned from ${Object.keys(df).length})`);

// Compute IDF
const idf = vocab.map(term => Math.log(numDocs / (1 + df[term])));

// Compute TF-IDF vectors
const vectors = [];
for (const doc of chapterDocs) {
  // Term frequency
  const tf = {};
  for (const token of doc.tokens) {
    if (termToIndex[token] !== undefined) {
      const idx = termToIndex[token];
      tf[idx] = (tf[idx] || 0) + 1;
    }
  }

  // TF-IDF with L2 normalization
  const entries = {};
  let norm = 0;
  for (const [idx, count] of Object.entries(tf)) {
    const weight = count * idf[idx];
    entries[idx] = weight;
    norm += weight * weight;
  }

  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (const idx of Object.keys(entries)) {
      entries[idx] = Math.round((entries[idx] / norm) * 10000) / 10000; // 4 decimal places
    }
  }

  vectors.push({ ci: doc.ci, v: entries });
}

writeFileSync('public/data/vocab.json', JSON.stringify({ terms: vocab, idf: idf.map(v => Math.round(v * 10000) / 10000) }));
writeFileSync('public/data/vectors.json', JSON.stringify(vectors));

console.log(`Written vocab.json (${vocab.length} terms) and vectors.json (${vectors.length} chapters)`);
