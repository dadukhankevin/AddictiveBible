const STATS_KEY = 'ab_stats';

let stats = {
  streak: 0,
  lastReadDate: null, // 'YYYY-MM-DD'
  totalWordsRead: 0,
  totalTimeMs: 0,
  chaptersExplored: [],
  sessionsCount: 0,
};

let sessionStart = 0;

export function initStats() {
  const saved = localStorage.getItem(STATS_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      Object.assign(stats, data);
    } catch {}
  }

  // Update streak on session start
  const today = getToday();
  if (stats.lastReadDate === today) {
    // Already read today, streak intact
  } else if (stats.lastReadDate === getYesterday()) {
    // Read yesterday, streak continues
    stats.streak++;
    stats.lastReadDate = today;
  } else if (stats.lastReadDate) {
    // Streak broken
    stats.streak = 1;
    stats.lastReadDate = today;
  } else {
    // First time
    stats.streak = 1;
    stats.lastReadDate = today;
  }

  stats.sessionsCount++;
  sessionStart = Date.now();
  save();

  // Save time periodically
  setInterval(() => {
    stats.totalTimeMs += 10000;
    save();
  }, 10000);
}

function save() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function recordChapter(ci) {
  if (!stats.chaptersExplored.includes(ci)) {
    stats.chaptersExplored.push(ci);
    save();
  }
}

export function addWordsRead(count) {
  stats.totalWordsRead += count;
  save();
}

export function getStreak() {
  return stats.streak;
}

export function getStats() {
  return {
    streak: stats.streak,
    totalWords: stats.totalWordsRead,
    totalTime: stats.totalTimeMs + (Date.now() - sessionStart),
    chaptersExplored: stats.chaptersExplored.length,
    totalChapters: 1189,
    sessions: stats.sessionsCount,
    percentBible: Math.round((stats.chaptersExplored.length / 1189) * 100 * 10) / 10,
  };
}

export function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${hours}h ${min}m`;
}
