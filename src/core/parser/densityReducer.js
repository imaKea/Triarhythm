/**
 * Mô-đun làm gọn mật độ note (Density Reducer)
 * Hỗ trợ các preset: "2 Ngón" (chuẩn 2 ngón, tối đa 2 nốt), "Vừa", "Dễ", "Giữ nguyên"
 */

import { getActiveTimingPoint, isSnapWithinLimit } from './timingGrid.js';

export const DENSITY_PRESETS = {
  twoFingers: {
    name: '2 Ngón (Chuẩn)',
    minGapMs: 0, // Nhập tối đa theo snap 1/8 của bài hát (không chặn nhầm nốt 1/8 hợp lệ)
    maxChord: 2,
    minHoldMs: 250,
    sameLaneMinGapMs: 150,
    twoFingerMode: true
  },
  medium: {
    name: 'Vừa',
    minGapMs: 100,
    maxChord: 3,
    minHoldMs: 250,
    sameLaneMinGapMs: 150,
    twoFingerMode: false
  },
  easy: {
    name: 'Dễ (Thư giãn)',
    minGapMs: 250,
    maxChord: 2,
    minHoldMs: 250,
    sameLaneMinGapMs: 200,
    twoFingerMode: true
  },
  original: {
    name: 'Giữ nguyên',
    minGapMs: 0,
    maxChord: 9,
    minHoldMs: 250,
    sameLaneMinGapMs: 0,
    twoFingerMode: false
  }
};

/**
 * Làm gọn mật độ danh sách nốt thô
 * @param {Array<Object>} rawObjects Danh sách note thô từ parser
 * @param {Object} options Cấu hình làm gọn mật độ
 */
