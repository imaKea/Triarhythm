/**
 * Triarhythm Maimai / Simai Chart Parser (maimaiParser.js)
 * Phân tích cú pháp định dạng maidata.txt của maimai DX / Simai / AstroDX
 * Chuyển đổi toàn bộ slide notes và touch notes (Touch tâm C và Touch vành trong/ngoài A, B, D, E) thành nốt Ring (phím Space)
 * Phù hợp hoàn toàn cho phong cách chơi 2 ngón (maxChord <= 2)
 */

// Ánh xạ 8 phím tròn maimai sang 9 ô phím của Triarhythm triRing9
export const MAIMAI_TO_LANE = {
  1: 2, // Phím 1 (Top-Right)    -> Lane 2 (Phím 8·9)
  2: 6, // Phím 2 (Upper-Right)  -> Lane 6 (Phím I)
  3: 7, // Phím 3 (Mid-Right)    -> Lane 7 (Phím J)
  4: 8, // Phím 4 (Bottom-Right) -> Lane 8 (Phím N)
  5: 5, // Phím 5 (Bottom-Left)  -> Lane 5 (Phím V)
  6: 4, // Phím 6 (Mid-Left)     -> Lane 4 (Phím F)
  7: 3, // Phím 7 (Upper-Left)   -> Lane 3 (Phím R)
  8: 0  // Phím 8 (Top-Left)     -> Lane 0 (Phím 4·5)
};

// Tên độ khó chuẩn maimai DX
export const MAIMAI_DIFF_NAMES = {
  1: 'Basic',
  2: 'Advanced',
  3: 'Expert',
  4: 'Master',
  5: 'Re:Master',
  6: 'Utage',
  7: 'Utage'
};

/**
 * Tính thời lượng nốt Hold / Slide theo cú pháp [divisor:count] hoặc [seconds]
 */
export function parseSimaiDuration(durationStr, currentBpm) {
  if (!durationStr) return 500;
  let cleanStr = durationStr.trim();
  // Trường hợp có độ trễ [delay#divisor:count] hoặc [delay##seconds]
  if (cleanStr.includes('#')) {
    const parts = cleanStr.split('#').filter(Boolean);
    cleanStr = parts[parts.length - 1] || '';
  }

  if (cleanStr.includes(':')) {
    const [divStr, countStr] = cleanStr.split(':');
    const div = parseFloat(divStr) || 4;
    const parsedCount = parseFloat(countStr);
    const count = !isNaN(parsedCount) ? parsedCount : 1;
    if (count <= 0) return 0;
    return (60000 / currentBpm) * (4 / div) * count;
  } else {
    const sec = parseFloat(cleanStr);
    if (!isNaN(sec)) {
      return sec > 0 ? sec * 1000 : 0;
    }
    return 500;
  }
}

/**
 * Phân tích nội dung maidata.txt và trả về danh sách đầy đủ các độ khó
 */
