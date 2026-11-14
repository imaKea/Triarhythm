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

  it('dùng song ID của map thay vì ID riêng của difficulty để đồng bộ leaderboard', () => {
    const record = buildScoreRecord({
      summary,
      chart: {
        id: 'song-set-1',
        beatmap: {
          metadata: { id: 'chart-difficulty-1', title: 'Test Song', difficultyName: 'Master' }
        }
      }
    });

    expect(record.beatmapId).toBe('song-set-1');
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
  it('lưu IndexedDB và đồng bộ MySQL thành công', async () => {
    const db = { saveScore: vi.fn(async () => 'local-42') };
    const api = { submitScore: vi.fn(async () => ({ rank_position: 3, user: { id: 1 } })) };

    const record = buildScoreRecord({ summary, chart });
    const result = await persistScoreResult(record, { db, api });

    expect(db.saveScore).toHaveBeenCalledWith(record);
    expect(api.submitScore).toHaveBeenCalledTimes(1);
    expect(result.localId).toBe('local-42');
    expect(result.mysql.synced).toBe(true);
    expect(result.mysql.rankPosition).toBe(3);
  });

  it('gửi đúng payload MySQL (snake_case + counts)', async () => {
    const db = { saveScore: vi.fn(async () => 'local-1') };
    const api = { submitScore: vi.fn(async () => ({})) };

    await persistScoreResult(buildScoreRecord({ summary, chart }), { db, api });

    const payload = api.submitScore.mock.calls[0][0];
    expect(payload.song_id).toBe('song-1');
    expect(payload.difficulty_name).toBe('Master');
    expect(payload.score).toBe(987654);
    expect(payload.critical_perfect).toBe(900);
    expect(payload.miss).toBe(1);
  });

  it('vẫn giữ điểm local khi MySQL lỗi', async () => {
    const db = { saveScore: vi.fn(async () => 'local-7') };
    const api = {
      submitScore: vi.fn(async () => {
        throw new Error('offline');
      })
    };

    const result = await persistScoreResult(buildScoreRecord({ summary, chart }), { db, api });

    expect(result.localId).toBe('local-7');
    expect(result.mysql.synced).toBe(false);
    expect(result.mysql.reason).toBe('offline');
  });

  it('bỏ qua đồng bộ khi không có API (ngoài trình duyệt)', async () => {
    const db = { saveScore: vi.fn(async () => 'local-9') };

    const result = await persistScoreResult(buildScoreRecord({ summary, chart }), { db });

    expect(result.localId).toBe('local-9');
    expect(result.mysql.synced).toBe(false);
    expect(result.mysql.reason).toBe('not-attempted');
  });

  it('không lưu cục bộ hoặc gửi API khi record dùng autoplay', async () => {
    const db = { saveScore: vi.fn(async () => 'local-autoplay') };
    const api = { submitScore: vi.fn(async () => ({})) };
    const record = buildScoreRecord({ summary, chart, isAutoplay: true });

    const result = await persistScoreResult(record, { db, api });

    expect(db.saveScore).not.toHaveBeenCalled();
    expect(api.submitScore).not.toHaveBeenCalled();
    expect(result).toEqual({
      localId: null,
      mysql: { synced: false, reason: 'autoplay-disabled' }
    });
  });

  it('ném lỗi khi record không hợp lệ', async () => {
    await expect(persistScoreResult(null)).rejects.toThrow(/Record/i);
  });
});
