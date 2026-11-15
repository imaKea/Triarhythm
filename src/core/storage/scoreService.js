/**
 * Dịch vụ lưu kết quả chơi (score flow)
 * - buildScoreRecord: chuyển summary của engine thành bản ghi thuần (testable)
 * - persistScoreResult: lưu IndexedDB + đồng bộ lên MySQL (Laravel API)
 *
 * IndexedDB là cache offline; MySQL (Laravel) là nguồn sự thật của dự án.
 */

import { dbManager } from './db.js';
import { apiClient } from '../api/client.js';

/**
 * Chuẩn hóa summary + thông tin bài hát thành record lưu DB.
 * Không phụ thuộc IndexedDB / Laravel để có thể unit-test.
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
    throw new Error('Missing score summary to save record.');
  }

  const beatmap = chart?.beatmap || chart || {};
  const beatmapId = chart?.id || beatmap.id || beatmap.metadata?.id || chart?.metadata?.id || 'unknown';
  const beatmapTitle = chart?.title || beatmap.metadata?.title || 'Unknown Track';
  const difficultyName =
    chart?.difficultyName || beatmap.metadata?.difficultyName || 'Normal';

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
    achievement: achievement,
    maxCombo: Number(summary.maxCombo) || 0,
    rank: summary.rank || 'C',
    counts: summary.counts ? { ...summary.counts } : {},
    stars: Number(stars) || 0,
    pp: Number(pp) || 0,
    isAutoplay: Boolean(isAutoplay),
    playedAt
  };
}

function toMysqlPayload(record) {
  return {
    song_id: record.beatmapId,
    difficulty_name: record.difficultyName,
    stars: record.stars || 0,
    score: record.score,
    accuracy: record.accuracy,
    max_combo: record.maxCombo,
    rank: record.rank,
    critical_perfect: record.counts?.criticalPerfect ?? record.counts?.CRITICAL_PERFECT ?? 0,
    perfect: record.counts?.perfect ?? record.counts?.PERFECT ?? 0,
    great: record.counts?.great ?? record.counts?.GREAT ?? 0,
    good: record.counts?.good ?? record.counts?.GOOD ?? 0,
    miss: record.counts?.miss ?? record.counts?.MISS ?? 0,
    pp: record.pp || 0,
    mods: { isAutoplay: record.isAutoplay }
  };
}

export async function syncScoreResult(record, deps = {}) {
  const api = deps.api || apiClient;

  if (!record || typeof record !== 'object') {
    throw new Error('Invalid score record.');
  }

  if (record.isAutoplay) {
    return { synced: false, reason: 'autoplay-disabled' };
  }

  const canSync = deps.sync !== false && (typeof window !== 'undefined' || Boolean(deps.api));
  if (!canSync) return { synced: false, reason: 'not-attempted' };
  if (typeof api.getToken === 'function' && !api.getToken()) {
    return { synced: false, reason: 'login-required' };
  }

  try {
    const res = await api.submitScore(toMysqlPayload(record));
    return {
      synced: true,
      rankPosition: res?.rank_position ?? null,
      user: res?.user ?? null
    };
  } catch (err) {
    return { synced: false, reason: err?.message || 'mysql-sync-failed' };
  }
}

/**
 * Lưu điểm vào IndexedDB rồi đồng bộ lên MySQL.
 * `deps` cho phép inject fake DB / fake API trong unit test.
 *
 * @returns {Promise<{localId: any, mysql: {synced: boolean, reason?: string, rankPosition?: number|null, user?: object|null}}>}
 */
export async function persistScoreResult(record, deps = {}) {
  const db = deps.db || dbManager;

  if (!record || typeof record !== 'object') {
    throw new Error('Invalid score record.');
  }

  if (record.isAutoplay) {
    return {
      localId: null,
      mysql: { synced: false, reason: 'autoplay-disabled' }
    };
  }

  const localId = await db.saveScore(record);
  const mysql = await syncScoreResult(record, deps);
  return { localId, mysql };
}
