/**
 * Firebase v10 Modular Configuration
 * - Chỉ khởi tạo khi có cấu hình hợp lệ (tránh crash/khởi tạo rác khi dev offline)
 * - An toàn khi import trong môi trường Node/Vitest (không có window)
 *
 * Biến môi trường (xem .env.example):
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
 *   VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const PLACEHOLDER_KEYS = new Set([
  'your_api_key_here',
  'mock-api-key',
  'mock_api_key',
  ''
]);

export function readFirebaseConfig(env = import.meta.env) {
  return {
    apiKey: env?.VITE_FIREBASE_API_KEY,
    authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env?.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env?.VITE_FIREBASE_APP_ID
  };
}

export const firebaseConfig = readFirebaseConfig();

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !PLACEHOLDER_KEYS.has(firebaseConfig.apiKey)
);

let services = null;

/**
 * Trả về { app, auth, db, storage } đã khởi tạo (memoized).
 * Trả về các giá trị null nếu chưa cấu hình hoặc đang chạy ngoài browser.
 */
export function getFirebaseServices() {
  if (services) return services;

  if (!isFirebaseConfigured || typeof window === 'undefined') {
    services = { app: null, auth: null, db: null, storage: null, configured: false };
    return services;
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    // Giữ đăng nhập qua các lần tải lại trang
    try {
      setPersistence(auth, browserLocalPersistence).catch(() => {});
    } catch (_) {}

    services = { app, auth, db, storage, configured: true };
  } catch (err) {
    console.warn('[Firebase] Khởi tạo thất bại, chuyển sang chế độ offline:', err.message);
    services = { app: null, auth: null, db: null, storage: null, configured: false };
  }

  return services;
}

// Tương thích ngược: một số module cũ có thể import trực tiếp auth/db/storage
const initial = getFirebaseServices();
export const app = initial.app;
export const auth = initial.auth;
export const db = initial.db;
export const storage = initial.storage;
