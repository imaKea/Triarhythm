/**
 * Editor model - toàn bộ logic thuần của Map Editor.
 * Không phụ thuộc React / DOM để có thể unit-test (snap, undo, export, save payload).
 */

export const HISTORY_LIMIT = 200;

export const DEFAULT_HOLD_DURATION = 1000;

/**
 * Định dạng thời gian mm:ss.ms dùng cho header + timeline.
 */
export function formatTime(ms) {
  const safeMs = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const totalSecs = Math.max(0, Math.floor(safeMs / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const millis = Math.floor(safeMs % 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0').slice(0, 2)}`;
}

export function createBlankBeatmap() {
  return {
    version: 2,
    layout: 'triRing9',
    metadata: {
      id: `map_${Date.now()}`,
      title: 'New Triarhythm Track',
      artist: 'Composer',
      creator: 'Editor User',
      difficultyName: 'Master',
      difficultyLevel: '10',
      source: 'custom'
    },
    assets: {
      audio: 'audio.ogg',
      background: null,
      video: null,
      videoOffset: 0,
      hitsounds: {}
    },
    settings: {
      noteSpeed: 10.0,
      audioLeadIn: 0
    },
    timingPoints: [
      { time: 0, bpm: 140, beatLength: 428.571, meter: 4, uninherited: true }
    ],
    notes: [
      { type: 'tap', time: 1000, lane: 0 },
      { type: 'tap', time: 1500, lane: 1 },
      { type: 'tap', time: 2000, lane: 2 },
      { type: 'ring', time: 3000 }
    ]
  };
}

export function getBeatLength(beatmap) {
  const tp = beatmap?.timingPoints?.[0];
  if (!tp) return 500;
  return tp.beatLength || (60000 / (tp.bpm || 120));
}

export function getSnapMs(beatmap, divisor = 4) {
  const safeDivisor = Math.max(1, Number(divisor) || 1);
  return getBeatLength(beatmap) / safeDivisor;
}

/**
 * Làm tròn thời điểm về mốc snap gần nhất.
 */
export function snapTime(time, snapMs) {
  const safeSnap = Number(snapMs) > 0 ? Number(snapMs) : 1;
  const safeTime = Number.isFinite(time) ? time : 0;
  return Math.max(0, Math.round(safeTime / safeSnap) * safeSnap);
}

export function createNote({ type = 'tap', lane, time, snapMs, holdDuration = DEFAULT_HOLD_DURATION } = {}) {
  const snapped = snapTime(time, snapMs);
  if (type === 'ring') return { type: 'ring', time: snapped };

  if (type === 'hold') {
    return {
      type: 'hold',
      time: snapped,
      endTime: snapped + Math.max(snapMs || 1, holdDuration),
      lane
    };
  }

  return { type, time: snapped, lane };
}

export function insertNote(notes, note) {
  return [...(notes || []), note].sort((a, b) => a.time - b.time);
}

export function deleteNotesAt(notes, indices) {
  const remove = indices instanceof Set ? indices : new Set(indices);
  return (notes || []).filter((_, i) => !remove.has(i));
}

/**
 * Copy: chuyển note đã chọn sang dạng tương đối để paste.
 */
export function createClipboard(notes, selectedIndices) {
  const indices = selectedIndices instanceof Set ? selectedIndices : new Set(selectedIndices);
  const selected = Array.from(indices)
    .map((i) => notes[i])
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  if (selected.length === 0) return [];

  const baseTime = selected[0].time;
  return selected.map((n) => ({
    ...n,
    relTime: n.time - baseTime,
    relEndTime: n.endTime !== undefined ? n.endTime - baseTime : undefined
  }));
}

export function notesFromClipboard(clipboard, targetTime, snapMs) {
  const base = snapTime(targetTime, snapMs);
  return (clipboard || []).map((item) => {
    const note = {
      ...item,
      time: base + (item.relTime || 0)
    };
    delete note.relTime;
    if (item.relEndTime !== undefined) {
      note.endTime = base + item.relEndTime;
      delete note.relEndTime;
    }
    return note;
  });
}

/**
 * Di chuyển / đổi lane / đổi loại một note (dùng cho drag & drop).
 */
export function moveNote(notes, index, { time, lane, type } = {}, snapMs) {
  const target = notes[index];
  if (!target) return notes;

  const next = [...notes];
  const updated = { ...target };
  if (time !== undefined) updated.time = snapTime(time, snapMs);
  if (type !== undefined) updated.type = type;

  if (lane === 'ring' || updated.type === 'ring') {
    updated.type = 'ring';
    delete updated.lane;
  } else if (lane !== undefined) {
    updated.lane = lane;
  }

  if (target.endTime !== undefined && time !== undefined) {
    const duration = target.endTime - target.time;
    updated.endTime = updated.time + duration;
  }

  next[index] = updated;
  return next;
}

// =========================================================================
// Undo / Redo history
// =========================================================================

export function pushHistory(history, notes, limit = HISTORY_LIMIT) {
  const next = [...(history || []), notes];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function undoHistory(history, currentNotes) {
  if (!history || history.length === 0) {
    return { history: history || [], notes: currentNotes, undone: false };
  }
  return {
    history: history.slice(0, -1),
    notes: history[history.length - 1],
    undone: true
  };
}

// =========================================================================
// Save / Export
// =========================================================================

export function mergeDifficulties(existing, chart) {
  const diff = {
    difficultyName: chart.metadata.difficultyName,
    difficultyLevel: chart.metadata.difficultyLevel || '10',
    beatmap: chart,
    noteCount: chart.notes.length
  };
  const list = Array.isArray(existing?.difficulties) ? [...existing.difficulties] : [];
  const idx = list.findIndex((d) => d.difficultyName === diff.difficultyName);
  if (idx >= 0) list[idx] = diff;
  else list.push(diff);
  return list;
}

/**
 * Chuẩn hoá beatmap editor thành chart hợp lệ + payload lưu IndexedDB.
 * Giữ nguyên audioBlob/hitsounds... của bài gốc nếu có.
 */
export function buildBeatmapSavePayload(beatmap, { existing = null, audioName = null } = {}) {
  const notes = [...(beatmap.notes || [])].sort((a, b) => a.time - b.time);

  const chart = {
    ...beatmap,
    version: 2,
    layout: beatmap.layout || 'triRing9',
    metadata: {
      ...beatmap.metadata,
      id: beatmap.metadata?.id || `map_${Date.now()}`,
      title: beatmap.metadata?.title || 'Untitled',
      artist: beatmap.metadata?.artist || 'Unknown Artist',
      creator: beatmap.metadata?.creator || 'Editor User',
      difficultyName: beatmap.metadata?.difficultyName || 'Master',
      difficultyLevel: beatmap.metadata?.difficultyLevel || '10',
      source: beatmap.metadata?.source || 'custom'
    },
    assets: {
      audio: beatmap.assets?.audio || audioName || existing?.assets?.audio || '',
      background: beatmap.assets?.background ?? existing?.assets?.background ?? null,
      video: beatmap.assets?.video ?? existing?.assets?.video ?? null,
      videoOffset: beatmap.assets?.videoOffset ?? 0,
      hitsounds: (beatmap.assets?.hitsounds && Object.keys(beatmap.assets.hitsounds).length)
        ? beatmap.assets.hitsounds
        : (existing?.assets?.hitsounds || {})
    },
    settings: {
      noteSpeed: beatmap.settings?.noteSpeed ?? 10,
      audioLeadIn: beatmap.settings?.audioLeadIn ?? 0
    },
    timingPoints: beatmap.timingPoints?.length
      ? beatmap.timingPoints
      : [{ time: 0, bpm: 140, beatLength: 428.571, meter: 4, uninherited: true }],
    notes
  };

  return {
    ...(existing || {}),
    ...chart,
    id: chart.metadata.id,
    title: chart.metadata.title,
    artist: chart.metadata.artist,
    creator: chart.metadata.creator,
    difficultyName: chart.metadata.difficultyName,
    difficultyLevel: chart.metadata.difficultyLevel,
    difficulties: mergeDifficulties(existing, chart),
    updatedAt: Date.now()
  };
}

export function serializeBeatmapExport(beatmap) {
  return JSON.stringify(beatmap, null, 2);
}

export function getExportFilename(beatmap) {
  const title = beatmap?.metadata?.title || 'chart';
  const diff = beatmap?.metadata?.difficultyName || 'diff';
  return `${String(title).replace(/[\\/:*?"<>|]+/g, '_')} [${String(diff).replace(/[\\/:*?"<>|]+/g, '_')}].json`;
}
