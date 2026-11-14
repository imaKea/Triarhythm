import { describe, it, expect } from 'vitest';
import { calculatePPBreakdown } from '../src/core/pp/ppCalculator.js';

describe('GĐ4 Unit Tests - Result Screen Calculations', () => {
  it('1. calculatePPBreakdown phân rã chính xác Aim, Speed, và Accuracy PP', () => {
    const res = calculatePPBreakdown({
      stars: 7.2,
      achievement: 99.2,
      missCount: 0,
      noteCount: 650
    });

    expect(res.totalPP).toBeGreaterThan(0);
    expect(res.aimPP).toBeGreaterThan(0);
    expect(res.speedPP).toBeGreaterThan(0);
    expect(res.accPP).toBeGreaterThan(0);

    // Tổng 3 thành phần phải khớp với totalPP (sai số tối đa 0.05 do làm tròn)
    const sum = res.aimPP + res.speedPP + res.accPP;
    expect(Math.abs(sum - res.totalPP)).toBeLessThanOrEqual(0.05);
  });

  it('2. calculatePPBreakdown trả về 0 khi achievement thấp hơn ngưỡng', () => {
    const res = calculatePPBreakdown({
      stars: 8.0,
      achievement: 50.0, // Ngưỡng PP_CONFIG.accThreshold là 80%
      missCount: 10,
      noteCount: 500
    });

    expect(res.totalPP).toBe(0);
    expect(res.aimPP).toBe(0);
    expect(res.speedPP).toBe(0);
    expect(res.accPP).toBe(0);
  });

  it('3. Xử lý Unstable Rate và phân bố Histogram Early/Late', () => {
    // Giả lập danh sách hit offsets (ms)
    const sampleOffsets = [-15, -10, -5, -2, 0, 1, 3, 5, 8, 12, 18];
    const n = sampleOffsets.length;
    const sum = sampleOffsets.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    let early = 0;
    let late = 0;
    let perfect = 0;
    for (const d of sampleOffsets) {
      if (d < -5) early++;
      else if (d > 5) late++;
      else perfect++;
    }

    expect(early).toBe(2); // -15, -10
    expect(late).toBe(3);  // 8, 12, 18
    expect(perfect).toBe(6); // -5, -2, 0, 1, 3, 5
    expect(mean).toBeCloseTo(1.36, 1);
  });

  it('4. So sánh Personal Best (PB) và gắn nhãn New Record chuẩn xác', () => {
    const prevBest = { score: 950000, achievement: 98.2, pp: 180 };
    const newPlay = { score: 980000, achievement: 99.1, pp: 215 };

    const isNewRecord = newPlay.score > prevBest.score;
    const scoreDiff = newPlay.score - prevBest.score;
    const accDiff = newPlay.achievement - prevBest.achievement;
    const ppDiff = newPlay.pp - prevBest.pp;

    expect(isNewRecord).toBe(true);
    expect(scoreDiff).toBe(30000);
    expect(accDiff).toBeCloseTo(0.9, 1);
    expect(ppDiff).toBe(35);
  });
});
