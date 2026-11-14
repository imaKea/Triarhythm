import { describe, it, expect } from 'vitest';
import {
  calculateStars,
  calculatePP,
  calculatePPBreakdown,
  calculateTotalPP,
  getNoteTarget
} from '../src/core/pp/ppCalculator.js';
import { SAMPLE_BEATMAP } from '../src/core/beatmap/sampleChart.js';

function buildChart({ gapMs = 200, count = 40 } = {}) {
  const notes = [];
  for (let i = 0; i < count; i++) {
    notes.push({ type: 'tap', time: i * gapMs, lane: i % 9 });
  }
  return { metadata: { id: 'pp-test' }, notes };
}

describe('getNoteTarget', () => {
  it('ring/slide luôn ánh xạ về tâm, tap/hold dùng lane', () => {
    expect(getNoteTarget({ type: 'ring' })).toBe(4);
    expect(getNoteTarget({ type: 'slide', lane: 8 })).toBe(4);
    expect(getNoteTarget({ type: 'tap', lane: 6 })).toBe(6);
    expect(getNoteTarget({ type: 'hold' })).toBe(4);
  });
});

describe('calculateStars', () => {
  it('beatmap rỗng trả về 0', () => {
    expect(calculateStars({ notes: [] })).toBe(0);
    expect(calculateStars(null)).toBe(0);
  });

  it('luôn nằm trong khoảng [1, 15]', () => {
    const stars = calculateStars(buildChart());
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(stars).toBeLessThanOrEqual(15);
  });

  it('sample beatmap có star rating hợp lệ', () => {
    const stars = calculateStars(SAMPLE_BEATMAP);
    expect(stars).toBeGreaterThan(0);
    expect(stars).toBeLessThanOrEqual(15);
  });

  it('chart dày hơn cho star rating cao hơn', () => {
    const sparse = calculateStars(buildChart({ gapMs: 400, count: 30 }));
    const dense = calculateStars(buildChart({ gapMs: 100, count: 30 }));
    expect(dense).toBeGreaterThan(sparse);
  });

  it('kết quả được làm tròn 2 chữ số', () => {
    const stars = calculateStars(buildChart());
    expect(stars).toBe(Number(stars.toFixed(2)));
  });
});

describe('calculatePP', () => {
  it('không có stars hoặc achievement dưới ngưỡng => 0 PP', () => {
    expect(calculatePP({ stars: 0, achievement: 100 })).toBe(0);
    expect(calculatePP({ stars: 10, achievement: 60 })).toBe(0);
    expect(calculatePP()).toBe(0);
  });

  it('100% accuracy cho PP dương', () => {
    const pp = calculatePP({ stars: 10, achievement: 100, missCount: 0, noteCount: 500 });
    expect(pp).toBeGreaterThan(0);
  });

  it('accuracy cao hơn cho PP cao hơn', () => {
    const base = { stars: 8, missCount: 0, noteCount: 300 };
    const pp100 = calculatePP({ ...base, achievement: 100 });
    const pp95 = calculatePP({ ...base, achievement: 95 });
    const pp80 = calculatePP({ ...base, achievement: 80 });
    expect(pp100).toBeGreaterThan(pp95);
    expect(pp95).toBeGreaterThan(pp80);
  });

  it('miss bị trừ PP', () => {
    const clean = calculatePP({ stars: 8, achievement: 98, missCount: 0, noteCount: 300 });
    const missed = calculatePP({ stars: 8, achievement: 98, missCount: 10, noteCount: 300 });
    expect(missed).toBeLessThan(clean);
  });

  it('star rating cao hơn cho PP cao hơn (bậc 2.4)', () => {
    const low = calculatePP({ stars: 5, achievement: 99, missCount: 0, noteCount: 200 });
    const high = calculatePP({ stars: 10, achievement: 99, missCount: 0, noteCount: 200 });
    expect(high).toBeGreaterThan(low * 3);
  });

  it('PP được làm tròn 2 chữ số', () => {
    const pp = calculatePP({ stars: 9.87, achievement: 97.65, missCount: 2, noteCount: 640 });
    expect(pp).toBe(Number(pp.toFixed(2)));
  });

  it('calculatePPBreakdown phân rã thành aim, speed, acc với tổng xấp xỉ totalPP', () => {
    const res = calculatePPBreakdown({ stars: 8.5, achievement: 99.5, missCount: 0, noteCount: 800 });
    expect(res.totalPP).toBeGreaterThan(0);
    expect(res.aimPP).toBeGreaterThan(0);
    expect(res.speedPP).toBeGreaterThan(0);
    expect(res.accPP).toBeGreaterThan(0);
    expect(Math.abs(res.aimPP + res.speedPP + res.accPP - res.totalPP)).toBeLessThanOrEqual(0.05);
  });
});

describe('calculateTotalPP', () => {
  it('danh sách rỗng => 0', () => {
    expect(calculateTotalPP([])).toBe(0);
    expect(calculateTotalPP()).toBe(0);
  });

  it('cộng top điểm với trọng số giảm dần 0.95^i', () => {
    expect(calculateTotalPP([100, 50])).toBe(147.5);
  });

  it('sắp xếp giảm dần, nhận cả number và object', () => {
    const total = calculateTotalPP([{ pp: 50 }, 100, { pp: 0 }, { pp: -5 }]);
    expect(total).toBe(147.5);
  });

  it('chỉ lấy tối đa 100 điểm cao nhất', () => {
    const scores = new Array(150).fill(100);
    // 100 + 100*0.95 + ... + 100*0.95^99
    let expected = 0;
    for (let i = 0; i < 100; i++) expected += 100 * Math.pow(0.95, i);
    expect(calculateTotalPP(scores)).toBe(Number(expected.toFixed(2)));
  });
});
