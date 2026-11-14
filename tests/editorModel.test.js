import { describe, it, expect } from 'vitest';
import {
  formatTime,
  createBlankBeatmap,
  snapTime,
  createNote,
  createClipboard,
  notesFromClipboard,
  moveNote,
  pushHistory,
  undoHistory,
  buildBeatmapSavePayload,
  serializeBeatmapExport,
  getExportFilename,
  mergeDifficulties
} from '../src/features/editor/editorModel.js';

describe('formatTime', () => {
  it('định dạng mm:ss.xx', () => {
    expect(formatTime(0)).toBe('00:00.00');
    expect(formatTime(61500)).toBe('01:01.50');
    expect(formatTime(125999)).toBe('02:05.99');
  });

  it('không trả về số âm', () => {
    expect(formatTime(-500)).toBe('00:00.00');
  });
});

describe('snapTime', () => {
  it('làm tròn về mốc snap gần nhất', () => {
    expect(snapTime(1120, 250)).toBe(1000);
    expect(snapTime(1130, 250)).toBe(1250);
    expect(snapTime(1000, 250)).toBe(1000);
  });

  it('không âm và chịu được snap không hợp lệ', () => {
    expect(snapTime(-100, 250)).toBe(0);
    expect(snapTime(123, 0)).toBe(123);
    expect(snapTime(NaN, 250)).toBe(0);
  });
});

describe('createNote', () => {
  it('tap được snap thời gian', () => {
    expect(createNote({ type: 'tap', lane: 3, time: 1110, snapMs: 250 }))
      .toEqual({ type: 'tap', time: 1000, lane: 3 });
  });

  it('ring không có lane', () => {
    const ring = createNote({ type: 'ring', time: 1499, snapMs: 250 });
    expect(ring).toEqual({ type: 'ring', time: 1500 });
    expect(ring.lane).toBeUndefined();
  });

  it('hold có endTime = time + holdDuration (tối thiểu 1 snap)', () => {
    const hold = createNote({ type: 'hold', lane: 1, time: 1000, snapMs: 250, holdDuration: 500 });
    expect(hold.endTime).toBe(1500);

    const tiny = createNote({ type: 'hold', lane: 1, time: 1000, snapMs: 250, holdDuration: 10 });
    expect(tiny.endTime).toBe(1250);
  });
});

describe('clipboard', () => {
  const notes = [
    { type: 'tap', time: 1000, lane: 0 },
    { type: 'tap', time: 1500, lane: 1 },
    { type: 'tap', time: 2000, lane: 2 }
  ];

  it('copy giữ thời gian tương đối', () => {
    const clipboard = createClipboard(notes, new Set([0, 1]));
    expect(clipboard.map((n) => n.relTime)).toEqual([0, 500]);
  });

  it('paste tại thời điểm mới và snap', () => {
    const clipboard = createClipboard(notes, new Set([0, 1]));
    const pasted = notesFromClipboard(clipboard, 4020, 250);
    expect(pasted.map((n) => n.time)).toEqual([4000, 4500]);
    expect(pasted[0].relTime).toBeUndefined();
  });

  it('copy rỗng trả về []', () => {
    expect(createClipboard(notes, new Set())).toEqual([]);
  });
});

describe('moveNote', () => {
  it('snap thời gian và đổi lane', () => {
    const notes = [{ type: 'tap', time: 1000, lane: 0 }];
    const moved = moveNote(notes, 0, { time: 1130, lane: 5 }, 250);
    expect(moved[0]).toEqual({ type: 'tap', time: 1250, lane: 5 });
  });

  it('đổi thành ring thì xoá lane', () => {
    const notes = [{ type: 'tap', time: 1000, lane: 0 }];
    const moved = moveNote(notes, 0, { type: 'ring' }, 250);
    expect(moved[0].type).toBe('ring');
    expect(moved[0].lane).toBeUndefined();
  });

  it('giữ nguyên độ dài hold khi di chuyển', () => {
    const notes = [{ type: 'hold', time: 1000, endTime: 2000, lane: 2 }];
    const moved = moveNote(notes, 0, { time: 3000 }, 250);
    expect(moved[0].time).toBe(3000);
    expect(moved[0].endTime).toBe(4000);
  });

  it('index không tồn tại trả về nguyên mảng', () => {
    const notes = [{ type: 'tap', time: 1000, lane: 0 }];
    expect(moveNote(notes, 5, { time: 2000 }, 250)).toBe(notes);
  });
});

