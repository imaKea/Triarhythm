/**
 * Hệ thống Star Rating & Performance Points (PP)
 * Dựa trên các hằng số trong src/config/pp.config.js.
 *
 * Star Rating: mô phỏng strain tích lũy theo thời gian, có yếu tố tốc độ,
 * khoảng cách di chuyển giữa các lane, độ đa dạng lane và trọng số loại note.
 *
 * PP: stars^2.4 * accuracy factor * length bonus * miss penalty.
 * Tổng PP của người chơi: cộng top 100 điểm với trọng số giảm dần 0.95^i.
 */

import { PP_CONFIG } from '../../config/pp.config.js';

const RING_TARGET = 4; // Ring note quy ước nằm giữa layout

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Lane/node đích của một note, dùng để tính khoảng cách di chuyển.
 */
export function getNoteTarget(note) {
  if (!note) return RING_TARGET;
  if (note.type === 'ring' || note.type === 'slide') return RING_TARGET;
  return typeof note.lane === 'number' ? note.lane : RING_TARGET;
}

function sortByTime(notes) {
  return [...(notes || [])].sort((a, b) => (a.time || 0) - (b.time || 0));
}

/**
 * Tính Star Rating (1.0 - 15.0) cho beatmap.
 * @param {Object} beatmap
 * @returns {number}
 */
export function calculateStars(beatmap) {
  const notes = sortByTime(beatmap?.notes);
  if (notes.length === 0) return 0;

  const typeMult = PP_CONFIG.typeMult;
  const windowMs = PP_CONFIG.varietyWindowMs;

  let strain = 0;
  let prevTime = notes[0].time || 0;
  let prevTarget = getNoteTarget(notes[0]);
  let chunkElapsed = 0;
  let chunkPeak = 0;
  const peaks = [];

  const flushChunk = () => {
    if (chunkPeak > 0) peaks.push(chunkPeak);
    chunkPeak = 0;
    chunkElapsed = 0;
  };

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const weight = typeMult[note.type] || 1;

    if (i > 0) {
      const dt = Math.max(PP_CONFIG.dtMin, (note.time || 0) - prevTime);
      const target = getNoteTarget(note);

      // Tốc độ: note càng dày (dt nhỏ) strain càng cao
      const speed = 1 + Math.pow(PP_CONFIG.dtMin / dt, PP_CONFIG.speedExponent);

      // Khoảng cách di chuyển giữa 2 đích liên tiếp
      const distance = clamp(Math.abs(target - prevTarget), 0, PP_CONFIG.maxLayoutDistance);
      const move = 1 + PP_CONFIG.moveFactor * distance;

      // Đa dạng lane trong cửa sổ thời gian gần nhất
      const distinct = new Set();
      for (let j = i - 1; j >= 0; j--) {
        if ((note.time || 0) - (notes[j].time || 0) > windowMs) break;
        distinct.add(getNoteTarget(notes[j]));
      }
      const variety = 1 + PP_CONFIG.varietyFactor * Math.max(0, distinct.size - 1);

      const noteStrain = speed * move * variety * weight;
      const decay = Math.pow(PP_CONFIG.decayRate, dt / PP_CONFIG.decayBaseMs);
      strain = strain * decay + noteStrain;

      chunkElapsed += dt;
      chunkPeak = Math.max(chunkPeak, strain);

      if (chunkElapsed >= PP_CONFIG.chunkMs) flushChunk();
    } else {
      chunkPeak = weight;
    }

    prevTime = note.time || 0;
    prevTarget = getNoteTarget(note);
  }
  flushChunk();

  // Tổng peak có trọng số giảm dần theo thứ tự peak lớn nhất
  const sortedPeaks = peaks.sort((a, b) => b - a);
  let peakSum = 0;
  for (let i = 0; i < sortedPeaks.length; i++) {
    peakSum += sortedPeaks[i] * Math.pow(PP_CONFIG.peakDecayRate, i);
  }

  const densityFactor = 1 + Math.min(1, notes.length / PP_CONFIG.lengthNoteCap);
  const stars = 1 + PP_CONFIG.starScale * peakSum * densityFactor;

  return Number(clamp(stars, 1, 15).toFixed(2));
}

/**
 * Tính PP cho một lần chơi.
 * @param {Object} params
 * @param {number} params.stars Star Rating của beatmap
 * @param {number} params.achievement Achievement % (0 - 101)
 * @param {number} [params.missCount=0]
 * @param {number} [params.noteCount=0]
 * @returns {number} PP (đã làm tròn 2 chữ số)
 */
export function calculatePP({ stars = 0, achievement = 0, missCount = 0, noteCount = 0 } = {}) {
  if (!Number.isFinite(stars) || stars <= 0) return 0;
  if (!Number.isFinite(achievement) || achievement < PP_CONFIG.accThreshold) return 0;

  const accRatio = clamp(
    ((achievement - PP_CONFIG.accThreshold) / PP_CONFIG.accRange) * PP_CONFIG.accMaxFactor,
    0,
    1.2
  );
  const accFactor = Math.pow(accRatio, PP_CONFIG.accExponent);
  const lengthBonus = PP_CONFIG.lengthBase +
    Math.min(PP_CONFIG.lengthBonusMax, (noteCount / PP_CONFIG.lengthNoteCap) * PP_CONFIG.lengthBonusMax);
  const missPenalty = Math.pow(PP_CONFIG.missPenaltyBase, Math.max(0, missCount));

  const base = Math.pow(stars, PP_CONFIG.starsExponent) * PP_CONFIG.ppScale;
  const pp = base * accFactor * lengthBonus * missPenalty;

  return Number(Math.max(0, pp).toFixed(2));
}

/**
 * Phân rã PP thành 3 thành phần Aim PP, Speed PP, Acc PP chuẩn osu!
 * @returns {{ totalPP: number, aimPP: number, speedPP: number, accPP: number }}
 */
export function calculatePPBreakdown({ stars = 0, achievement = 0, missCount = 0, noteCount = 0 } = {}) {
  const totalPP = calculatePP({ stars, achievement, missCount, noteCount });
  if (totalPP <= 0) {
    return { totalPP: 0, aimPP: 0, speedPP: 0, accPP: 0 };
  }
  const accMod = Math.min(1.2, Math.max(0.6, achievement / 100));
  const aimRatio = 0.44;
  const speedRatio = 0.36;
  const accRatio = 0.20 * accMod;
  const sum = aimRatio + speedRatio + accRatio;
  const aimPP = Number(((totalPP * aimRatio) / sum).toFixed(2));
  const speedPP = Number(((totalPP * speedRatio) / sum).toFixed(2));
  const accPP = Number(Math.max(0, totalPP - aimPP - speedPP).toFixed(2));
  return { totalPP, aimPP, speedPP, accPP };
}

/**
 * Tổng PP từ danh sách điểm (mỗi phần tử có field `pp`).
 * Lấy tối đa totalTopCount bài, nhân trọng số totalWeightDecay^i.
 */
export function calculateTotalPP(scores = []) {
  const sorted = [...scores]
    .map((s) => (typeof s === 'number' ? s : Number(s?.pp) || 0))
    .filter((pp) => pp > 0)
    .sort((a, b) => b - a)
    .slice(0, PP_CONFIG.totalTopCount);

  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i] * Math.pow(PP_CONFIG.totalWeightDecay, i);
  }
  return Number(total.toFixed(2));
}
