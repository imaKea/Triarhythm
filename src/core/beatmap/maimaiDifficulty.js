/**
 * Maimai Difficulty System
 * Calculates Maimai ratings (1 to 16) and standardizes difficulty tiers:
 * - Basic (Level 1 - 7)
 * - Advanced (Level 5 - 10)
 * - Expert (Level 8 - 13+)
 * - Master (Level 11 - 15+)
 * - Re:Master (Level 12 - 16)
 * Note: Utage is excluded per specification.
 */

export const MAIMAI_CATEGORIES = ['Basic', 'Advanced', 'Expert', 'Master', 'Re:Master'];

export const MAIMAI_DIFF_ORDER = {
  'basic': 1,
  'advanced': 2,
  'expert': 3,
  'master': 4,
  're:master': 5
};

export const MAIMAI_CATEGORY_COLORS = {
  'Basic': {
    name: 'Basic',
    short: 'BAS',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-600',
    badgeBg: 'bg-emerald-500',
    hex: '#22c55e',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.35)]'
  },
  'Advanced': {
    name: 'Advanced',
    short: 'ADV',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-600',
    badgeBg: 'bg-amber-500',
    hex: '#f59e0b',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]'
  },
  'Expert': {
    name: 'Expert',
    short: 'EXP',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-600',
    badgeBg: 'bg-rose-500',
    hex: '#f43f5e',
    glow: 'shadow-[0_0_12px_rgba(244,63,94,0.35)]'
  },
  'Master': {
    name: 'Master',
    short: 'MAS',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/40',
    text: 'text-purple-600',
    badgeBg: 'bg-purple-600',
    hex: '#9333ea',
    glow: 'shadow-[0_0_12px_rgba(147,51,234,0.35)]'
  },
  'Re:Master': {
    name: 'Re:Master',
    short: 'Re:MAS',
    bg: 'bg-gradient-to-r from-rose-500/20 via-purple-500/20 to-sky-500/20',
    border: 'border-purple-400/60',
    text: 'text-[#9333ea]',
    badgeBg: 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600',
    hex: '#c026d3',
    glow: 'shadow-[0_0_16px_rgba(192,38,211,0.45)]'
  }
};

/**
 * Normalizes any difficulty string into one of the 5 canonical Maimai categories.
 * Excludes Utage by remapping it to Master or Re:Master.
 */
export function normalizeMaimaiCategory(diffName = '') {
  const lower = String(diffName || '').toLowerCase().trim();
  if (!lower) return 'Master';

  // Utage exclusion / fallback -> always re-map to Re:Master
  if (lower.includes('utage') || lower.includes('宴') || lower.includes('special')) {
    return 'Re:Master';
  }

  if (lower.includes('re:master') || lower.includes('remaster') || lower.includes('re-master')) {
    return 'Re:Master';
  }
  if (lower.includes('master') || lower.includes('extra') || lower.includes('another')) {
    return 'Master';
  }
  if (lower.includes('expert') || lower.includes('insane') || lower.includes('hyper')) {
    return 'Expert';
  }
  if (lower.includes('advanced') || lower.includes('medium') || lower.includes('normal') || lower.includes('hard')) {
    return 'Advanced';
  }
  if (lower.includes('basic') || lower.includes('easy') || lower.includes('beginner')) {
    return 'Basic';
  }

  return 'Master';
}

/**
 * Formats numeric level (1.0 - 16.0) into Maimai style level string (e.g. 7+, 12+, 14, 15, 16)
 */
export function formatMaimaiLevel(numericLevel) {
  if (typeof numericLevel === 'string') {
    const trimmed = numericLevel.trim();
    if (/^\d+\+?$/.test(trimmed)) {
      const val = parseInt(trimmed, 10);
      if (val >= 16) return '16';
      return trimmed;
    }
  }

  const num = Math.max(1, Math.min(16, Number(numericLevel) || 1));
  const intPart = Math.floor(num);
  const frac = num - intPart;

  // Levels 7 and above can have "+" (if frac >= 0.6)
  if (intPart >= 7 && intPart < 15 && frac >= 0.6) {
    return `${intPart}+`;
  }
  if (intPart >= 16) {
    return '16';
  }
  return String(intPart);
}

/**
 * Calculates Maimai rating (1.0 to 16.0) based on beatmap note density, complexity and length.
 * Cap is 16.0.
 */
export function calculateMaimaiRating(beatmap) {
  if (!beatmap || !Array.isArray(beatmap.notes) || beatmap.notes.length === 0) {
    return {
      level: 1,
      levelString: '1',
      category: 'Basic',
      rawRating: 1.0
    };
  }

  const notes = [...beatmap.notes].sort((a, b) => (a.time || 0) - (b.time || 0));
  const totalNotes = notes.length;
  const firstTime = notes[0].time || 0;
  const lastTime = notes[notes.length - 1].time || 1000;
  const durationSec = Math.max(1, (lastTime - firstTime) / 1000);

  // 1. Average Note Density (NPS)
  const avgNps = totalNotes / durationSec;

  // 2. Peak Density (max NPS in 2-second sliding windows)
  let peakNps = 0;
  let windowStartIdx = 0;
  for (let i = 0; i < notes.length; i++) {
    const t = notes[i].time || 0;
    while (windowStartIdx < i && t - (notes[windowStartIdx].time || 0) > 2000) {
      windowStartIdx++;
    }
    const countInWindow = i - windowStartIdx + 1;
    const windowDensity = countInWindow / 2.0;
    if (windowDensity > peakNps) peakNps = windowDensity;
  }

  // 3. Note Type Complexity Weights
  let tapCount = 0;
  let holdCount = 0;
  let breakCount = 0;
  let slideCount = 0;
  let ringCount = 0;

  for (const n of notes) {
    if (n.type === 'break') breakCount++;
    else if (n.type === 'slide') slideCount++;
    else if (n.type === 'hold') holdCount++;
    else if (n.type === 'ring') ringCount++;
    else tapCount++;
  }

  const breakRatio = breakCount / totalNotes;
  const slideRatio = slideCount / totalNotes;
  const holdRatio = holdCount / totalNotes;

  const complexityFactor = 1.0 + (breakRatio * 0.35) + (slideRatio * 0.45) + (holdRatio * 0.20);

  // 4. Combined Rating formula
  // Base scaling: NPS 2 -> Level 4, NPS 5 -> Level 9, NPS 8 -> Level 12, NPS 12 -> Level 14.5, NPS 16+ -> Level 16
  const densityScore = (avgNps * 0.6) + (peakNps * 0.4);
  let rawRating = 1.0 + Math.pow(densityScore, 0.92) * 1.35 * complexityFactor;

  // Cap between 1.0 and 16.0
  rawRating = Math.max(1.0, Math.min(16.0, Number(rawRating.toFixed(2))));

  // Determine category from level
  let category = 'Basic';
  if (rawRating >= 13.5) {
    category = rawRating >= 15.0 ? 'Re:Master' : 'Master';
  } else if (rawRating >= 10.0) {
    category = 'Master';
  } else if (rawRating >= 7.0) {
    category = 'Expert';
  } else if (rawRating >= 4.0) {
    category = 'Advanced';
  } else {
    category = 'Basic';
  }

  // If beatmap metadata already has a difficultyName, respect its category
  if (beatmap.metadata?.difficultyName) {
    category = normalizeMaimaiCategory(beatmap.metadata.difficultyName);
  }

  return {
    level: Math.round(rawRating),
    levelString: formatMaimaiLevel(rawRating),
    category,
    rawRating
  };
}
