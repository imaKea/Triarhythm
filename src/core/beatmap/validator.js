/**
 * Bộ kiểm tra tính hợp lệ của Beatmap (validateBeatmap)
 * Kiểm tra các ràng buộc schema, logic gameplay, va chạm note và cảnh báo editor.
 */

import { SLIDE_CONFIG, calculateSlideTiming } from '../../config/slide.config.js';

/**
 * Tìm beatLength của timing point gốc có hiệu lực tại thời điểm time
 */
function getActiveBeatLength(timingPoints, time) {
  if (!timingPoints || timingPoints.length === 0) return 500;
  let active = timingPoints[0];
  for (const tp of timingPoints) {
    if (tp.uninherited && tp.time <= time) {
      active = tp;
    }
  }
  return active.beatLength || (60000 / (active.bpm || 120));
}

/**
 * Validate toàn bộ cấu trúc và logic của một beatmap
 * @param {Object} beatmap - Dữ liệu beatmap JSON
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateBeatmap(beatmap) {
  const errors = [];
  const warnings = [];

  if (!beatmap || typeof beatmap !== 'object') {
    return { valid: false, errors: ['Beatmap phải là một đối tượng JSON hợp lệ.'], warnings: [] };
  }

  // 1. Version
  if (beatmap.version !== 2) {
    errors.push(`Phiên bản beatmap không được hỗ trợ: ${beatmap.version}. Yêu cầu version = 2.`);
  }

  // 2. Layout
  if (!beatmap.layout || typeof beatmap.layout !== 'string') {
    errors.push('Thiếu hoặc sai trường layout (mặc định phải là "triRing9").');
  }

  // 3. Metadata
  if (!beatmap.metadata || typeof beatmap.metadata !== 'object') {
    errors.push('Thiếu trường metadata.');
  } else {
    if (!beatmap.metadata.title) errors.push('Metadata: Thiếu title.');
    if (!beatmap.metadata.artist) errors.push('Metadata: Thiếu artist.');
    if (!beatmap.metadata.creator) errors.push('Metadata: Thiếu creator.');
    if (!beatmap.metadata.difficultyName) errors.push('Metadata: Thiếu difficultyName.');
  }

  // 4. Assets
  if (!beatmap.assets || typeof beatmap.assets !== 'object') {
    errors.push('Thiếu trường assets.');
  } else {
    if (!beatmap.assets.audio) {
      errors.push('Assets: Thiếu file âm thanh chính (audio).');
    }
  }

  // 5. Settings
  if (!beatmap.settings || typeof beatmap.settings !== 'object') {
    errors.push('Thiếu trường settings.');
  } else {
    const ns = beatmap.settings.noteSpeed;
    if (typeof ns !== 'number' || ns < 1.0 || ns > 15.0) {
      errors.push(`Settings: noteSpeed (${ns}) phải nằm trong khoảng [1.0, 15.0].`);
    }
  }

  // 6. TimingPoints
  if (!Array.isArray(beatmap.timingPoints) || beatmap.timingPoints.length === 0) {
    errors.push('TimingPoints: Phải có ít nhất 1 timing point.');
  } else {
    for (let i = 0; i < beatmap.timingPoints.length; i++) {
      const tp = beatmap.timingPoints[i];
      if (typeof tp.time !== 'number') {
        errors.push(`TimingPoints[${i}]: Thiếu hoặc sai trường time.`);
      }
      if (tp.uninherited) {
        if (!tp.beatLength || tp.beatLength <= 0) {
          errors.push(`TimingPoints[${i}]: Điểm gốc uninherited phải có beatLength > 0.`);
        }
      }
    }
  }

  // 7. Notes
  if (!Array.isArray(beatmap.notes)) {
    errors.push('Notes: Trường notes phải là một mảng.');
    return { valid: errors.length === 0, errors, warnings };
  }

  const timingPoints = Array.isArray(beatmap.timingPoints) ? beatmap.timingPoints : [];
  const slideRanges = [];
  const typingRanges = [];

  let prevTime = -Infinity;

  for (let i = 0; i < beatmap.notes.length; i++) {
    const note = beatmap.notes[i];
    const prefix = `Notes[${i}] (type: ${note?.type}, time: ${note?.time}):`;

    if (!note || typeof note !== 'object') {
      errors.push(`Notes[${i}]: Đối tượng note không hợp lệ.`);
      continue;
    }

    // Thời gian không giảm
    if (typeof note.time !== 'number' || isNaN(note.time) || note.time < 0) {
      errors.push(`${prefix} Thời gian time (${note.time}) không hợp lệ.`);
    } else {
      if (note.time < prevTime) {
        errors.push(`${prefix} Thứ tự thời gian bị giảm: ${note.time} < ${prevTime}.`);
      }
      prevTime = note.time;
    }

    // Phân loại note
    switch (note.type) {
      case 'tap':
      case 'break': {
        if (typeof note.lane !== 'number' || !Number.isInteger(note.lane) || note.lane < 0 || note.lane > 8) {
          errors.push(`${prefix} lane (${note.lane}) phải là số nguyên trong khoảng [0, 8].`);
        }
        break;
      }

      case 'hold': {
        if (typeof note.lane !== 'number' || !Number.isInteger(note.lane) || note.lane < 0 || note.lane > 8) {
          errors.push(`${prefix} lane (${note.lane}) phải là số nguyên trong khoảng [0, 8].`);
        }
        if (typeof note.endTime !== 'number' || isNaN(note.endTime) || note.endTime <= note.time) {
          errors.push(`${prefix} endTime (${note.endTime}) phải lớn hơn time (${note.time}).`);
        }
        break;
      }

      case 'slide': {
        if (!Array.isArray(note.path) || note.path.length < 2 || note.path.length > 4) {
          errors.push(`${prefix} path phải là mảng từ 2 đến 4 node.`);
        } else {
          for (let j = 0; j < note.path.length; j++) {
            const nodeIdx = note.path[j];
            if (typeof nodeIdx !== 'number' || !Number.isInteger(nodeIdx) || nodeIdx < 0 || nodeIdx > 2) {
              errors.push(`${prefix} node tại index ${j} (${nodeIdx}) phải nằm trong [0, 2].`);
            }
            if (j > 0 && nodeIdx === note.path[j - 1]) {
              errors.push(`${prefix} hai node liền kề trong path không được trùng nhau (${nodeIdx}).`);
            }
          }
        }

        const wb = note.waitBeats ?? SLIDE_CONFIG.waitBeats.default;
        if (wb < SLIDE_CONFIG.waitBeats.min || wb > SLIDE_CONFIG.waitBeats.max) {
          errors.push(`${prefix} waitBeats (${wb}) phải nằm trong [${SLIDE_CONFIG.waitBeats.min}, ${SLIDE_CONFIG.waitBeats.max}].`);
        }

        const bps = note.beatsPerSegment ?? SLIDE_CONFIG.beatsPerSegment.default;
        if (bps < SLIDE_CONFIG.beatsPerSegment.min || bps > SLIDE_CONFIG.beatsPerSegment.max) {
          errors.push(`${prefix} beatsPerSegment (${bps}) phải nằm trong [${SLIDE_CONFIG.beatsPerSegment.min}, ${SLIDE_CONFIG.beatsPerSegment.max}].`);
        }

        // Tính khoảng thời gian trượt để kiểm tra chồng lặp
        const beatLen = getActiveBeatLength(timingPoints, note.time);
        const timing = calculateSlideTiming(note, beatLen);
        slideRanges.push({
          index: i,
          time: note.time,
          glideStart: timing.glideStart,
          glideEnd: timing.glideEnd
        });
        break;
      }

      case 'typing': {
        if (typeof note.endTime !== 'number' || isNaN(note.endTime) || note.endTime <= note.time) {
          errors.push(`${prefix} endTime (${note.endTime}) phải lớn hơn time (${note.time}).`);
        }
        if (!Array.isArray(note.chars) || note.chars.length === 0) {
          errors.push(`${prefix} Đoạn typing phải chứa ít nhất 1 ký tự.`);
        } else {
          let lastCharTime = -Infinity;
          for (let c = 0; c < note.chars.length; c++) {
            const ch = note.chars[c];
            if (!ch || typeof ch.char !== 'string' || ch.char.length !== 1) {
              errors.push(`${prefix} Ký tự tại chars[${c}] không hợp lệ.`);
            }
            if (typeof ch.time !== 'number' || ch.time < note.time || ch.time > note.endTime) {
              errors.push(`${prefix} Ký tự '${ch.char}' có time (${ch.time}) nằm ngoài [${note.time}, ${note.endTime}].`);
            }
            if (ch.time < lastCharTime) {
              errors.push(`${prefix} Ký tự '${ch.char}' có time giảm dần.`);
            }
            lastCharTime = ch.time;
          }
        }
        typingRanges.push({
          index: i,
          start: note.time - 300,
          end: note.endTime + 300
        });
        break;
      }

      case 'ring': {
        // Nốt Ring mở rộng kích thước như game outline (bằng cả ring), nhấn phím SPACE
        break;
      }

      default:
        errors.push(`${prefix} Loại note không hợp lệ: "${note.type}".`);
    }
  }

  // 8. Ràng buộc khoảng đệm Typing Section
  // "trong [time - 300ms, endTime + 300ms] không được có note Tap/Hold/Break/Slide."
  for (const tr of typingRanges) {
    for (let i = 0; i < beatmap.notes.length; i++) {
      if (i === tr.index) continue;
      const note = beatmap.notes[i];
      const noteEndTime = note.endTime || note.time;
      // Kiểm tra xem note có chạm vào khoảng [start, end] của typing không
      const overlaps = (note.time >= tr.start && note.time <= tr.end) ||
                       (noteEndTime >= tr.start && noteEndTime <= tr.end) ||
                       (note.time <= tr.start && noteEndTime >= tr.end);
      if (overlaps) {
        errors.push(`Typing section [${beatmap.notes[tr.index].time} - ${beatmap.notes[tr.index].endTime}] bị chồng bởi note ${note.type} tại index ${i} (time: ${note.time}).`);
      }
    }
  }

  // 9. Cảnh báo Slide chồng Slide
  // "Editor cảnh báo khi hai Slide chồng nhau trong [time - 200, glideEnd + 200]"
  for (let a = 0; a < slideRanges.length; a++) {
    for (let b = a + 1; b < slideRanges.length; b++) {
      const sA = slideRanges[a];
      const sB = slideRanges[b];
      const startA = sA.time - SLIDE_CONFIG.overlapBufferMs;
      const endA = sA.glideEnd + SLIDE_CONFIG.overlapBufferMs;
      const startB = sB.time - SLIDE_CONFIG.overlapBufferMs;
      const endB = sB.glideEnd + SLIDE_CONFIG.overlapBufferMs;

      if (Math.max(startA, startB) <= Math.min(endA, endB)) {
        warnings.push(`Cảnh báo: Hai Slide chồng khoảng thời gian điều khiển chuột: Slide #${sA.index} (${sA.time}ms) và Slide #${sB.index} (${sB.time}ms).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