export function parseMaimai(maidataText, options = {}) {
  const mergedOptions = { preset: 'twoFingers', noteSpeed: 10.0, ...options };

  // 1. Tách các thẻ &tag=value
  const rawSections = maidataText.split('&').map((s) => s.trim()).filter(Boolean);
  const metadata = {
    title: 'Untitled Maimai Track',
    artist: 'Unknown Artist',
    first: 0,
    des: '',
    des_1: '',
    des_2: '',
    des_3: '',
    des_4: '',
    des_5: '',
    lv_1: '1',
    lv_2: '5',
    lv_3: '8',
    lv_4: '12+',
    lv_5: '14'
  };

  const inotes = {};

  for (const sec of rawSections) {
    const eqIdx = sec.indexOf('=');
    if (eqIdx === -1) continue;
    const key = sec.slice(0, eqIdx).trim().toLowerCase();
    const val = sec.slice(eqIdx + 1).trim();

    if (key.startsWith('inote_')) {
      const diffNum = key.replace('inote_', '');
      inotes[diffNum] = val;
    } else {
      metadata[key] = val;
    }
  }

  const offsetMs = parseFloat(metadata.first || '0') * 1000;
  const difficulties = [];

  // 2. Phân tích từng độ khó có trong chart
  const diffKeys = Object.keys(inotes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const diffKey of diffKeys) {
    const inoteContent = inotes[diffKey];
    if (!inoteContent || !inoteContent.trim()) continue;

    const diffIdx = parseInt(diffKey, 10);
    const diffName = MAIMAI_DIFF_NAMES[diffIdx] || `Diff #${diffIdx}`;
    const diffLevel = metadata[`lv_${diffKey}`] || '10';
    const creator = metadata[`des_${diffKey}`] || metadata.des || 'Maimai Mapper';

    const parsedChart = parseSimaiInote(inoteContent, offsetMs, mergedOptions);

    const beatmap = {
      version: 2,
      layout: 'triRing9',
      metadata: {
        id: `maimai_${(metadata.title || 'track').replace(/\s+/g, '_')}_${diffName}`.toLowerCase(),
        title: metadata.title || 'Untitled Track',
        artist: metadata.artist || 'Unknown Artist',
        creator,
        difficultyName: diffName,
        difficultyLevel: diffLevel,
        stars: parseFloat(diffLevel) || 10,
        source: 'maimai',
        previewTime: parseFloat(metadata.demo_seek || '0') * 1000
      },
      settings: {
        noteSpeed: mergedOptions.noteSpeed || 10.0,
        audioLeadIn: 0
      },
      timingPoints: [
        {
          time: offsetMs,
          bpm: parsedChart.initialBpm,
          beatLength: 60000 / parsedChart.initialBpm,
          meter: 4,
          uninherited: true
        }
      ],
      notes: parsedChart.notes
    };

    difficulties.push({
      difficultyIndex: diffIdx,
      difficultyName: diffName,
      difficultyLevel: diffLevel,
      beatmap,
      noteCount: parsedChart.notes.length
    });
  }

  if (difficulties.length === 0) {
    throw new Error('File maidata.txt không chứa độ khó (inote_*) hợp lệ nào.');
  }

  return {
    metadata: {
      title: metadata.title || 'Untitled Track',
      artist: metadata.artist || 'Unknown Artist',
      creator: metadata.des || 'Maimai Mapper',
      offsetMs
    },
    difficulties,
    primaryBeatmap: difficulties[difficulties.length - 1].beatmap // Mặc định chọn Master/Re:Master
  };
}

/**
 * Phân tích chuỗi inote Simai và sinh danh sách nốt Triarhythm
 */
