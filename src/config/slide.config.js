/**
 * Cấu hình cơ chế Slide (chuột)
 * Các hằng số thời gian, clamp, ngưỡng phán định
 */

export const SLIDE_CONFIG = {
  // Ràng buộc beats
  waitBeats: {
    default: 1.0,
    min: 0.5,
    max: 4.0
  },
  beatsPerSegment: {
    default: 2.0,
    min: 0.5,
    max: 8.0
  },

  // Giới hạn thời gian (ms)
  waitMs: {
    min: 250,
    max: 1000
  },
  segMs: {
    min: 350,
    max: 1500
  },

  // Hình học đường trượt
  slideInset: 0.12,          // Độ dịch vào trong tâm của polyline [A, A', B', B]
  baseFollowRadius: 0.40,    // Bán kính theo dõi con trỏ chuột (mở rộng hitbox để chuột không bị trôi)
  followRadiusScale: {
    default: 1.0,
    min: 0.5,
    max: 2.0
  },

  // Hiệu ứng hiển thị
  pathRevealDurationMs: 150, // Thời gian quét hiện đường đi
  endNodeHoldDurationMs: 150,// Thời gian sao dừng ở node cuối trước khi mờ
  
  // Cửa sổ kiểm tra đến đích
  reachedEndWindow: {
    beforeEndMs: 100, // glideEnd - 100ms
    afterEndMs: 150   // glideEnd + 150ms
  },

  // Ngưỡng phán định tỉ lệ onTrack ratio
  thresholds: {
    criticalPerfect: 0.92,
    perfect: 0.80,
    great: 0.65,
    good: 0.45
  },

  // Cảnh báo chồng chéo hai slide trong editor/validator
  overlapBufferMs: 200 // [time - 200, glideEnd + 200]
};

/**
 * Tính toán các mốc thời gian của một Slide dựa theo timing point
 * @param {Object} slide - Dữ liệu slide { time, path, waitBeats, beatsPerSegment }
 * @param {number} beatLength - beatLength của timing point gốc tại slide.time
 */
export function calculateSlideTiming(slide, beatLength) {
  const waitBeats = slide.waitBeats ?? SLIDE_CONFIG.waitBeats.default;
  const beatsPerSegment = slide.beatsPerSegment ?? SLIDE_CONFIG.beatsPerSegment.default;

  const rawWaitMs = waitBeats * beatLength;
  const waitMs = Math.min(Math.max(rawWaitMs, SLIDE_CONFIG.waitMs.min), SLIDE_CONFIG.waitMs.max);

  const rawSegMs = beatsPerSegment * beatLength;
  const segMs = Math.min(Math.max(rawSegMs, SLIDE_CONFIG.segMs.min), SLIDE_CONFIG.segMs.max);

  const numSegments = Math.max(1, (slide.path?.length || 2) - 1);
  const glideStart = slide.time + waitMs;
  const glideMs = segMs * numSegments;
  const glideEnd = glideStart + glideMs;

  return {
    waitMs,
    segMs,
    numSegments,
    glideStart,
    glideMs,
    glideEnd,
    totalDuration: waitMs + glideMs + SLIDE_CONFIG.endNodeHoldDurationMs
  };
}
