/**
 * Chuyển đổi và gán lane cho note từ Mode 3 (mania) hoặc Mode 0 (standard) sang bố cục triRing9
 * Thuật toán phân bổ theo perimeter order, nhóm cột, chống lặp phím và tràn lane
 */

import { TRI_RING_LAYOUT } from '../../config/layout.config.js';
import { calculateSlideTiming } from '../../config/slide.config.js';

export const PERIMETER_ORDER = TRI_RING_LAYOUT.perimeterOrder; // [5, 4, 3, 0, 1, 2, 6, 7, 8]

/**
 * Tính các nhóm lane trên vòng perimeter theo số phím (keys)
 * Hỗ trợ chế độ đặc biệt cho 5K và 7K (chuyển spacebar thành ring, phân bố tối ưu)
 */
export function getColumnGroups(keys = 5, isSpecialOsu = false) {
  if (isSpecialOsu) {
    if (keys === 5) {
      return [
        [5, 4],       // Col 0: Phím chữ bên trái (V, F)
        [4, 3],       // Col 1: Phím chữ bên trái (F, R)
        [],           // Col 2: Spacebar -> nốt Ring
        [6, 7],       // Col 3: Phím chữ bên phải (I, J)
        [7, 8]        // Col 4: Phím chữ bên phải (J, N)
      ];
    }
    if (keys === 7) {
      return [
        [5, 4],       // Col 0: Phím chữ trái dưới/giữa (V, F)
        [4, 3],       // Col 1: Phím chữ trái giữa/trên (F, R)
        [3, 0, 1],    // Col 2: Phím chữ trái trên + hàng số trên trái/giữa (R, 4·5, 6·7)
        [],           // Col 3: Hàng số 4 (Spacebar) -> nốt Ring
        [1, 2, 6],    // Col 4: Hàng số trên giữa/phải + phím chữ phải trên (6·7, 8·9, I)
        [6, 7],       // Col 5: Phím chữ phải trên/giữa (I, J)
        [7, 8]        // Col 6: Phím chữ phải giữa/dưới (J, N)
      ];
    }
  }

  const groups = [];
  for (let c = 0; c < keys; c++) {
    const start = Math.round((c * 9) / keys);
    const end = Math.round(((c + 1) * 9) / keys);
    groups.push(PERIMETER_ORDER.slice(start, end));
  }
  return groups;
}

/**
 * Danh sách lane tràn ưu tiên theo thứ tự cho từng cột
 */
export function getOverflowOrder(col, keys, isSpecialOsu = false) {
  if (isSpecialOsu && keys === 5) {
    // 5K: Phân bố nốt hàng số ở trên ít hơn
    // Ưu tiên phím chữ (5, 4, 3, 6, 7, 8), hàng số (0, 1, 2) chỉ làm dự phòng cuối cùng
    return col <= 1
      ? [5, 4, 3, 6, 7, 8, 0, 1, 2]
      : [8, 7, 6, 3, 4, 5, 2, 1, 0];
  }

  if (isSpecialOsu && keys === 7) {
    // 7K: Phân bố đều cả 9 nút
    switch (col) {
      case 0: return [5, 4, 3, 0, 8, 7, 1, 6, 2];
      case 1: return [4, 3, 5, 0, 1, 8, 7, 2, 6];
      case 2: return [3, 0, 1, 4, 2, 5, 6, 7, 8];
      case 4: return [1, 2, 6, 0, 7, 3, 8, 4, 5];
      case 5: return [6, 7, 2, 8, 1, 0, 3, 4, 5];
      case 6: return [8, 7, 6, 2, 1, 5, 0, 4, 3];
      default: return PERIMETER_ORDER;
    }
  }

  // Mặc định: Sắp xếp theo khoảng cách trên vòng perimeter
  const colCenterPerimIdx = Math.round(((col + 0.5) * 9) / keys);
  return [...PERIMETER_ORDER].sort((a, b) => {
    const distA = Math.abs(PERIMETER_ORDER.indexOf(a) - colCenterPerimIdx);
    const distB = Math.abs(PERIMETER_ORDER.indexOf(b) - colCenterPerimIdx);
    return distA - distB;
  });
}

