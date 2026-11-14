/**
 * Firebase Storage - tải audio / video / background của beatmap lên cloud.
 * Chỉ chạy khi Firebase được cấu hình và asset là Blob/File thật.
 */

import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { getFirebaseServices, isFirebaseConfigured } from '../../config/firebase.js';

export function isCloudStorageAvailable() {
  return isFirebaseConfigured && Boolean(getFirebaseServices().storage) && typeof Blob !== 'undefined';
}

function extFromBlob(blob, fallback) {
  const type = blob?.type || '';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  if (type.includes('m4a') || type.includes('mp4a')) return 'm4a';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('webm')) return 'webm';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  return fallback;
}

/**
 * Upload một Blob lên Storage.
 * @returns {Promise<string|null>} download URL
 */
export async function uploadAssetBlob(path, blob, { onProgress } = {}) {
  if (!isCloudStorageAvailable() || !(blob instanceof Blob)) return null;

  const { storage } = getFirebaseServices();
  if (!storage) return null;

  const task = uploadBytesResumable(ref(storage, path), blob, {
    contentType: blob.type || 'application/octet-stream'
  });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
        }
      },
      (err) => reject(err),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Upload bộ asset của beatmap. Trả về object URL cloud (chỉ các asset có Blob).
 */
export async function uploadBeatmapAssets(beatmapId, assets = {}, { onProgress } = {}) {
  if (!isCloudStorageAvailable() || !beatmapId) return null;

  const result = {};
  const safeId = String(beatmapId).replace(/[^a-zA-Z0-9_-]/g, '_');

  const jobs = [
    ['audio', assets.audioBlob, 'audio', 'ogg'],
    ['background', assets.backgroundBlob, 'background', 'jpg'],
    ['video', assets.videoBlob, 'video', 'mp4']
  ];

  for (const [key, blob, folder, fallbackExt] of jobs) {
    if (!(blob instanceof Blob)) continue;
    const path = `beatmaps/${safeId}/${folder}.${extFromBlob(blob, fallbackExt)}`;
    try {
      const url = await uploadAssetBlob(path, blob, { onProgress });
      if (url) result[key] = url;
    } catch (err) {
      console.warn(`[Storage] Upload ${key} thất bại:`, err.message);
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
