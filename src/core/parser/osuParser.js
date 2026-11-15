/**
 * Bộ phân tích cú pháp .osu (parseOsu)
 * Thuần JavaScript (ES6 module), không phụ thuộc DOM hay Node.js runtime.
 * Hỗ trợ định dạng osu v14 và cũ hơn.
 */

import { cleanString } from './cleanString.js';
import { processTimingPoints, getActiveTimingPoint, isSnapWithinLimit } from './timingGrid.js';
import { reduceDensity, DENSITY_PRESETS } from './densityReducer.js';
import { mapNotesToLanes } from './laneMapper.js';

/**
 * Phân tích cú pháp chuỗi văn bản .osu
 * @param {string} text Nội dung file .osu
 * @param {Object} options Cấu hình chuyển đổi (preset, autoSlide, finishToBreak...)
 */
export function parseOsu(text, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Dữ liệu .osu không hợp lệ hoặc rỗng.');
  }

  // Tách dòng an toàn với cả CRLF (\r\n) và LF (\n)
  const lines = text.split(/\r?\n/);

  const sections = {
    general: {},
    metadata: {},
    difficulty: {},
    events: [],
    timingPoints: [],
    hitObjects: []
  };

  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Bỏ qua dòng trống và comment
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Nhận diện header của section: [General], [Metadata], etc.
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).toLowerCase();
      continue;
    }

    switch (currentSection) {
      case 'general':
      case 'metadata':
      case 'difficulty': {
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const val = trimmed.slice(colonIdx + 1).trim();
          sections[currentSection][key] = val;
        }
        break;
      }
      case 'events':
        sections.events.push(trimmed);
        break;
      case 'timingpoints':
        sections.timingPoints.push(trimmed);
        break;
      case 'hitobjects':
        sections.hitObjects.push(trimmed);
        break;
    }
  }

  // Tiện ích tìm key không phân biệt hoa thường trong section
  const getFieldCI = (obj, field) => {
    if (!obj) return '';
    const target = field.toLowerCase();
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase() === target) return v;
    }
    return '';
  };

  // 1. Phân giải [General]
  const general = sections.general;
  const rawAudio = getFieldCI(general, 'AudioFilename');
  const audioFilename = cleanString(rawAudio || 'audio.ogg').replace(/^["']|["']$/g, '');
  const audioLeadIn = Math.max(0, parseInt(getFieldCI(general, 'AudioLeadIn') || '0', 10));
  const previewTime = Math.max(0, parseInt(getFieldCI(general, 'PreviewTime') || '0', 10));
  const mode = parseInt(getFieldCI(general, 'Mode') || '0', 10);
  const sampleSet = cleanString(getFieldCI(general, 'SampleSet') || 'Soft');

  // 2. Phân giải [Metadata]
  const meta = sections.metadata;
  // Ưu tiên bản Unicode, làm sạch toàn bộ ký tự ẩn
  const title = cleanString(getFieldCI(meta, 'TitleUnicode') || getFieldCI(meta, 'Title') || 'Untitled');
  const artist = cleanString(getFieldCI(meta, 'ArtistUnicode') || getFieldCI(meta, 'Artist') || 'Unknown');
  const creator = cleanString(getFieldCI(meta, 'Creator') || 'Unknown');
  const version = cleanString(getFieldCI(meta, 'Version') || 'Normal');
  const beatmapId = cleanString(getFieldCI(meta, 'BeatmapID') || '0');
  const beatmapSetId = cleanString(getFieldCI(meta, 'BeatmapSetID') || '0');
  const rawTags = cleanString(getFieldCI(meta, 'Tags') || '');
  const tags = rawTags ? rawTags.split(/\s+/).filter(Boolean) : [];

  // 3. Phân giải [Difficulty]
  const diff = sections.difficulty;
  const circleSize = parseFloat(diff.CircleSize || '4');
  const sliderMultiplier = parseFloat(diff.SliderMultiplier || '1.4');
  const keys = mode === 3 ? Math.max(1, Math.round(circleSize)) : 5;
  const is5Key = (mode === 3 && keys === 5);
  const is7Key = (mode === 3 && keys === 7);
  const is5Kor7K = (mode === 3 && (keys === 5 || keys === 7));

  // Yêu cầu: Kiểm tra nếu yêu cầu bắt buộc chỉ nạp chart 5K / 7K
  if ((options.require5Keys || options.requireSpecialKeys || options.osuSpecialMapping || options.osu5KMapping) && !is5Kor7K) {
    throw new Error(`Chỉ hỗ trợ chart osu!mania 5 key hoặc 7 key. File này là ${mode === 3 ? `${keys} key` : 'osu! standard'}.`);
  }

  // 4. Phân giải [Events] (Ảnh nền & Video)
  let background = null;
  let video = null;
  let videoOffset = 0;

  for (const ev of sections.events) {
    const parts = ev.split(',');
    const evType = parts[0]?.trim();

    // Event 0: Ảnh nền (0,0,"bg.jpg",...)
    if (evType === '0') {
      const filename = parts[2]?.replace(/["']/g, '').trim();
      if (filename && !background) {
        background = filename;
      }
    }
    // Event 1 hoặc Video: Video nền
    else if (evType === '1' || evType?.toLowerCase() === 'video') {
      videoOffset = parseInt(parts[1] || '0', 10);
      const filename = parts[2]?.replace(/["']/g, '').trim();
      if (filename && !video) {
        video = filename;
      }
    }
  }

  // 5. Phân giải [TimingPoints]
  const timingResult = processTimingPoints(sections.timingPoints, sampleSet);
  const allTimingPoints = timingResult.allPoints;
  const mergedTimingPoints = timingResult.timingPoints;

  // 6. Phân giải [HitObjects]
  const rawObjects = [];
  let rawTapCount = 0;
  let rawHoldCount = 0;
  let maxHoldDuration = 0;
  let holdsUnder250 = 0;
  let minRawGap = Infinity;
  let prevRawTime = -Infinity;

  // Map theo dõi hold đồng thời
  const holdActiveRanges = [];

  for (let i = 0; i < sections.hitObjects.length; i++) {
    const line = sections.hitObjects[i];
    const parts = line.split(',');
    if (parts.length < 4) continue;

    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const time = parseInt(parts[2], 10);
    const type = parseInt(parts[3], 10);
    const hitSound = parseInt(parts[4] || '0', 10);

    if (isNaN(time)) continue;

    // Tính min gap giữa các nốt liên tiếp
    if (prevRawTime !== -Infinity) {
      const gap = time - prevRawTime;
      if (gap > 0 && gap < minRawGap) {
        minRawGap = gap;
      }
    }
    prevRawTime = time;

    // type & 8 là spinner -> bỏ qua theo spec
    if (type & 8) continue;

    const isTap = (type & 1) !== 0;
    const isHold = (type & 128) !== 0;
    const isSlider = (type & 2) !== 0;

    let endTime = time;

    if (isHold) {
      // endTime nằm ở phần đầu của objectParams: "endTime:hitSample"
      const endPart = parts[5] ? parts[5].split(':')[0] : '';
      endTime = parseInt(endPart, 10);
      if (isNaN(endTime) || endTime <= time) {
        endTime = time;
      }
      const dur = endTime - time;
      if (dur < 250) holdsUnder250++;
      if (dur > maxHoldDuration) maxHoldDuration = dur;

      holdActiveRanges.push({ start: time, end: endTime });
      rawHoldCount++;
    } else if (isSlider && mode === 0) {
      // Xử lý slider Mode 0: tính duration dựa trên pixelLength
      const pixelLength = parseFloat(parts[7] || '0');
      const slides = parseInt(parts[6] || '1', 10);

      // Tìm active timing point và inherited point để tính svMult
      const activeTp = getActiveTimingPoint(mergedTimingPoints, time);
      let svMult = 1.0;
      for (const tp of allTimingPoints) {
        if (!tp.uninherited && tp.time <= time) {
          svMult = -100 / tp.beatLength;
        }
      }

      const beatLen = activeTp ? activeTp.beatLength : 500;
      const duration = (pixelLength / (sliderMultiplier * 100 * svMult)) * beatLen * slides;
      endTime = Math.round(time + Math.max(0, duration));
      rawHoldCount++;
    } else {
      rawTapCount++;
    }

    // HitSound finish -> break (nếu bật finishToBreak)
    const isFinish = (hitSound & 4) !== 0;
    const isBreak = options.finishToBreak ? isFinish : false;

    rawObjects.push({
      x,
      y,
      time,
      type,
      isHold: isHold || (isSlider && mode === 0),
      isBreak,
      endTime,
      col: mode === 3 ? Math.max(0, Math.min(keys - 1, Math.floor((x * keys) / 512))) : undefined
    });
  }

  // Tính số lượng hold đồng thời tối đa
  let maxSimultaneousHolds = 0;
  const holdEvents = [];
  for (const hold of holdActiveRanges) {
    if (hold.end <= hold.start) continue;
    holdEvents.push({ time: hold.start, delta: 1 }, { time: hold.end, delta: -1 });
  }
  holdEvents.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let activeHolds = 0;
  for (const event of holdEvents) {
    activeHolds += event.delta;
    maxSimultaneousHolds = Math.max(maxSimultaneousHolds, activeHolds);
  }

  // 7. Làm gọn mật độ (Density Reduction) - Mặc định luôn là chuẩn 2 ngón tay (twoFingers)
  const presetKey = options.preset || 'twoFingers';
  const densityConfig = {
    ...DENSITY_PRESETS[presetKey],
    ...options,
    keys,
    timingPoints: mergedTimingPoints
  };

  const reductionResult = reduceDensity(rawObjects, densityConfig);

  // 8. Chuyển đổi và gán Lane sang triRing9
  const mappingResult = mapNotesToLanes(
    reductionResult.notes,
    mode,
    keys,
    densityConfig,
    mergedTimingPoints
  );

  // 9. Dựng cấu trúc JSON Beatmap v2 hoàn chỉnh
  const beatmap = {
    version: 2,
    layout: 'triRing9',
    metadata: {
      id: beatmapId !== '0' ? `osu-${beatmapId}` : (beatmapSetId !== '0' ? `osu-set-${beatmapSetId}-${version}` : `osu-${title}-${artist}-${version}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      beatmapSetId: beatmapSetId !== '0' ? beatmapSetId : undefined,
      beatmapId: beatmapId !== '0' ? beatmapId : undefined,
      title,
      artist,
      creator,
      creatorUid: '',
      difficultyName: version,
      stars: 0, // Sẽ do hệ thống PP tính ở GĐ7
      previewTime,
      source: 'osu',
      tags
    },
    assets: {
      audio: audioFilename,
      background,
      video,
      videoOffset,
      hitsounds: {
        normal: 'soft-hitnormal.wav'
      }
    },
    settings: {
      noteSpeed: 10.0,
      audioLeadIn
    },
    timingPoints: mergedTimingPoints,
    notes: mappingResult.notes
  };

  return {
    beatmap,
    mode,
    keys,
    is5Key,
    is7Key,
    is5Kor7K,
    rawStats: {
      rawTotalCount: sections.hitObjects.length,
      rawTapCount,
      rawHoldCount,
      maxHoldDuration,
      holdsUnder250,
      maxSimultaneousHolds,
      minRawGap: minRawGap === Infinity ? 0 : minRawGap,
      rawTimingPointsCount: timingResult.rawTotalCount,
      rawUninheritedTimingCount: timingResult.rawUninheritedCount,
      mergedTimingCount: mergedTimingPoints.length
    },
    reductionStats: reductionResult.stats,
    mappingStats: {
      droppedCount: mappingResult.droppedCount,
      totalMapped: mappingResult.totalMapped
    }
  };
}