/**
 * Ánh xạ danh sách note đã làm gọn sang các lane của triRing9
 * @param {Array<Object>} notes Danh sách note đã qua reduceDensity
 * @param {number} mode Chế độ osu (3 = mania, 0 = standard)
 * @param {number} keys Số phím nếu là Mode 3
 * @param {Object} options Tùy chọn bổ sung (sameLaneMinGapMs, autoSlide...)
 * @param {Array<Object>} timingPoints Danh sách timing points gốc
 */
export function mapNotesToLanes(notes, mode = 3, keys = 5, options = {}, timingPoints = []) {
  const sameLaneMinGap = options.sameLaneMinGapMs ?? 150;
  // Tự động kích hoạt quy luật 5K/7K nếu là chart osu!mania 5K hoặc 7K; các keymode khác tự động import theo cách cũ
  const isSpecialImport = options.osuSpecialMapping === false
    ? false
    : Boolean(options.osuSpecialMapping || options.osu5KMapping || (mode === 3 && (keys === 5 || keys === 7)));
  const groups = mode === 3 ? getColumnGroups(keys, isSpecialImport) : [];

  // Mảng lưu vết thời gian của 9 lane
  const lastUsedTime = new Array(9).fill(-Infinity);
  const lockedUntil = new Array(9).fill(-Infinity);

  const mappedNotes = [];
  let droppedCount = 0;

  for (let i = 0; i < notes.length; i++) {
    const rawNote = notes[i];
    let chosenLane = -1;

    // 0. Nếu note vốn đã là Ring Note (từ densityReducer / nhịp dài bài hát / maimai):
    if (rawNote.type === 'ring') {
      if (!mappedNotes.some((n) => n.type === 'ring' && Math.abs(n.time - rawNote.time) < 10)) {
        const isHold = Boolean(rawNote.isHold && rawNote.endTime && rawNote.endTime > rawNote.time);
        mappedNotes.push({
          type: 'ring',
          isHold,
          time: rawNote.time,
          endTime: isHold ? rawNote.endTime : undefined
        });
      }
      continue;
    }

    if (mode === 3) {
      // --- MODE 3 (MANIA) ---
      const col = Math.max(0, Math.min(keys - 1, rawNote.col ?? Math.floor((rawNote.x * keys) / 512)));

      // Yêu cầu: Nếu là import osu đặc biệt (5K/7K):
      // - Với 5K: Cột 2 (Spacebar) đổi thành nốt Ring (kèm Hold nếu là Long Note)
      // - Với 7K: Cột 3 (Hàng số 4 - Spacebar) đổi thành nốt Ring (kèm Hold nếu là Long Note)
      const isSpacebarCol = isSpecialImport && ((keys === 5 && col === 2) || (keys === 7 && col === 3));
      if (isSpacebarCol) {
        if (!mappedNotes.some((n) => n.type === 'ring' && Math.abs(n.time - rawNote.time) < 10)) {
          const isHold = Boolean(rawNote.isHold && rawNote.endTime && rawNote.endTime > rawNote.time);
          mappedNotes.push({
            type: 'ring',
            isHold,
            time: rawNote.time,
            endTime: isHold ? rawNote.endTime : undefined
          });
        }
        continue;
      }

      const groupLanes = groups[col] || [];

      // Bước 1: Ưu tiên lane trong nhóm của cột này
      // Điều kiện lý tưởng: lane rảnh (lockedUntil <= time) và cách lần bấm trước >= sameLaneMinGap
      let bestLane = -1;
      let oldestTime = Infinity;

      for (const lane of groupLanes) {
        if (lockedUntil[lane] <= rawNote.time && rawNote.time - lastUsedTime[lane] >= sameLaneMinGap) {
          if (lastUsedTime[lane] < oldestTime) {
            oldestTime = lastUsedTime[lane];
            bestLane = lane;
          }
        }
      }

      // Nếu không có lane nào đạt sameLaneMinGap, thử lane rảnh miễn là lastUsedTime < time (không bấm cùng ms)
      if (bestLane === -1) {
        for (const lane of groupLanes) {
          if (lockedUntil[lane] <= rawNote.time && lastUsedTime[lane] < rawNote.time) {
            if (lastUsedTime[lane] < oldestTime) {
              oldestTime = lastUsedTime[lane];
              bestLane = lane;
            }
          }
        }
      }

      // Bước 2: Tràn sang các lane ưu tiên nếu cả nhóm đều bận
      if (bestLane === -1) {
        const overflowCandidates = getOverflowOrder(col, keys, isSpecialImport);

        // Thử vòng 1: kèm sameLaneMinGap
        for (const lane of overflowCandidates) {
          if (lockedUntil[lane] <= rawNote.time && rawNote.time - lastUsedTime[lane] >= sameLaneMinGap) {
            bestLane = lane;
            break;
          }
        }

        // Thử vòng 2: chỉ cần rảnh tại thời điểm time
        if (bestLane === -1) {
          for (const lane of overflowCandidates) {
            if (lockedUntil[lane] <= rawNote.time && lastUsedTime[lane] < rawNote.time) {
              bestLane = lane;
              break;
            }
          }
        }
      }

      chosenLane = bestLane;
    } else {
      // --- MODE 0 (STANDARD) ---
      // Tọa độ chuẩn hóa osu! (512x384) sang layout [-1, 1] x [-0.577, 1.155]
      const px = (rawNote.x / 512) * 2.0 - 1.0;
      const py = -0.577 + (rawNote.y / 384) * 1.732;

      let nearestLane = -1;
      let shortestDist = Infinity;

      for (const tap of TRI_RING_LAYOUT.tapLanes) {
        if (lockedUntil[tap.lane] <= rawNote.time && lastUsedTime[tap.lane] < rawNote.time) {
          const d = Math.hypot(px - tap.x, py - tap.y);
          if (d < shortestDist) {
            shortestDist = d;
            nearestLane = tap.lane;
          }
        }
      }
      chosenLane = nearestLane;
    }

    if (chosenLane !== -1) {
      lastUsedTime[chosenLane] = rawNote.time;
      if (rawNote.type === 'hold' && rawNote.endTime) {
        lockedUntil[chosenLane] = rawNote.endTime;
      }

      const cleanNote = {
        type: rawNote.type,
        time: rawNote.time,
        lane: chosenLane
      };
      if (rawNote.type === 'hold') {
        cleanNote.endTime = rawNote.endTime;
      }
      mappedNotes.push(cleanNote);
    } else {
      droppedCount++;
    }
  }

  // --- AUTO SLIDE (Chỉ khi tùy chọn autoSlide được bật rõ ràng) ---
  if (options.autoSlide && timingPoints && timingPoints.length > 0) {
    insertAutoSlides(mappedNotes, timingPoints, options.everyBeats || 16);
  }

  // Sắp xếp lại danh sách note theo time
  mappedNotes.sort((a, b) => a.time - b.time);

  return {
    notes: mappedNotes,
    droppedCount,
    totalMapped: mappedNotes.length
  };
}

