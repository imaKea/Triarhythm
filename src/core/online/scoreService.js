/**
 * Đồng bộ điểm số lên Firestore (collection `scores`).
 * Không ném lỗi khi Firebase chưa cấu hình — trả về { synced: false, reason }.
 */

import {
  addDoc,
  collection,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { getFirebaseServices, isFirebaseConfigured } from '../../config/firebase.js';

function sanitizeRecord(record) {
  try {
    return JSON.parse(JSON.stringify(record));
  } catch (_) {
    return { ...record };
  }
}

export async function submitScoreToCloud(record) {
  if (!isFirebaseConfigured) {
    return { synced: false, reason: 'firebase-not-configured' };
  }

  const { db, auth } = getFirebaseServices();
  if (!db) return { synced: false, reason: 'firestore-unavailable' };

  try {
    const payload = {
      ...sanitizeRecord(record),
      uid: auth?.currentUser?.uid || record.userId || 'guest',
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'scores'), payload);
    return { synced: true, id: ref.id };
  } catch (err) {
    return { synced: false, reason: err.message || 'firestore-write-failed' };
  }
}

/**
 * Bảng xếp hạng theo beatmap.
 * Lưu ý: cần tạo composite index (beatmapId ASC, score DESC) trong Firestore.
 */
export async function getLeaderboard(beatmapId, max = 50) {
  if (!isFirebaseConfigured) return [];
  const { db } = getFirebaseServices();
  if (!db) return [];

  try {
    const q = query(
      collection(db, 'scores'),
      where('beatmapId', '==', beatmapId),
      orderBy('score', 'desc'),
      limitQuery(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[Score] Không tải được bảng xếp hạng:', err.message);
    return [];
  }
}

/**
 * Điểm tốt nhất của một người chơi (dùng cho hồ sơ / tổng PP online sau này).
 */
export async function getUserScores(uid, max = 200) {
  if (!isFirebaseConfigured || !uid) return [];
  const { db } = getFirebaseServices();
  if (!db) return [];

  try {
    const q = query(
      collection(db, 'scores'),
      where('uid', '==', uid),
      orderBy('score', 'desc'),
      limitQuery(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[Score] Không tải được điểm người chơi:', err.message);
    return [];
  }
}
