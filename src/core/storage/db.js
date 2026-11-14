/**
 * Triarhythm Database - Lưu trữ Beatmaps, Tài khoản & Cài đặt qua IndexedDB
 * Hỗ trợ lưu trữ offline toàn bộ file audio, video, beatmap JSON và lịch sử điểm số.
 */

const DB_NAME = 'TriarhythmDB';
const DB_VERSION = 2;

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async getDB() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Bảng 1: Beatmaps (kho lưu trữ các bài hát đã nạp / tự tạo)
        let beatmapStore;
        if (!db.objectStoreNames.contains('beatmaps')) {
          beatmapStore = db.createObjectStore('beatmaps', { keyPath: 'id' });
          beatmapStore.createIndex('title', 'title', { unique: false });
          beatmapStore.createIndex('artist', 'artist', { unique: false });
          beatmapStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          beatmapStore.createIndex('deletedAt', 'deletedAt', { unique: false });
        } else {
          beatmapStore = e.target.transaction.objectStore('beatmaps');
          if (!beatmapStore.indexNames.contains('deletedAt')) {
            beatmapStore.createIndex('deletedAt', 'deletedAt', { unique: false });
          }
        }

        // Bảng 2: Users (tài khoản, mật khẩu, hồ sơ người chơi)
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'username' });
          userStore.createIndex('username', 'username', { unique: true });
        }

        // Bảng 3: Scores (bảng điểm và kỷ lục người chơi)
        if (!db.objectStoreNames.contains('scores')) {
          const scoreStore = db.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
          scoreStore.createIndex('beatmapId', 'beatmapId', { unique: false });
          scoreStore.createIndex('username', 'username', { unique: false });
        }

        // Bảng 4: Settings (cấu hình AstroDX)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[TriarhythmDB] Lỗi mở cơ sở dữ liệu IndexedDB:', e.target.error);
        reject(e.target.error);
      };
    });

    return this.initPromise;
  }

  // =========================================================================
  // 1. Quản lý Beatmaps
  // =========================================================================

  async getAllBeatmaps(options = {}) {
    const { includeDeleted = false } = options;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readonly');
      const store = tx.objectStore('beatmaps');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        if (includeDeleted) {
          resolve(list);
        } else {
          resolve(list.filter((b) => !b.deletedAt));
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getDeletedBeatmaps() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readonly');
      const store = tx.objectStore('beatmaps');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        resolve(list.filter((b) => Boolean(b.deletedAt)));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getBeatmap(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readonly');
      const store = tx.objectStore('beatmaps');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveBeatmap(beatmapData) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readwrite');
      const store = tx.objectStore('beatmaps');
      const item = {
        ...beatmapData,
        id: beatmapData.id || beatmapData.metadata?.id || `map_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: beatmapData.metadata?.title || beatmapData.title || 'Untitled Track',
        artist: beatmapData.metadata?.artist || beatmapData.artist || 'Unknown Artist',
        difficultyName: beatmapData.metadata?.difficultyName || beatmapData.difficultyName || 'Normal',
        updatedAt: Date.now()
      };
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Soft Delete Beatmap: Đánh dấu cờ deletedAt thay vì xóa vĩnh viễn,
   * cho phép người dùng Hoàn tác (Undo / Ctrl+Z) hoặc khôi phục từ Thùng rác.
   */
  async softDeleteBeatmap(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readwrite');
      const store = tx.objectStore('beatmaps');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) {
          resolve(false);
          return;
        }
        item.deletedAt = Date.now();
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve(item);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Hoàn tác xóa / Khôi phục Beatmap từ Thùng rác
   */
  async restoreBeatmap(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readwrite');
      const store = tx.objectStore('beatmaps');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) {
          resolve(false);
          return;
        }
        delete item.deletedAt;
        item.updatedAt = Date.now();
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve(item);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Xóa vĩnh viễn Beatmap khỏi IndexedDB (không thể hoàn tác)
   */
  async permanentlyDeleteBeatmap(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readwrite');
      const store = tx.objectStore('beatmaps');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Dọn sạch toàn bộ bài hát trong thùng rác
   */
  async clearTrash() {
    const trashed = await this.getDeletedBeatmaps();
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('beatmaps', 'readwrite');
      const store = tx.objectStore('beatmaps');
      for (const m of trashed) {
        store.delete(m.id);
      }
      tx.oncomplete = () => resolve(trashed.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Mặc định deleteBeatmap chuyển thành soft-delete an toàn
   */
  async deleteBeatmap(id) {
    return await this.softDeleteBeatmap(id);
  }

  // =========================================================================
  // 2. Quản lý Tài khoản & Mật khẩu (Auth)
  // =========================================================================

  // Hash đơn giản cho lưu trữ local client-side
  hashPassword(password) {
    let hash = 0;
    const str = `${password}_triarhythm_salt_2026`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(16);
  }

  async registerUser(username, password, displayName = '') {
    const db = await this.getDB();
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');

    const existing = await this.getUser(cleanUser);
    if (existing) throw new Error('Tên tài khoản này đã tồn tại!');

    const userObj = {
      username: cleanUser,
      displayName: displayName.trim() || username.trim(),
      passwordHash: this.hashPassword(password),
      avatar: '🌟',
      rating: 12.50,
      dan: '初段 (1st Dan)',
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const req = store.add(userObj);
      req.onsuccess = () => resolve(userObj);
      req.onerror = () => reject(req.error);
    });
  }

  async loginUser(username, password) {
    const cleanUser = username.trim().toLowerCase();
    const user = await this.getUser(cleanUser);
    if (!user) throw new Error('Tài khoản không tồn tại!');

    if (user.passwordHash !== this.hashPassword(password)) {
      throw new Error('Mật khẩu không chính xác!');
    }

    return user;
  }

  async getUser(username) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const req = store.get(username.trim().toLowerCase());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllUsers() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // =========================================================================
  // 3. Quản lý Lịch sử Điểm & Thành tích (Scores)
  // =========================================================================

  async saveScore(scoreRecord) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('scores', 'readwrite');
      const store = tx.objectStore('scores');
      const record = {
        ...scoreRecord,
        playedAt: Date.now()
      };
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getScoresByBeatmap(beatmapId) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('scores', 'readonly');
      const store = tx.objectStore('scores');
      const idx = store.index('beatmapId');
      const req = idx.getAll(beatmapId);
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.achievement - a.achievement);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Bí danh tương thích
  async getScoresForBeatmap(beatmapId) {
    return this.getScoresByBeatmap(beatmapId);
  }

  // =========================================================================
  // 4. Quản lý Cài đặt (Settings)
  // =========================================================================

  async getSetting(key, defaultValue = null) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result.value : defaultValue);
      req.onerror = () => reject(req.error);
    });
  }

  async setSetting(key, value) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  async getSettings() {
    return this.getSetting('userSettings', null);
  }

  async saveSettings(settings) {
    return this.setSetting('userSettings', settings);
  }
}

export const dbManager = new DatabaseManager();