function parseSimaiInote(inoteText, offsetMs, options) {
  let currentBpm = 120;
  let initialBpm = null;
  let currentDivisor = 4;
  let currentTime = offsetMs;
  let rawNotes = [];

  // Lược bỏ chú thích
  const clean = inoteText.replace(/\|\|.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  let i = 0;
  let currentGroup = '';

  while (i < clean.length) {
    const ch = clean[i];

    // Thay đổi BPM: (bpm)
    if (ch === '(') {
      const closeIdx = clean.indexOf(')', i);
      if (closeIdx !== -1) {
        const bpmVal = parseFloat(clean.slice(i + 1, closeIdx));
        if (!isNaN(bpmVal) && bpmVal > 0) {
          currentBpm = bpmVal;
          if (initialBpm === null) initialBpm = bpmVal;
        }
        i = closeIdx + 1;
        continue;
      }
    }

    // Thay đổi phân nhịp: {divisor}
    if (ch === '{') {
      const closeIdx = clean.indexOf('}', i);
      if (closeIdx !== -1) {
        const divStr = clean.slice(i + 1, closeIdx).trim();
        const divVal = parseFloat(divStr.split('#')[0]);
        if (!isNaN(divVal) && divVal > 0) {
          currentDivisor = divVal;
        }
        i = closeIdx + 1;
        continue;
      }
    }

    // Ký hiệu kết thúc chart: chữ 'E' đứng độc lập
    if (ch === 'E' && (i === clean.length - 1 || /[\s\r\n,]/.test(clean[i + 1]))) {
      break;
    }

    // Dấu phẩy tiến thời gian theo phân nhịp hiện tại
    if (ch === ',') {
      if (currentGroup.trim()) {
        parseSimaiNoteGroup(currentGroup.trim(), currentTime, currentBpm, currentDivisor, rawNotes);
        currentGroup = '';
      }
      const stepMs = (60000 / currentBpm) * (4 / currentDivisor);
      currentTime += stepMs;
      i++;
      continue;
    }

    // Bỏ qua khoảng trắng
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    currentGroup += ch;
    i++;
  }

  // Nhóm nốt cuối cùng nếu có
  if (currentGroup.trim()) {
    parseSimaiNoteGroup(currentGroup.trim(), currentTime, currentBpm, currentDivisor, rawNotes);
  }

  rawNotes.sort((a, b) => a.time - b.time);

  // Lọc trùng lặp các nốt Ring Tap quá sát nhau (<= 25ms), ví dụ từ nhiều slider kết thúc cùng lúc
  const dedupedNotes = [];
  for (const note of rawNotes) {
    if (note.type === 'ring' && !note.isHold) {
      const prevRing = [...dedupedNotes].reverse().find((n) => n.type === 'ring');
      if (prevRing && Math.abs(prevRing.time - note.time) <= 25) {
        continue;
      }
    }
    dedupedNotes.push(note);
  }
  rawNotes = dedupedNotes;

  // Sanitization: Đảm bảo không có nốt nào trên cùng 1 lane chồng lên nhau hoặc đè nốt Hold
  const laneLastHold = new Map();
  for (const note of rawNotes) {
    if (note.lane !== undefined) {
      const prevHold = laneLastHold.get(note.lane);
      if (prevHold && prevHold.endTime > note.time) {
        // Cắt ngắn nốt hold trước đó để nhường chỗ cho nốt mới trên cùng lane
        prevHold.endTime = Math.max(prevHold.time, note.time - 25);
        if (prevHold.endTime - prevHold.time < 50) {
          prevHold.type = prevHold.isBreak ? 'break' : 'tap';
          delete prevHold.endTime;
        }
      }
      if (note.type === 'hold' && note.endTime) {
        laneLastHold.set(note.lane, note);
      } else {
        laneLastHold.delete(note.lane);
      }
    }
  }

  // Sanitization: Đảm bảo nốt Ring Hold không đè nốt Ring kế tiếp
  let prevRingHold = null;
  for (const note of rawNotes) {
    if (note.type === 'ring') {
      if (prevRingHold && prevRingHold.endTime > note.time) {
        prevRingHold.endTime = Math.max(prevRingHold.time, note.time - 30);
        if (prevRingHold.endTime - prevRingHold.time < 100) {
          prevRingHold.isHold = false;
          delete prevRingHold.endTime;
        }
      }
      if (note.isHold && note.endTime) {
        prevRingHold = note;
      } else {
        prevRingHold = null;
      }
    }
  }

  // Giữ nguyên 100% tất cả các nốt và snap của maimai, không tự động đổi nốt sang drag
  return {
    notes: rawNotes,
    initialBpm: initialBpm || currentBpm
  };
}

/**
 * Phân tích một nhóm nốt tại cùng một thời điểm (tách bởi dấu /)
 * Ánh xạ chuẩn xác theo 8 phím cabinet của Maimai sang 8 phím Triarhythm (bỏ qua lane 1: phím 6·7).
 * Bỏ qua toàn bộ giới hạn công thái học / maxButtons để giữ 100% bản đồ gốc của Maimai.
 */
function parseSimaiNoteGroup(groupStr, time, bpm, currentDivisor, notesOut) {
  const tokens = groupStr.split('/');

  // Phân tách số nút bấm viết liền (ví dụ '81' -> '8', '1'; '45' -> '4', '5'; '1b8b' -> '1b', '8b')
  const expandedTokens = [];
  for (const t of tokens) {
    if (/^([1-8][bxf]?){2,}$/i.test(t)) {
      const sub = t.match(/[1-8][bxf]*/gi);
      if (sub) {
        for (const s of sub) expandedTokens.push(s);
      } else {
        expandedTokens.push(t);
      }
    } else {
      expandedTokens.push(t);
    }
  }

  const laneNotesMap = new Map();
  let hasRingAtThisTime = false;

  for (const token of expandedTokens) {
    const raw = token.trim();
    if (!raw) continue;

    // 1. Kiểm tra Slide Note (chứa các ký tự đường dẫn slide: -, v, p, q, s, z, w, >, <, ^)
    // Convert slide sang nốt Ring (phím Space) phát sound effect SE_GAME_BREAKSLIDE.
    // Đồng thời giữ nốt gốc Button 1..8 trên lane tương ứng theo layout 8 nút cabinet.
    const isSlide = /[-vpqszw><\^]/.test(raw);
    if (isSlide) {
      if (!hasRingAtThisTime) {
        notesOut.push({
          type: 'ring',
          time: Math.round(time)
        });
        hasRingAtThisTime = true;
      }

      // Thêm 1 nốt ring đơn (tuyệt đối không phải ring hold) tại điểm kết thúc của slider maimai
      const durMatch = raw.match(/\[(.*?)\]/);
      const slideDuration = durMatch ? parseSimaiDuration(durMatch[1], bpm) : (60000 / bpm);
      const slideEndTime = Math.round(time + slideDuration);
      if (slideEndTime > Math.round(time)) {
        const alreadyHasRingAtEnd = notesOut.some(
          (n) => n.type === 'ring' && Math.abs(n.time - slideEndTime) <= 25
        );
        if (!alreadyHasRingAtEnd) {
          notesOut.push({
            type: 'ring',
            time: slideEndTime
            // Không có isHold và endTime (chỉ là nốt ring đơn, trừ nốt ring hold)
          });
        }
      }

      // Khởi tạo nốt Tap/Break tương ứng với nút gốc bắt đầu slide
      const slideStartMatch = raw.match(/^([1-8])([bxf]?)/i);
      if (slideStartMatch) {
        const buttonNum = parseInt(slideStartMatch[1], 10);
        const lane = MAIMAI_TO_LANE[buttonNum];
        if (lane !== undefined) {
          const isBreak = /b/i.test(slideStartMatch[2]) || /x/i.test(slideStartMatch[2]);
          const noteObj = {
            type: isBreak ? 'break' : 'tap',
            time: Math.round(time),
            lane
          };
          const existing = laneNotesMap.get(lane);
          if (!existing || (noteObj.type === 'break' && existing.type === 'tap')) {
            laneNotesMap.set(lane, noteObj);
          }
        }
      }
      continue;
    }

    // 2. Touch Notes: Center Touch (C, C1, C2...) và Outer Touch Zones (A1-A8, B1-B8, D1-D8, E1-E8)
    // Toàn bộ các nốt Touch cảm biến của Maimai (màu xanh dương ở xung quanh giữa màn hình và tâm)
    // được chuyển đổi thành nốt Ring (phím Space / Ring Note), không tạo nốt trên các lane viền tam giác.
    const touchMatch = raw.match(/^(?:[ABCD][1-8]?|E[1-8])/i);
    if (touchMatch) {
      const isTouchHold = /h/i.test(raw);
      let durationMs = 0;
      if (isTouchHold) {
        const durMatch = raw.match(/\[(.*?)\]/);
        durationMs = durMatch ? parseSimaiDuration(durMatch[1], bpm) : (60000 / bpm);
      }

      if (!hasRingAtThisTime) {
        if (isTouchHold && durationMs >= 100) {
          notesOut.push({
            type: 'ring',
            isHold: true,
            time: Math.round(time),
            endTime: Math.round(time + durationMs)
          });
        } else {
          notesOut.push({
            type: 'ring',
            time: Math.round(time)
          });
        }
        hasRingAtThisTime = true;
      } else if (isTouchHold && durationMs >= 100) {
        // Nếu đã có nốt Ring tại thời điểm này nhưng nốt Touch này là Hold, nâng cấp lên Ring Hold
        const existingRing = notesOut.find((n) => n.type === 'ring' && n.time === Math.round(time));
        if (existingRing) {
          if (!existingRing.isHold) {
            existingRing.isHold = true;
            existingRing.endTime = Math.round(time + durationMs);
          } else {
            existingRing.endTime = Math.max(existingRing.endTime || 0, Math.round(time + durationMs));
          }
        }
      }
      continue;
    }

    // 4. Nút bấm vật lý 1 đến 8 quanh viền cabinet (Tap, Break, Hold không phải Slide)
    const buttonMatch = raw.match(/^([1-8])/);
    if (!buttonMatch) continue;

    const buttonNum = parseInt(buttonMatch[1], 10);
    const lane = MAIMAI_TO_LANE[buttonNum];
    if (lane !== undefined) {
      const rest = raw.slice(1);
      const isBreak = /b/i.test(rest) || /x/i.test(rest);
      const isHold = /h/i.test(rest);

      let noteObj;
      if (isHold) {
        const durMatch = rest.match(/\[(.*?)\]/);
        const durationMs = durMatch ? parseSimaiDuration(durMatch[1], bpm) : 500;
        if (durationMs > 0) {
          noteObj = {
            type: 'hold',
            time: Math.round(time),
            endTime: Math.round(time + durationMs),
            lane
          };
        } else {
          noteObj = {
            type: isBreak ? 'break' : 'tap',
            time: Math.round(time),
            lane
          };
        }
      } else if (isBreak) {
        noteObj = {
          type: 'break',
          time: Math.round(time),
          lane
        };
      } else {
        noteObj = {
          type: 'tap',
          time: Math.round(time),
          lane
        };
      }

      const existing = laneNotesMap.get(lane);
      if (!existing || (noteObj.type === 'break' && existing.type === 'tap') || noteObj.type === 'hold') {
        laneNotesMap.set(lane, noteObj);
      }
    }
  }

  // Bỏ qua mọi luật hạn chế số lượng phím bấm (không giới hạn 2 ngón), giữ nguyên 100% nốt của Maimai
  for (const note of laneNotesMap.values()) {
    notesOut.push(note);
  }
}