/**
 * Chèn các Slide thử nghiệm theo chu kỳ everyBeats (chỉ khi có tùy chọn autoSlide = true)
 */
function insertAutoSlides(notes, timingPoints, everyBeats = 16) {
  if (notes.length === 0) return;
  const startTime = notes[0].time;
  const endTime = notes[notes.length - 1].time;

  const paths = [
    [0, 1],
    [1, 2],
    [2, 0]
  ];
  let pathIdx = 0;

  for (const tp of timingPoints) {
    if (!tp.uninherited) continue;
    const intervalMs = tp.beatLength * everyBeats;
    let t = Math.max(startTime + intervalMs, tp.time + intervalMs);

    while (t < endTime - 2000) {
      const slideTime = Math.round(t);
      const chosenPath = paths[pathIdx % paths.length];

      const timing = calculateSlideTiming(
        { time: slideTime, path: chosenPath, waitBeats: 1, beatsPerSegment: 2 },
        tp.beatLength
      );

      const hasConflict = notes.some(n => {
        if (n.type === 'slide') {
          return Math.abs(n.time - slideTime) < 1500;
        }
        if (n.type === 'typing') {
          return slideTime >= n.time - 300 && slideTime <= n.endTime + 300;
        }
        return false;
      });

      if (!hasConflict) {
        notes.push({
          type: 'slide',
          time: slideTime,
          path: chosenPath,
          waitBeats: 1,
          beatsPerSegment: 2
        });
        pathIdx++;
      }

      t += intervalMs;
    }
  }
}
