/**
 * Dịch vụ lưu kết quả chơi (score flow)
 * - buildScoreRecord: chuyển summary của engine thành bản ghi thuần (testable)
 * - persistScoreResult: lưu IndexedDB + đồng bộ Firestore (nếu cấu hình)
 */

import { dbManager } from './db.js';
import { submitScoreToCloud } from '../online/scoreService.js';
import { apiClient } from '../api/client.js';

/**
 * Chuẩn hóa summary + thông tin bài hát thành record lưu DB.
 * Không phụ thuộc IndexedDB / Firebase để có thể unit-test.
 */
export function buildScoreRecord({
  summary,
  user = null,
  chart = null,
  isAutoplay = false,
  stars = 0,
  pp = 0,
  playedAt = Date.now()
} = {}) {
  if (!summary || typeof summary !== 'object') {
    throw new Error('Thiếu summary kết quả để lưu điểm.');
  }

  const beatmap = chart?.beatmap || chart || {};
  const beatmapId = beatmap.metadata?.id || chart?.metadata?.id || chart?.id || 'unknown';
  const beatmapTitle = beatmap.metadata?.title || chart?.title || 'Unknown Track';
  const difficultyName =
    beatmap.metadata?.difficultyName || chart?.difficultyName || 'Normal';

  const achievement = Number(summary.achievement) || 0;
  const score = Number.isFinite(summary.score)
    ? Math.round(summary.score)
    : Math.round(achievement * 10000);

  return {
    userId: user?.uid || user?.username || user?.id || 'guest',
    username: user?.username || user?.displayName || 'guest',
    beatmapId,
    beatmapTitle,
    difficultyName,
    score,
    accuracy: achievement,
    maxCombo: Number(summary.maxCombo) || 0,
    rank: summary.rank || 'C',
    counts: summary.counts ? { ...summary.counts } : {},
    stars: Number(stars) || 0,
    pp: Number(pp) || 0,
    isAutoplay: Boolean(isAutoplay),
    playedAt
  };
}

/**
 * Lưu điểm vào IndexedDB và (tuỳ chọn) Firestore.
 * `deps` cho phép inject fake DB / fake cloud trong unit test.
 *
 * @returns {Promise<{localId: any, cloud: {synced: boolean, reason?: string, id?: string}}>}
 */
export async function persistScoreResult(record, deps = {}) {
  const db = deps.db || dbManager;
  const sync = deps.sync || submitScoreToCloud;

  if (!record || typeof record !== 'object') {
    throw new Error('Record điểm không hợp lệ.');
  }

  const localId = await db.saveScore(record);

  let cloud = { synced: false, reason: 'not-attempted' };
  try {
    cloud = await sync(record);
  } catch (err) {
    cloud = { synced: false, reason: err?.message || 'cloud-sync-failed' };
  }

  // Đồng bộ lên Laravel MySQL Backend (trong môi trường trình duyệt)
  let mysql = null;
  if (typeof window !== 'undefined' && typeof fetch === 'function' && !deps.sync) {
    try {
      const api = deps.apiClient || apiClient;
      mysql = await api.submitScore({
        song_id: record.beatmapId,
        difficulty_name: record.difficultyName,
        score: record.score,
        accuracy: record.accuracy,
        max_combo: record.maxCombo,
        rank: record.rank,
        critical_perfect: record.counts?.CRITICAL_PERFECT || 0,
        perfect: record.counts?.PERFECT || 0,
        great: record.counts?.GREAT || 0,
        good: record.counts?.GOOD || 0,
        miss: record.counts?.MISS || 0,
        pp: record.pp || 0,
        mods: { isAutoplay: record.isAutoplay }
      });
    } catch (_) {}
  }

  return { localId, cloud, mysql };
}
