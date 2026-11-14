/**
 * AuthService - Đăng ký / đăng nhập / phiên người dùng.
 *
 * - Khi Firebase được cấu hình: dùng Firebase Auth (Email/Password) + Firestore
 *   cho hồ sơ người chơi (collection `users`).
 * - Khi chưa cấu hình (dev offline): fallback về IndexedDB local như trước,
 *   nhưng vẫn dùng chung interface để UI không cần biết.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseServices, isFirebaseConfigured } from '../../config/firebase.js';
import { dbManager } from '../storage/db.js';
import {
  normalizeUsername,
  usernameToEmail,
  validateCredentials,
  createPlayerProfile,
  translateAuthError
} from './authModel.js';

const SESSION_KEY = 'triarhythm.session';
let cachedUser = null;
let authInitialized = false;

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

export function getAuthMode() {
  return isFirebaseConfigured ? 'firebase' : 'local';
}

export function readSession() {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeSession(user) {
  cachedUser = user;
  if (!canUseStorage()) return;
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch (_) {}
}

async function loadProfile(uid, fallbackUsername = '') {
  const { db } = getFirebaseServices();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return { uid, ...snap.data() };
    }
  } catch (err) {
    console.warn('[Auth] Không đọc được hồ sơ Firestore:', err.message);
  }
  return fallbackUsername ? createPlayerProfile({ uid, username: fallbackUsername, provider: 'firebase' }) : null;
}

async function saveProfile(profile) {
  const { db } = getFirebaseServices();
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', profile.uid), {
      username: profile.username,
      displayName: profile.displayName,
      avatar: profile.avatar,
      rating: profile.rating,
      dan: profile.dan,
      createdAt: profile.createdAt,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('[Auth] Không ghi được hồ sơ Firestore:', err.message);
  }
}

/**
 * Khôi phục phiên đăng nhập hiện tại.
 */
export async function restoreSession() {
  if (!isFirebaseConfigured) {
    const local = readSession();
    if (local) cachedUser = local;
    return cachedUser;
  }

  const { auth } = getFirebaseServices();
  if (!auth) {
    cachedUser = readSession();
    return cachedUser;
  }

  if (authInitialized && cachedUser) return cachedUser;

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      unsubscribe();
      authInitialized = true;
      if (!fbUser) {
        cachedUser = null;
        writeSession(null);
        resolve(null);
        return;
      }
      const stored = readSession();
      const profile = await loadProfile(
        fbUser.uid,
        stored?.username || fbUser.displayName || fbUser.email?.split('@')[0] || 'player'
      );
      const user = profile || createPlayerProfile({
        uid: fbUser.uid,
        username: fbUser.email?.split('@')[0] || 'player',
        displayName: fbUser.displayName || '',
        provider: 'firebase'
      });
      writeSession(user);
      resolve(user);
    }, (err) => {
      console.warn('[Auth] onAuthStateChanged lỗi:', err.message);
      authInitialized = true;
      cachedUser = readSession();
      resolve(cachedUser);
    });
  });
}

export async function registerUser(username, password, displayName = '') {
  const check = validateCredentials(username, password);
  if (!check.valid) throw new Error(check.error);

  const name = normalizeUsername(username);

  if (!isFirebaseConfigured) {
    const local = await dbManager.registerUser(name, password, displayName);
    const session = { ...local, provider: 'local' };
    delete session.passwordHash;
    writeSession(session);
    return session;
  }

  const { auth } = getFirebaseServices();
  if (!auth) throw new Error('Firebase chưa sẵn sàng. Kiểm tra cấu hình .env.');

  try {
    const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(name), password);
    const profile = createPlayerProfile({
      uid: cred.user.uid,
      username: name,
      displayName,
      provider: 'firebase',
      email: cred.user.email
    });
    try {
      await updateProfile(cred.user, { displayName: profile.displayName });
    } catch (_) {}
    await saveProfile(profile);
    writeSession(profile);
    return profile;
  } catch (err) {
    throw new Error(translateAuthError(err.code || err.message));
  }
}

export async function loginUser(username, password) {
  const name = normalizeUsername(username);
  if (!name || !password) throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');

  if (!isFirebaseConfigured) {
    const local = await dbManager.loginUser(name, password);
    const session = { ...local, provider: 'local' };
    delete session.passwordHash;
    writeSession(session);
    return session;
  }

  const { auth } = getFirebaseServices();
  if (!auth) throw new Error('Firebase chưa sẵn sàng. Kiểm tra cấu hình .env.');

  try {
    const cred = await signInWithEmailAndPassword(auth, usernameToEmail(name), password);
    const stored = readSession();
    const profile = await loadProfile(cred.user.uid, stored?.username || name);
    const user = profile || createPlayerProfile({
      uid: cred.user.uid,
      username: name,
      displayName: cred.user.displayName || '',
      provider: 'firebase',
      email: cred.user.email
    });
    writeSession(user);
    return user;
  } catch (err) {
    throw new Error(translateAuthError(err.code || err.message));
  }
}

export async function logoutUser() {
  cachedUser = null;
  writeSession(null);

  if (!isFirebaseConfigured) return true;

  const { auth } = getFirebaseServices();
  if (!auth) return true;

  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[Auth] Đăng xuất Firebase thất bại:', err.message);
  }
  return true;
}

export function getCachedUser() {
  return cachedUser || readSession();
}
