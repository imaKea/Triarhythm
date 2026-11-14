import { describe, it, expect } from 'vitest';
import { validateBeatmap } from '../src/core/beatmap/validator.js';
import { SAMPLE_BEATMAP } from '../src/core/beatmap/sampleChart.js';

describe('Beatmap Validator Unit Tests', () => {
  it('Sample Beatmap phải hoàn toàn hợp lệ (valid = true, errors = [])', () => {
    const res = validateBeatmap(SAMPLE_BEATMAP);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('Báo lỗi khi version không phải là 2', () => {
    const chart = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    chart.version = 1;
    const res = validateBeatmap(chart);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('Báo lỗi khi lane nằm ngoài [0, 8]', () => {
    const chart = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    chart.notes.push({ type: 'tap', time: 12000, lane: 9 });
    const res = validateBeatmap(chart);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('lane (9)'))).toBe(true);
  });

  it('Báo lỗi khi slide có node ngoài [0, 2] hoặc 2 node liền kề trùng nhau', () => {
    const chart = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    // Hai node liền kề trùng nhau [0, 0, 1]
    chart.notes.push({
      type: 'slide',
      time: 12000,
      path: [0, 0, 1]
    });
    const res = validateBeatmap(chart);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('liền kề trong path không được trùng nhau'))).toBe(true);

    // Node ngoài [0, 2]
    const chart2 = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    chart2.notes.push({
      type: 'slide',
      time: 12000,
      path: [0, 3]
    });
    const res2 = validateBeatmap(chart2);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some(e => e.includes('nằm trong [0, 2]'))).toBe(true);
  });

  it('Báo lỗi khi thời gian note bị giảm dần', () => {
    const chart = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    chart.notes.push({ type: 'tap', time: 500, lane: 0 }); // Nhỏ hơn note đầu tiên (1000)
    const res = validateBeatmap(chart);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('Thứ tự thời gian bị giảm'))).toBe(true);
  });

  it('Báo lỗi khi hold endTime <= time', () => {
    const chart = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    chart.notes.push({ type: 'hold', time: 12000, endTime: 12000, lane: 0 });
    const res = validateBeatmap(chart);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('endTime (12000) phải lớn hơn time'))).toBe(true);
  });

  it('Báo lỗi khi có note khác nằm trong vùng cấm [time - 300, endTime + 300] của Typing', () => {
    const chart = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    // Typing trong sample: [8000, 9500] -> vùng cấm [7700, 9800]
    // Chèn note tap tại 7900
    chart.notes.splice(9, 0, { type: 'tap', time: 7900, lane: 1 });
    const res = validateBeatmap(chart);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('Typing section') && e.includes('bị chồng'))).toBe(true);
  });

  it('Phát cảnh báo (warning) khi hai Slide chồng chéo khoảng điều khiển', () => {
    const chart = JSON.parse(JSON.stringify(SAMPLE_BEATMAP));
    // Thêm 2 slide chồng chéo khoảng thời gian
    chart.notes.push({
      type: 'slide',
      time: 5500,
      path: [0, 1],
      waitBeats: 1.0,
      beatsPerSegment: 2.0
    });
    chart.notes.push({
      type: 'slide',
      time: 5700,
      path: [1, 2],
      waitBeats: 1.0,
      beatsPerSegment: 2.0
    });
    const res = validateBeatmap(chart);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings.some(w => w.includes('Hai Slide chồng khoảng thời gian'))).toBe(true);
  });
});
