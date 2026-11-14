import { describe, it, expect, vi } from 'vitest';
import {
  buildScoreRecord,
  persistScoreResult
} from '../src/core/storage/scoreService.js';

const summary = {
  score: 987654,
  achievement: 98.7654,
  rank: 'SSS',
  maxCombo: 1200,
  counts: { criticalPerfect: 900, perfect: 10, great: 2, good: 0, miss: 1 },
  ur: 45.2,
  flags: { isAP: false, isFC: false }
};

const chart = {
  id: 'song-1',
  title: 'Test Song',
  difficultyName: 'Master',
  beatmap: {
    metadata: { id: 'song-1', title: 'Test Song', difficultyName: 'Master' },
    notes: new Array(913).fill(null).map((_, i) => ({ type: 'tap', time: i * 100, lane: i % 9 }))
  }
};

describe('buildScoreRecord', () => {
  it('chuẩn hóa summary + chart thành record đầy đủ', () => {
    const record = buildScoreRecord({
      summary,
      user: { uid: 'uid-1', username: 'aster', displayName: 'Aster' },
      chart,
      stars: 12.34,
      pp: 210.5,
      isAutoplay: false,
      playedAt: 1700000000000
    });

    expect(record.userId).toBe('uid-1');
    expect(record.username).toBe('aster');
    expect(record.beatmapId).toBe('song-1');
    expect(record.beatmapTitle).toBe('Test Song');
    expect(record.difficultyName).toBe('Master');
    expect(record.score).toBe(987654);
    expect(record.accuracy).toBe(98.7654);
    expect(record.counts).toEqual(summary.counts);
    expect(record.counts).not.toBe(summary.counts);
    expect(record.stars).toBe(12.34);
    expect(record.pp).toBe(210.5);
    expect(record.playedAt).toBe(1700000000000);
  });

  it('tự suy ra score từ achievement khi summary thiếu score', () => {
    const record = buildScoreRecord({
      summary: { achievement: 100, counts: {}, rank: 'SSS+' },
      chart
    });
    expect(record.score).toBe(1000000);
  });

  it('mặc định guest và không có người dùng', () => {
    const record = buildScoreRecord({ summary, chart });
    expect(record.userId).toBe('guest');
    expect(record.username).toBe('guest');
    expect(record.isAutoplay).toBe(false);
    expect(record.stars).toBe(0);
    expect(record.pp).toBe(0);
  });

  it('hỗ trợ chart là beatmap trực tiếp', () => {
    const record = buildScoreRecord({ summary, chart: chart.beatmap });
    expect(record.beatmapId).toBe('song-1');
    expect(record.beatmapTitle).toBe('Test Song');
  });

  it('ném lỗi khi thiếu summary', () => {
    expect(() => buildScoreRecord({})).toThrow(/summary/i);
  });
});

describe('persistScoreResult', () => {
  it('lưu IndexedDB và đồng bộ cloud thành công', async () => {
    const db = { saveScore: vi.fn(async () => 'local-42') };
    const sync = vi.fn(async () => ({ synced: true, id: 'cloud-1' }));

    const record = buildScoreRecord({ summary, chart });
    const result = await persistScoreResult(record, { db, sync });

    expect(db.saveScore).toHaveBeenCalledWith(record);
    expect(sync).toHaveBeenCalledWith(record);
    expect(result.localId).toBe('local-42');
    expect(result.cloud).toEqual({ synced: true, id: 'cloud-1' });
  });

  it('vẫn giữ điểm local khi cloud lỗi', async () => {
    const db = { saveScore: vi.fn(async () => 'local-7') };
    const sync = vi.fn(async () => {
      throw new Error('offline');
    });

    const result = await persistScoreResult(buildScoreRecord({ summary, chart }), { db, sync });

    expect(result.localId).toBe('local-7');
    expect(result.cloud.synced).toBe(false);
    expect(result.cloud.reason).toBe('offline');
  });

  it('vẫn giữ điểm local khi cloud trả về chưa cấu hình', async () => {
    const db = { saveScore: vi.fn(async () => 'local-8') };
    const sync = vi.fn(async () => ({ synced: false, reason: 'firebase-not-configured' }));

    const result = await persistScoreResult(buildScoreRecord({ summary, chart }), { db, sync });

    expect(result.localId).toBe('local-8');
    expect(result.cloud.reason).toBe('firebase-not-configured');
  });

  it('ném lỗi khi record không hợp lệ', async () => {
    await expect(persistScoreResult(null)).rejects.toThrow(/Record/i);
  });
});