describe('undo history', () => {
  it('push và giới hạn số bản ghi', () => {
    let history = [];
    for (let i = 0; i < 5; i++) history = pushHistory(history, [i], 3);
    expect(history).toHaveLength(3);
    expect(history[2]).toEqual([4]);
  });

  it('undo trả về snapshot trước đó', () => {
    const before = [{ type: 'tap', time: 1000, lane: 0 }];
    const after = [{ type: 'tap', time: 1000, lane: 0 }, { type: 'tap', time: 2000, lane: 1 }];
    const history = pushHistory([], before);

    const result = undoHistory(history, after);
    expect(result.undone).toBe(true);
    expect(result.notes).toBe(before);
    expect(result.history).toEqual([]);
  });

  it('undo khi rỗng giữ nguyên notes hiện tại', () => {
    const current = [{ type: 'tap', time: 1000, lane: 0 }];
    const result = undoHistory([], current);
    expect(result.undone).toBe(false);
    expect(result.notes).toBe(current);
  });
});

describe('buildBeatmapSavePayload', () => {
  it('sắp xếp note, gán id và difficulties', () => {
    const beatmap = createBlankBeatmap();
    beatmap.metadata.id = 'editor-test';
    beatmap.notes = [
      { type: 'tap', time: 2000, lane: 2 },
      { type: 'tap', time: 1000, lane: 1 }
    ];

    const payload = buildBeatmapSavePayload(beatmap);
    expect(payload.id).toBe('editor-test');
    expect(payload.title).toBe(beatmap.metadata.title);
    expect(payload.notes.map((n) => n.time)).toEqual([1000, 2000]);
    expect(payload.difficulties).toHaveLength(1);
    expect(payload.difficulties[0].difficultyName).toBe(beatmap.metadata.difficultyName);
    expect(payload.difficulties[0].noteCount).toBe(2);
  });

  it('thay thế difficulty cùng tên và giữ difficulty khác khi lưu lại', () => {
    const beatmap = createBlankBeatmap();
    beatmap.metadata.id = 'editor-test';
    beatmap.metadata.difficultyName = 'Master';

    const existing = {
      id: 'editor-test',
      difficulties: [
        { difficultyName: 'Master', difficultyLevel: '10', beatmap: {}, noteCount: 4 },
        { difficultyName: 'Expert', difficultyLevel: '8', beatmap: {}, noteCount: 9 }
      ]
    };

    const payload = buildBeatmapSavePayload(beatmap, { existing });
    expect(payload.difficulties).toHaveLength(2);
    const master = payload.difficulties.find((d) => d.difficultyName === 'Master');
    expect(master.noteCount).toBe(beatmap.notes.length);
    expect(payload.difficulties.some((d) => d.difficultyName === 'Expert')).toBe(true);
  });

  it('giữ asset audio cũ khi beatmap không khai báo', () => {
    const beatmap = createBlankBeatmap();
    beatmap.assets.audio = '';
    const existing = { assets: { audio: 'old.ogg', hitsounds: { tap: 'hit.wav' } } };
    const payload = buildBeatmapSavePayload(beatmap, { existing });
    expect(payload.assets.audio).toBe('old.ogg');
    expect(payload.assets.hitsounds).toEqual({ tap: 'hit.wav' });
  });
});

describe('mergeDifficulties', () => {
  it('tạo mới khi chưa có danh sách', () => {
    const chart = { ...createBlankBeatmap(), notes: [{ type: 'tap', time: 0, lane: 0 }] };
    const list = mergeDifficulties(null, chart);
    expect(list).toHaveLength(1);
    expect(list[0].difficultyName).toBe(chart.metadata.difficultyName);
  });
});

describe('export', () => {
  it('serialize JSON hợp lệ', () => {
    const beatmap = createBlankBeatmap();
    const json = serializeBeatmapExport(beatmap);
    expect(JSON.parse(json)).toEqual(beatmap);
  });

  it('tên file loại bỏ ký tự cấm', () => {
    const name = getExportFilename({
      metadata: { title: 'A/B:C?', difficultyName: 'Master / Hard' }
    });
    expect(name).toBe('A_B_C_ [Master _ Hard].json');
  });
});