export function reduceDensity(rawObjects, options = {}) {
  const presetKey = options.preset || 'twoFingers';
  const basePreset = DENSITY_PRESETS[presetKey] || DENSITY_PRESETS.twoFingers;
  const config = {
    ...basePreset,
    ...options
  };

  // Nếu bật chế độ 2 ngón: khống chế cứng maxChord <= 2
  if (config.twoFingerMode) {
    config.maxChord = Math.min(config.maxChord ?? 2, 2);
  }

  if (!rawObjects || rawObjects.length === 0) {
    return {
      notes: [],
      stats: { rawCount: 0, finalCount: 0, holdsConvertedToTap: 0, droppedChord: 0, droppedGap: 0 }
    };
  }

  // 1. Nhóm theo thời điểm time
  const byTime = new Map();
  for (const obj of rawObjects) {
    if (!byTime.has(obj.time)) {
      byTime.set(obj.time, []);
    }
    byTime.get(obj.time).push(obj);
  }

  const sortedTimes = Array.from(byTime.keys()).sort((a, b) => a - b);

  let lastRetainedTime = -Infinity;
  const filteredNotes = [];
  let holdsConvertedToTap = 0;
  let droppedGap = 0;
  let droppedChord = 0;

  // Theo dõi các nốt hold đang được giữ đồng thời cho cơ chế 2 ngón
  let activeHolds = [];
  let lastLongBeatRingHoldEndTime = -Infinity;

  for (const t of sortedTimes) {
    const chord = byTime.get(t);

    // Yêu cầu: Giới hạn tối đa là snap 1/8 của osu, không được import những nốt hơn snap đó (1/12, 1/16, 1/32... làm cho quá khó)
    if (!config.allowFinerSnaps && config.timingPoints && config.timingPoints.length > 0) {
      if (!isSnapWithinLimit(t, config.timingPoints, 8)) {
        droppedGap += chord.length;
        continue;
      }
    }

    // Kiểm tra khoảng cách nhịp giữa 2 thời điểm liên tiếp:
    // Yêu cầu: Không được nhập những nốt dày hơn snap 1/8 (ví dụ 1/12, 1/16...)
    let minGap = config.minGapMs > 0 ? config.minGapMs : 0;
    if (config.timingPoints && config.timingPoints.length > 0) {
      const tp = getActiveTimingPoint(config.timingPoints, t);
      if (tp && tp.beatLength > 0) {
        // Snap 1/8 tối thiểu = beatLength / 8 - 3ms dung sai làm tròn
        const snap8Interval = (tp.beatLength / 8) - 3;
        minGap = Math.max(minGap, snap8Interval);
      }
    }

    if (minGap > 0 && t - lastRetainedTime < minGap) {
      droppedGap += chord.length;
      continue;
    }

    // Phân tách nốt Ring và nốt bấm bàn phím (Buttons):
    // Yêu cầu: Nốt Ring (Spacebar ngón cái) KHÔNG tính vào giới hạn 2 nốt bấm của 2 ngón tay.
    // Tại cùng một thời điểm, có thể có 1 nốt Ring + tối đa 2 nốt bấm bàn phím (chord tối đa 3 nốt).
    const isSpecial = Boolean(config.osuSpecialMapping || config.osu5KMapping);

    // Yêu cầu: Nếu import chart ngoài maimai/osu mania special 5k/7k (ví dụ mode 0, hoặc mania 4k, 6k, 8k...):
    // Hãy cho nút ring hold 1 cách hợp lý ở những nhịp dài của bài hát (kéo dài >= 1400ms, cách nhau >= 7000ms để không spam)
    if (!isSpecial) {
      let beatLen = 500;
      if (config.timingPoints && config.timingPoints.length > 0) {
        const tp = getActiveTimingPoint(config.timingPoints, t);
        if (tp && tp.beatLength > 0) beatLen = tp.beatLength;
      }
      const longBeatThreshold = Math.max(1400, beatLen * 2.5);

      if (t >= lastLongBeatRingHoldEndTime + 7000) {
        let longestHoldObj = null;
        let longestDur = 0;
        for (const obj of chord) {
          const isHold = Boolean(obj.isHold || (obj.type & 128));
          const dur = (obj.endTime || obj.time) - obj.time;
          if (isHold && dur >= longBeatThreshold && dur > longestDur) {
            longestDur = dur;
            longestHoldObj = obj;
          }
        }

        if (longestHoldObj) {
          longestHoldObj.isRing = true;
          longestHoldObj.type = 'ring';
          lastLongBeatRingHoldEndTime = longestHoldObj.endTime || (longestHoldObj.time + longestDur);
        }
      }
    }

    const ringItems = [];
    const buttonItems = [];

    for (const obj of chord) {
      const isSpace = isSpecial && ((config.keys === 5 && obj.col === 2) || (config.keys === 7 && obj.col === 3));
      const isRing = obj.type === 'ring' || obj.isRing || isSpace;
      if (isRing) {
        ringItems.push(obj);
      } else {
        buttonItems.push(obj);
      }
    }

    // 1. Nốt Ring: Giữ tối đa 1 nốt Ring tại cùng thời điểm
    const keptRing = ringItems.slice(0, 1);

    // 2. Nốt bấm bàn phím:
    // Với osu special 5K/7K: Nốt Ring (ngón cái) không chiếm ngón của 2 ngón tay (tối đa 1 Ring + 2 Buttons).
    // Với chart thông thường (2 ngón): Giữ tổng số nốt không vượt quá maxChord.
    let availableButtonFingers = isSpecial ? config.maxChord : Math.max(0, config.maxChord - keptRing.length);
    if (config.twoFingerMode) {
      activeHolds = activeHolds.filter(h => (h.endTime || 0) > t + 20);
      availableButtonFingers = Math.max(0, availableButtonFingers - activeHolds.length);
    }

    const countButtonsToKeep = Math.min(
      buttonItems.length,
      isSpecial ? config.maxChord : Math.max(0, config.maxChord - keptRing.length),
      availableButtonFingers
    );
    const keptButtons = buttonItems.slice(0, countButtonsToKeep);

    const retainedChord = [...keptRing, ...keptButtons];
    droppedChord += (ringItems.length - keptRing.length) + (buttonItems.length - keptButtons.length);

    if (retainedChord.length === 0) {
      continue;
    }

    lastRetainedTime = t;

    for (const note of retainedChord) {
      const isSpace = isSpecial && ((config.keys === 5 && note.col === 2) || (config.keys === 7 && note.col === 3));
      const isRing = note.type === 'ring' || note.isRing || isSpace;
      let isHold = Boolean(note.isHold || (note.type & 128));
      let duration = (note.endTime || note.time) - note.time;

      // Đổi hold quá ngắn thành tap
      if (isHold && duration < config.minHoldMs) {
        isHold = false;
        holdsConvertedToTap++;
      }

      const finalEndTime = isHold ? (note.endTime || note.time + duration) : undefined;
      // Nốt ring hold KHÔNG chiếm ngón của các nốt bấm bàn phím
      if (isHold && config.twoFingerMode && finalEndTime && !isRing) {
        activeHolds.push({ endTime: finalEndTime });
      }

      filteredNotes.push({
        ...note,
        isHold,
        type: isRing ? 'ring' : (isHold ? 'hold' : (note.isBreak ? 'break' : 'tap')),
        endTime: finalEndTime
      });
    }
  }

  return {
    notes: filteredNotes,
    stats: {
      rawCount: rawObjects.length,
      finalCount: filteredNotes.length,
      holdsConvertedToTap,
      droppedGap,
      droppedChord
    }
  };
}
