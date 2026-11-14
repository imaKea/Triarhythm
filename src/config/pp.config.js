/**
 * Cấu hình hệ thống tính Star Rating & Performance Points (PP)
 * Các hằng số tính strain, suy giảm thời gian và trọng số loại note
 */

export const PP_CONFIG = {
  dtMin: 25,                 // Giới hạn dt tối thiểu (ms)
  speedExponent: 1.3,
  
  varietyWindowMs: 1500,     // Cửa sổ xét các lane/node khác nhau (ms)
  varietyFactor: 0.15,
  
  moveFactor: 0.25,
  maxLayoutDistance: 2.0,    // Khoảng cách lớn nhất giữa hai đích trong layout
  
  // Trọng số theo loại note
  typeMult: {
    tap: 1.0,
    hold: 0.8,
    break: 1.0,
    slide: 1.2,
    typing: 0.9
  },

  decayBaseMs: 400,          // Mẫu số suy giảm thời gian
  decayRate: 0.9,            // Hệ số suy giảm 0.9^(dt / 400)
  
  chunkMs: 400,              // Độ dài mỗi đoạn tính peak strain
  peakDecayRate: 0.9,        // Hệ số suy giảm sắp xếp peak: 0.9^k
  starScale: 0.08,           // Hệ số chuẩn hóa stars

  // Công thức tính PP một lần chơi
  ppScale: 1.0,
  starsExponent: 2.4,
  accThreshold: 70,          // Ngưỡng tối thiểu bắt đầu có PP
  accRange: 30,              // 100 - 70 = 30
  accMaxFactor: 1.0105,
  accExponent: 3,

  lengthBase: 0.9,
  lengthBonusMax: 0.1,
  lengthNoteCap: 500,

  missPenaltyBase: 0.97,     // 0.97 ^ missCount

  // Tổng PP
  totalTopCount: 100,        // Tối đa 100 bài điểm cao nhất
  totalWeightDecay: 0.95     // 0.95^i
};
