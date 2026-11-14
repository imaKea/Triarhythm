/**
 * Cấu hình phán định & hệ thống tính điểm
 * Cửa sổ thời gian (ms), trọng số note, xếp hạng Rank
 */

export const JUDGEMENT_CONFIG = {
  // Cửa sổ chấm điểm (±ms)
  windows: {
    criticalPerfect: 25, // ±25ms
    perfect: 50,         // ±50ms
    great: 100,          // ±100ms
    good: 150            // ±150ms
  },

  // Trọng số cơ sở cho từng loại note
  weights: {
    tap: 1,
    hold: 2,
    ring: 3,
    slide: 3,
    break: 5,
    typing: 1
  },

  // Tỉ lệ điểm thưởng theo phán định
  scoreRates: {
    criticalPerfect: 1.0,
    perfect: 0.8,
    great: {
      tap: 0.5,
      hold: 0.6,
      ring: 0.7,
      slide: 0.7,
      break: 0.8,
      typing: 0.5
    },
    good: 0.25,
    miss: 0.0
  },

  // Break bonus tối đa cộng thêm vào Achievement
  breakBonusMax: 1.0000, // Tối đa đạt 101.0000%

  // Bảng xếp hạng theo Achievement %
  ranks: [
    { rank: 'SSS+', minAcc: 100.5, color: '#ffea00' },
    { rank: 'SSS',  minAcc: 100.0, color: '#ffd600' },
    { rank: 'SS+',  minAcc: 99.5,  color: '#ff80ab' },
    { rank: 'SS',   minAcc: 99.0,  color: '#f50057' },
    { rank: 'S+',   minAcc: 98.0,  color: '#00e5ff' },
    { rank: 'S',    minAcc: 97.0,  color: '#00b0ff' },
    { rank: 'AAA',  minAcc: 94.0,  color: '#69f0ae' },
    { rank: 'AA',   minAcc: 90.0,  color: '#00e676' },
    { rank: 'A',    minAcc: 80.0,  color: '#b0bec5' },
    { rank: 'B',    minAcc: 75.0,  color: '#ff9100' },
    { rank: 'C',    minAcc: 0.0,   color: '#78909c' }
  ]
};

/**
 * Xác định phán định dựa trên độ lệch thời gian deltaMs (hitTime - targetTime)
 * @param {number} deltaMs
 * @returns {'CRITICAL_PERFECT' | 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'}
 */
export function getJudgement(deltaMs) {
  const abs = Math.abs(deltaMs);
  const w = JUDGEMENT_CONFIG.windows;

  if (abs <= w.criticalPerfect) return 'CRITICAL_PERFECT';
  if (abs <= w.perfect) return 'PERFECT';
  if (abs <= w.great) return 'GREAT';
  if (abs <= w.good) return 'GOOD';
  return 'MISS';
}

/**
 * Lấy rank tương ứng từ achievement percentage
 */
export function getRankFromAchievement(achievement) {
  for (const r of JUDGEMENT_CONFIG.ranks) {
    if (achievement >= r.minAcc) {
      return r.rank;
    }
  }
  return 'C';
}
