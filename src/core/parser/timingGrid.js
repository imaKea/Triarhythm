/**
 * Xử lý Timing Points và lưới nhịp Beat Snap Grid
 * Hỗ trợ gộp điểm gốc, tính BPM và phân giải nhịp
 */

export const SAMPLE_SET_MAP = {
  0: 'normal',
  1: 'normal',
  2: 'soft',
  3: 'drum'
};

/**
 * Phân tích và chuẩn hóa danh sách timing points từ file .osu
 * @param {Array<string>} rawLines Danh sách dòng trong section [TimingPoints]
 * @param {string} defaultSampleSet SampleSet mặc định từ [General]
 */
export function processTimingPoints(rawLines, defaultSampleSet = 'soft') {
  const parsed = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const parts = trimmed.split(',');
    if (parts.length < 2) continue;

    const time = parseFloat(parts[0]);
    const beatLength = parseFloat(parts[1]);
    const meter = parseInt(parts[2] || '4', 10);
    const sampleSetCode = parseInt(parts[3] || '0', 10);
    const sampleIndex = parseInt(parts[4] || '0', 10);
    const volume = parseInt(parts[5] || '100', 10);
    // uninherited: 1 là điểm gốc (red line), 0 là kế thừa (green line). Mặc định là 1 nếu không có.
    const uninherited = parts[6] === undefined || parts[6] === '1';
    const effects = parseInt(parts[7] || '0', 10);

    if (isNaN(time) || isNaN(beatLength)) continue;

    const sampleSet = sampleSetCode === 0 ? defaultSampleSet.toLowerCase() : (SAMPLE_SET_MAP[sampleSetCode] || 'normal');

    parsed.push({
      time,
      beatLength,
      meter: meter > 0 ? meter : 4,
      sampleSet,
      sampleIndex,
      volume: Math.max(0, Math.min(100, volume)),
      uninherited,
      effects
    });
  }

  // 1. Sắp xếp ổn định theo time; trùng time thì uninherited (gốc) đứng trước
  parsed.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return (b.uninherited ? 1 : 0) - (a.uninherited ? 1 : 0);
  });

  // 2. Tách và gộp các điểm gốc (uninherited = true và beatLength > 0)
  const rawUninherited = parsed.filter(tp => tp.uninherited && tp.beatLength > 0);
  const mergedUninherited = [];

  for (const tp of rawUninherited) {
    const bpm = 60000 / tp.beatLength;
    const cleanPoint = {
      time: Math.round(tp.time),
      bpm: Number(bpm.toFixed(3)),
      beatLength: tp.beatLength,
      meter: tp.meter,
      uninherited: true,
      volume: tp.volume,
      sampleSet: tp.sampleSet
    };

    if (mergedUninherited.length === 0) {
      mergedUninherited.push(cleanPoint);
    } else {
      const prev = mergedUninherited[mergedUninherited.length - 1];
      // Nếu 2 điểm gốc liên tiếp có beatLength giống nhau (sai số < 0.0001) thì gộp (bỏ qua điểm sau)
      if (Math.abs(tp.beatLength - prev.beatLength) > 1e-4) {
        mergedUninherited.push(cleanPoint);
      }
    }
  }

  // Đảm bảo luôn có ít nhất 1 điểm gốc
  if (mergedUninherited.length === 0) {
    mergedUninherited.push({
      time: 0,
      bpm: 120,
      beatLength: 500,
      meter: 4,
      uninherited: true,
      volume: 100,
      sampleSet: 'normal'
    });
  }

  return {
    allPoints: parsed,
    rawUninheritedCount: rawUninherited.length,
    rawTotalCount: parsed.length,
    timingPoints: mergedUninherited
  };
}

/**
 * Tìm Timing Point gốc đang có hiệu lực tại thời điểm time
 */
export function getActiveTimingPoint(timingPoints, time) {
  if (!timingPoints || timingPoints.length === 0) {
    return { time: 0, bpm: 120, beatLength: 500, meter: 4 };
  }
  let active = timingPoints[0];
  for (const tp of timingPoints) {
    if (tp.time <= time) {
      active = tp;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Sinh lưới nhịp Beat Snap cho một khoảng thời gian [startTime, endTime]
 * Divisors hỗ trợ: 1/1, 1/2, 1/3, 1/4, 1/6, 1/8
 */
export function generateBeatGrid(timingPoints, startTime, endTime, divisor = 4) {
  const snaps = [];
  if (!timingPoints || timingPoints.length === 0) return snaps;

  for (let i = 0; i < timingPoints.length; i++) {
    const current = timingPoints[i];
    const nextTime = i < timingPoints.length - 1 ? timingPoints[i + 1].time : endTime;

    const segStart = Math.max(startTime, current.time);
    const segEnd = Math.min(endTime, nextTime);

    if (segStart >= segEnd) continue;

    const stepMs = current.beatLength / divisor;
    let t = current.time;
    let beatIndex = 0;

    while (t < segStart) {
      t += stepMs;
      beatIndex++;
    }

    while (t <= segEnd) {
      snaps.push({
        time: Math.round(t),
        beatIndex,
        isMajorBeat: beatIndex % divisor === 0,
        bpm: current.bpm
      });
      t += stepMs;
      beatIndex++;
    }
  }

  return snaps;
}

/**
 * Kiểm tra xem một thời điểm time (ms) có nằm trong giới hạn Beat Snap cho phép (mặc định tối đa 1/8) hay không.
 * Các snap hợp lệ: 1/1, 1/2, 1/4, 1/8 và nhịp ba 1/3, 1/6.
 * Bỏ qua các nốt có snap chi tiết hơn (1/12, 1/16, 1/24, 1/32, 1/64 hoặc un-snapped).
 */
export function isSnapWithinLimit(time, timingPoints, maxDivisor = 8) {
  if (!timingPoints || timingPoints.length === 0) return true;
  const tp = getActiveTimingPoint(timingPoints, time);
  const beatLength = tp.beatLength;
  if (!beatLength || beatLength <= 0) return true;

  const offset = time - tp.time;
  const frac = ((offset % beatLength) + beatLength) % beatLength;

  // 1. Kiểm tra lưới nhịp 1/8 (gồm 1/1, 1/2, 1/4, 1/8)
  const step8 = beatLength / 8;
  const nearestIdx8 = Math.round(frac / step8);
  const dist8 = Math.abs(frac - nearestIdx8 * step8);

  // 2. Kiểm tra lưới nhịp 1/6 (gồm 1/1, 1/3, 1/6 - triplets / swing)
  const step6 = beatLength / 6;
  const nearestIdx6 = Math.round(frac / step6);
  const dist6 = Math.abs(frac - nearestIdx6 * step6);

  // Dung sai sai số làm tròn mili-giây (osu! lưu thời gian dạng số nguyên milisecond)
  const snapToleranceMs = Math.max(3, Math.min(step8 * 0.25, 4.5));

  return dist8 <= snapToleranceMs || dist6 <= snapToleranceMs;
}
