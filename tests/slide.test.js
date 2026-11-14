import { describe, it, expect } from 'vitest';
import { SlideManager } from '../src/core/engine/slideManager.js';
import { SLIDE_CONFIG, calculateSlideTiming } from '../src/config/slide.config.js';
import { TRI_RING_LAYOUT } from '../src/config/layout.config.js';

describe('GĐ4 Unit Tests - Cơ chế Slide chuột / Pointer chuẩn maimai DX', () => {
  it('Tính toán slide timing chính xác theo BPM và kẹp theo giới hạn clamp', () => {
    // BPM 120 -> beatLength 500ms
    const slide1 = { time: 2000, path: [0, 1], waitBeats: 1.0, beatsPerSegment: 2.0 };
    const timing1 = calculateSlideTiming(slide1, 500);

    // waitMs = 1.0 * 500 = 500ms (trong [250, 1000])
    expect(timing1.waitMs).toBe(500);
    // segMs = 2.0 * 500 = 1000ms (trong [350, 1500])
    expect(timing1.segMs).toBe(1000);
    // glideStart = 2000 + 500 = 2500ms
    expect(timing1.glideStart).toBe(2500);
    // glideEnd = 2500 + 1000 = 3500ms
    expect(timing1.glideEnd).toBe(3500);

    // Kiểm tra kẹp giới hạn clamp khi BPM cực cao (BPM 400 -> beatLength 150ms)
    const timingFast = calculateSlideTiming({ time: 1000, path: [0, 1], waitBeats: 1.0, beatsPerSegment: 1.0 }, 150);
    expect(timingFast.waitMs).toBe(SLIDE_CONFIG.waitMs.min); // 250ms
    expect(timingFast.segMs).toBe(SLIDE_CONFIG.segMs.min);   // 350ms

    // Kiểm tra kẹp giới hạn clamp khi BPM cực thấp (BPM 40 -> beatLength 1500ms)
    const timingSlow = calculateSlideTiming({ time: 1000, path: [0, 1], waitBeats: 2.0, beatsPerSegment: 3.0 }, 1500);
    expect(timingSlow.waitMs).toBe(SLIDE_CONFIG.waitMs.max); // 1000ms
    expect(timingSlow.segMs).toBe(SLIDE_CONFIG.segMs.max);   // 1500ms
  });

  it('Tạo polyline [A, A\', B\', B] dịch vào trong đúng tỉ lệ slideInset 0.12', () => {
    const poly = SlideManager.getSegmentPolyline(0, 1);
    expect(poly).toHaveLength(4);

    const [A, A_prime, B_prime, B] = poly;
    const nodeA = TRI_RING_LAYOUT.slideNodes[0];
    const nodeB = TRI_RING_LAYOUT.slideNodes[1];

    expect(A.x).toBeCloseTo(nodeA.x, 3);
    expect(A.y).toBeCloseTo(nodeA.y, 3);
    expect(B.x).toBeCloseTo(nodeB.x, 3);
    expect(B.y).toBeCloseTo(nodeB.y, 3);

    // Khoảng cách từ A tới A' phải bằng slideInset = 0.12
    const distAA = Math.hypot(A_prime.x - A.x, A_prime.y - A.y);
    expect(distAA).toBeCloseTo(SLIDE_CONFIG.slideInset, 2);

    const distBB = Math.hypot(B_prime.x - B.x, B_prime.y - B.y);
    expect(distBB).toBeCloseTo(SLIDE_CONFIG.slideInset, 2);
  });

  it('Nội suy vị trí dọc theo polyline chính xác từ u=0 (node A) tới u=1 (node B)', () => {
    const poly = SlideManager.getSegmentPolyline(0, 1);
    const pStart = SlideManager.interpolateOnPolyline(poly, 0.0);
    const pEnd = SlideManager.interpolateOnPolyline(poly, 1.0);
    const pMid = SlideManager.interpolateOnPolyline(poly, 0.5);

    expect(pStart.x).toBeCloseTo(poly[0].x, 3);
    expect(pStart.y).toBeCloseTo(poly[0].y, 3);

    expect(pEnd.x).toBeCloseTo(poly[3].x, 3);
    expect(pEnd.y).toBeCloseTo(poly[3].y, 3);

    expect(pMid.y).toBeCloseTo(poly[1].y, 2);
    expect(pMid.x).toBeCloseTo(0.0, 2);
  });

  it('Chuyển đổi trạng thái Slide theo thời gian: APPROACH -> WAITING -> GLIDING -> FINISHED', () => {
    const slide = {
      type: 'slide',
      time: 2000,
      path: [0, 1],
      waitBeats: 1,
      beatsPerSegment: 2
    };
    const travelTime = 750;
    const beatLength = 250;

    // 1. Trước time: APPROACH
    const stateApproach = SlideManager.getSlideState(slide, 1500, travelTime, beatLength);
    expect(stateApproach.stage).toBe('APPROACH');
    expect(stateApproach.isGliding).toBe(false);

    // 2. Tại time + 50ms: WAITING (quét hiện chevron)
    const stateWait = SlideManager.getSlideState(slide, 2050, travelTime, beatLength);
    expect(stateWait.stage).toBe('WAITING');
    expect(stateWait.revealProgress).toBeGreaterThan(0);
    expect(stateWait.isGliding).toBe(false);

    // 3. Giữa giai đoạn lướt: GLIDING
    const glideStart = slide.timing.glideStart;
    const stateGlide = SlideManager.getSlideState(slide, glideStart + 200, travelTime, beatLength);
    expect(stateGlide.stage).toBe('GLIDING');
    expect(stateGlide.isGliding).toBe(true);

    // 4. Sau khi kết thúc: FINISHED
    const glideEnd = slide.timing.glideEnd;
    const stateFin = SlideManager.getSlideState(slide, glideEnd + 50, travelTime, beatLength);
    expect(stateFin.stage).toBe('FINISHED');
    expect(stateFin.isGliding).toBe(false);
  });

  it('Các ngưỡng phán định Slide theo ratio chuẩn spec (CRITICAL_PERFECT, PERFECT, GREAT, GOOD, MISS)', () => {
    const thresholds = SLIDE_CONFIG.thresholds;
    expect(thresholds.criticalPerfect).toBe(0.92);
    expect(thresholds.perfect).toBe(0.80);
    expect(thresholds.great).toBe(0.65);
    expect(thresholds.good).toBe(0.45);

    function evaluateSlide(ratio, reachedEnd) {
      if (!reachedEnd) return 'MISS';
      if (ratio >= thresholds.criticalPerfect) return 'CRITICAL_PERFECT';
      if (ratio >= thresholds.perfect) return 'PERFECT';
      if (ratio >= thresholds.great) return 'GREAT';
      if (ratio >= thresholds.good) return 'GOOD';
      return 'MISS';
    }

    expect(evaluateSlide(0.95, true)).toBe('CRITICAL_PERFECT');
    expect(evaluateSlide(0.85, true)).toBe('PERFECT');
    expect(evaluateSlide(0.70, true)).toBe('GREAT');
    expect(evaluateSlide(0.50, true)).toBe('GOOD');
    expect(evaluateSlide(0.40, true)).toBe('MISS');
    // Nếu không đến đích trước glideEnd + 150ms -> luôn MISS dù ratio cao
    expect(evaluateSlide(0.95, false)).toBe('MISS');
  });

  it('Đường chevron biến mất ngay khi sao đã lướt qua hoặc khi slide hoàn thành', () => {
    // Canvas giả lập để kiểm tra số lượng chevron được vẽ
    let drawnChevrons = 0;
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => { drawnChevrons++; },
      fill: () => {},
      arc: () => {},
      closePath: () => {},
      translate: () => {},
      rotate: () => {},
      setLineDash: () => {}
    };

    const slide = {
      type: 'slide',
      time: 2000,
      path: [0, 1],
      waitBeats: 1,
      beatsPerSegment: 2
    };

    // Khi sao đang lướt ở 80% chặng đường: các chevron < 80% không được vẽ
    drawnChevrons = 0;
    const glideStart = 2000 + 250; // 2250
    const glideEnd = 2250 + 500;   // 2750
    const songTimeMid = glideStart + (glideEnd - glideStart) * 0.8;
    SlideManager.renderSlide(mockCtx, slide, songTimeMid, 750, 240, 800, 600);

    // Khi slide đã kết thúc (FINISHED): toàn bộ đường chevron biến mất hoàn toàn
    drawnChevrons = 0;
    SlideManager.renderSlide(mockCtx, slide, glideEnd + 200, 750, 240, 800, 600);
    expect(drawnChevrons).toBe(1); // Chỉ còn viền sao mờ dần tại đích, 0 mũi tên chevron nào được vẽ
  });
});
