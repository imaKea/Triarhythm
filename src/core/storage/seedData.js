/**
 * Seed data ban đầu cho Triarhythm:
 * Nạp bài hát mẫu Beyond The Æxis, Neon Odyssey và tạo tài khoản demo nếu DB chưa có
 */

import { dbManager } from './db.js';
import { SAMPLE_BEATMAP } from '../beatmap/sampleChart.js';
import { parseOsu } from '../parser/index.js';
import { isFirebaseConfigured } from '../../config/firebase.js';

export async function initializeDefaultData() {
  try {
    // 1. Tài khoản demo chỉ tạo khi chạy offline (Firebase Auth quản lý user khi đã cấu hình)
    if (!isFirebaseConfigured) {
      const users = await dbManager.getAllUsers();
      if (users.length === 0) {
        await dbManager.registerUser('player1', '123456', 'Triarhythm Master');
      }
    }

    // 2. Kiểm tra danh sách bài hát
    const beatmaps = await dbManager.getAllBeatmaps();
    if (beatmaps.length === 0) {
      // Nạp Neon Odyssey mẫu
      await dbManager.saveBeatmap({
        id: 'sample-neon-odyssey',
        title: SAMPLE_BEATMAP.metadata.title,
        artist: SAMPLE_BEATMAP.metadata.artist,
        creator: SAMPLE_BEATMAP.metadata.creator,
        difficultyName: SAMPLE_BEATMAP.metadata.difficultyName || 'Standard',
        difficultyLevel: '6',
        color: '#00e5ff',
        beatmap: SAMPLE_BEATMAP,
        difficulties: [
          {
            difficultyName: SAMPLE_BEATMAP.metadata.difficultyName || 'Standard',
            difficultyLevel: '6',
            beatmap: SAMPLE_BEATMAP,
            noteCount: SAMPLE_BEATMAP.notes.length
          }
        ],
        audioSource: null,
        jacket: null
      });

      // Nạp Beyond The Aexis từ fixture nếu có
      try {
        const res = await fetch('/tests/fixtures/beyond-the-aexis/2025310 SDMNE - Beyond The Aexis/SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu');
        if (res.ok) {
          const text = await res.text();
          const parsed = parseOsu(text, { preset: 'twoFingers', autoSlide: true });
          await dbManager.saveBeatmap({
            id: 'osu-beyond-the-aexis',
            title: parsed.beatmap.metadata.title,
            artist: parsed.beatmap.metadata.artist,
            creator: parsed.beatmap.metadata.creator,
            difficultyName: parsed.beatmap.metadata.difficultyName || 'Soulless Wanderers',
            difficultyLevel: '14+',
            color: '#a855f7',
            beatmap: parsed.beatmap,
            difficulties: [
              {
                difficultyName: parsed.beatmap.metadata.difficultyName || 'Soulless Wanderers',
                difficultyLevel: '14+',
                beatmap: parsed.beatmap,
                noteCount: parsed.beatmap.notes.length
              }
            ],
            audioSource: '/audio.ogg',
            jacket: null
          });
        }
      } catch (e) {
        console.warn('Không thể nạp tự động bài Beyond The Aexis mẫu:', e);
      }
    }
  } catch (err) {
    console.error('[Triarhythm Seed] Lỗi nạp dữ liệu ban đầu:', err);
  }
}
