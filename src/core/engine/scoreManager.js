/**
 * ScoreManager - Quản lý điểm, Achievement %, Combo, Rank và Unstable Rate (UR)
 * Tuân thủ chính xác công thức trọng số, Break bonus và xếp hạng trong Mục 3.6
 */

import { JUDGEMENT_CONFIG, getRankFromAchievement } from '../../config/judgement.config.js';

export class ScoreManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalNotes = 0;
    this.totalBaseWeight = 0;
    this.totalBreakCount = 0;

    this.accumulatedScore = 0;
    this.breakBonusAccumulated = 0;
    this.achievement = 0.0;

    this.combo = 0;
    this.maxCombo = 0;

    // Bộ đếm phán định
    this.counts = {
      criticalPerfect: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0
    };

    // Mảng lưu trữ sai số deltaMs để tính UR
    this.deltaList = [];
    this.ur = 0.0;

    // Cờ hoàn thành
    this.isFullCombo = true;
    this.isAllPerfect = true;
    this.isAllCritical = true;

    this.rank = 'C';
  }

  /**
   * Khởi tạo bảng trọng số dựa trên danh sách note của bài hát
   */
  initChart(notes) {
    this.reset();
    let noteCount = 0;

    for (const note of notes) {
      const scoreType = note.isBreakHold ? 'break' : note.type;
      if (note.type === 'typing' && Array.isArray(note.chars)) {
        const charWeight = JUDGEMENT_CONFIG.weights.typing || 1;
        this.totalBaseWeight += note.chars.length * charWeight;
        noteCount += note.chars.length;
      } else {
        const w = JUDGEMENT_CONFIG.weights[scoreType] || 1;
        this.totalBaseWeight += w;
        noteCount++;
      }
      if (scoreType === 'break') {
        this.totalBreakCount++;
      }
    }

    this.totalNotes = noteCount;

    if (this.totalBaseWeight === 0) {
      this.totalBaseWeight = 1;
    }
  }

  /**
   * Làm gãy chuỗi Combo khi gõ sai phím trong Typing Section mà không trừ điểm
   */
  breakCombo() {
    this.combo = 0;
    this.isFullCombo = false;
    this.isAllPerfect = false;
    this.isAllCritical = false;
  }

  /**
   * Ghi nhận một phán định
   * @param {string} judgement 'CRITICAL_PERFECT' | 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
   * @param {string} noteType 'tap' | 'hold' | 'slide' | 'break' | 'typing'
   * @param {number} deltaMs Độ lệch thời gian (hitTime - targetTime)
   */
  registerJudgement(judgement, noteType = 'tap', deltaMs = 0) {
    const baseWeight = JUDGEMENT_CONFIG.weights[noteType] || 1;
    let rate = 0;

    switch (judgement) {
      case 'CRITICAL_PERFECT':
        this.counts.criticalPerfect++;
        rate = JUDGEMENT_CONFIG.scoreRates.criticalPerfect;
        this.combo++;
        this.deltaList.push(deltaMs);
        break;

      case 'PERFECT':
        this.counts.perfect++;
        rate = JUDGEMENT_CONFIG.scoreRates.perfect;
        this.isAllCritical = false;
        this.combo++;
        this.deltaList.push(deltaMs);
        break;

      case 'GREAT':
        this.counts.great++;
        rate = JUDGEMENT_CONFIG.scoreRates.great[noteType] || 0.5;
        this.isAllCritical = false;
        this.isAllPerfect = false;
        this.combo++;
        this.deltaList.push(deltaMs);
        break;

      case 'GOOD':
        this.counts.good++;
        rate = JUDGEMENT_CONFIG.scoreRates.good;
        this.isAllCritical = false;
        this.isAllPerfect = false;
        this.combo++;
        this.deltaList.push(deltaMs);
        break;

      case 'MISS':
      default:
        this.counts.miss++;
        rate = JUDGEMENT_CONFIG.scoreRates.miss;
        this.isAllCritical = false;
        this.isAllPerfect = false;
        this.isFullCombo = false;
        this.combo = 0;
        break;
    }

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    // Tích lũy điểm cơ sở
    this.accumulatedScore += baseWeight * rate;

    // Tích lũy Break Bonus (tối đa +1.0000%)
    if (noteType === 'break' && (judgement === 'CRITICAL_PERFECT' || judgement === 'PERFECT')) {
      const singleBreakBonus = this.totalBreakCount > 0
        ? (JUDGEMENT_CONFIG.breakBonusMax / this.totalBreakCount) * (judgement === 'CRITICAL_PERFECT' ? 1.0 : 0.7)
        : 0;
      this.breakBonusAccumulated += singleBreakBonus;
    }

    // Tính toán Achievement %
    const baseAchievement = (this.accumulatedScore / this.totalBaseWeight) * 100.0;
    this.achievement = Math.min(101.0000, baseAchievement + this.breakBonusAccumulated);

    // Tính toán Unstable Rate (UR = độ lệch chuẩn * 10)
    this.calculateUR();

    // Xác định Rank
    this.rank = getRankFromAchievement(this.achievement);

    return {
      judgement,
      combo: this.combo,
      achievement: this.achievement,
      rank: this.rank,
      ur: this.ur
    };
  }

  /**
   * Tính toán độ lệch chuẩn của các lần gõ (Unstable Rate)
   */
  calculateUR() {
    if (this.deltaList.length < 2) {
      this.ur = 0.0;
      return;
    }

    const n = this.deltaList.length;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += this.deltaList[i];
    }
    const mean = sum / n;

    let varianceSum = 0;
    for (let i = 0; i < n; i++) {
      varianceSum += Math.pow(this.deltaList[i] - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / n);
    this.ur = stdDev * 10.0;
  }

  getRankColor() {
    const rankObj = JUDGEMENT_CONFIG.ranks.find(r => r.rank === this.rank);
    return rankObj ? rankObj.color : '#ffea00';
  }

  /**
   * Điểm số arcade (0 - 1.010.000), suy ra trực tiếp từ Achievement %.
   * 100.0000% -> 1.000.000 điểm; 101.0000% (tối đa nhờ Break Bonus) -> 1.010.000 điểm.
   */
  getScoreValue() {
    return Math.round(this.achievement * 10000);
  }

  getSummary() {
    return {
      score: this.getScoreValue(),
      achievement: Number(this.achievement.toFixed(4)),
      rank: this.rank,
      maxCombo: this.maxCombo,
      ur: Number(this.ur.toFixed(1)),
      counts: { ...this.counts },
      hitOffsets: [...this.deltaList],
      flags: {
        isAP: this.isAllPerfect && this.counts.miss === 0,
        isFC: this.isFullCombo && this.counts.miss === 0
      }
    };
  }
}
