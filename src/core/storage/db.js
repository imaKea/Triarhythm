/**
 * Triarhythm Database - Lưu trữ Beatmaps, Tài khoản & Cài đặt qua IndexedDB
 * Hỗ trợ lưu trữ offline toàn bộ file audio, video, beatmap JSON và lịch sử điểm số.
 */

const DB_NAME = 'TriarhythmDB';
const DB_VERSION = 3;

function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    let requestError;
    tx.oncomplete = resolve;
    tx.onerror = (event) => {
      requestError = event.target?.error || tx.error || requestError;
    };
    tx.onabort = () => reject(tx.error || requestError || new Error('IndexedDB transaction was aborted.'));
  });
}

async function getCollectionsDB(manager) {
  let db = await manager.getDB();
  if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || db.objectStoreNames.contains('collections')) {
    return db;
  }

  db.close();
  manager.db = null;
  manager.initPromise = null;
  db = await DatabaseManager.prototype.getDB.call(manager);
  return db;
}

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

        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
          this.initPromise = null;
        };
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[TriarhythmDB] Lỗi mở cơ sở dữ liệu IndexedDB:', e.target.error);
        reject(e.target.error);
      };
    });
    this.initPromise = this.initPromise.catch((error) => {
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
  }

  // =========================================================================
  // 1. Quản lý Beatmaps
  // =========================================================================

  async getAllBeatmaps(options = {}) {
    const { includeDeleted = false } = options;
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('beatmaps').getAll();
    let list = [];
    req.onsuccess = () => {
      list = req.result || [];
    };
    await transaction;
    return includeDeleted ? list : list.filter((b) => !b.deletedAt);
  }

  async getDeletedBeatmaps() {
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('beatmaps').getAll();
    let list = [];
    req.onsuccess = () => {
      list = req.result || [];
    };
    await transaction;
    return list.filter((b) => Boolean(b.deletedAt));
  }

  async getBeatmap(id) {
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('beatmaps').get(id);
    let item = null;
    req.onsuccess = () => {
      item = req.result || null;
    };
    await transaction;
    return item;
  }

  async saveBeatmap(beatmapData) {
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const item = {
      ...beatmapData,
      id: beatmapData.id || beatmapData.metadata?.id || `map_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: beatmapData.metadata?.title || beatmapData.title || 'Untitled Track',
      artist: beatmapData.metadata?.artist || beatmapData.artist || 'Unknown Artist',
      difficultyName: beatmapData.metadata?.difficultyName || beatmapData.difficultyName || 'Normal',
      updatedAt: Date.now()
    };
    const transaction = waitForTransaction(tx);
    tx.objectStore('beatmaps').put(item);
    await transaction;
    return item;
  }

  /**
   * Soft Delete Beatmap: Đánh dấu cờ deletedAt thay vì xóa vĩnh viễn,
   * cho phép người dùng Hoàn tác (Undo / Ctrl+Z) hoặc khôi phục từ Thùng rác.
   */
  async softDeleteBeatmap(id) {
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('beatmaps');
    const getReq = store.get(id);
    let result = false;
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return;
      item.deletedAt = Date.now();
      store.put(item);
      result = item;
    };
    await transaction;
    return result;
  }

  /**
   * Xóa tạm nhiều beatmap cùng lúc (Bulk Soft Delete)
   */
  async softDeleteBeatmaps(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return 0;
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('beatmaps');
    let count = 0;
    for (const id of list) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.isDeleted = 1;
          item.deletedAt = Date.now();
          store.put(item);
          count++;
        }
      };
    }
    await transaction;
    return count;
  }

  /**
   * Hoàn tác xóa / Khôi phục Beatmap từ Thùng rác
   */
  async restoreBeatmap(id) {
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('beatmaps');
    const getReq = store.get(id);
    let result = false;
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return;
      delete item.deletedAt;
      item.isDeleted = 0;
      item.updatedAt = Date.now();
      store.put(item);
      result = item;
    };
    await transaction;
    return result;
  }

  /**
   * Khôi phục nhiều beatmap cùng lúc từ Thùng rác (Bulk Restore)
   */
  async restoreBeatmaps(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return 0;
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('beatmaps');
    let count = 0;
    for (const id of list) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          delete item.deletedAt;
          item.isDeleted = 0;
          item.updatedAt = Date.now();
          store.put(item);
          count++;
        }
      };
    }
    await transaction;
    return count;
  }

  /**
   * Xóa vĩnh viễn Beatmap khỏi IndexedDB (không thể hoàn tác)
   */
  async permanentlyDeleteBeatmap(id) {
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const transaction = waitForTransaction(tx);
    tx.objectStore('beatmaps').delete(id);
    await transaction;
    return true;
  }

  /**
   * Xóa vĩnh viễn nhiều Beatmap cùng lúc (Bulk Permanent Delete)
   */
  async permanentlyDeleteBeatmaps(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return 0;
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('beatmaps');
    for (const id of list) {
      store.delete(id);
    }
    await transaction;
    return list.length;
  }

  /**
   * Dọn sạch toàn bộ bài hát trong thùng rác
   */
  async clearTrash() {
    const trashed = await this.getDeletedBeatmaps();
    const db = await this.getDB();
    const tx = db.transaction('beatmaps', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('beatmaps');
    for (const m of trashed) {
      store.delete(m.id);
    }
    await transaction;
    return trashed.length;
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
    if (!cleanUser || !password) throw new Error('Please enter both username and password.');

    const existing = await this.getUser(cleanUser);
    if (existing) throw new Error('This username already exists!');

    const userObj = {
      username: cleanUser,
      displayName: displayName.trim() || username.trim(),
      passwordHash: this.hashPassword(password),
      avatar: '🌟',
      rating: 12.50,
      dan: '初段 (1st Dan)',
      createdAt: Date.now()
    };

    const tx = db.transaction('users', 'readwrite');
    const transaction = waitForTransaction(tx);
    tx.objectStore('users').add(userObj);
    await transaction;
    return userObj;
  }

  async loginUser(username, password) {
    const cleanUser = username.trim().toLowerCase();
    const user = await this.getUser(cleanUser);
    if (!user) throw new Error('Account does not exist!');

    if (user.passwordHash !== this.hashPassword(password)) {
      throw new Error('Incorrect password!');
    }

    return user;
  }

  async getUser(username) {
    const db = await this.getDB();
    const tx = db.transaction('users', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('users').get(username.trim().toLowerCase());
    let user = null;
    req.onsuccess = () => {
      user = req.result || null;
    };
    await transaction;
    return user;
  }

  async getAllUsers() {
    const db = await this.getDB();
    const tx = db.transaction('users', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('users').getAll();
    let users = [];
    req.onsuccess = () => {
      users = req.result || [];
    };
    await transaction;
    return users;
  }

  // =========================================================================
  // 3. Quản lý Lịch sử Điểm & Thành tích (Scores)
  // =========================================================================

  async saveScore(scoreRecord) {
    const db = await this.getDB();
    const tx = db.transaction('scores', 'readwrite');
    const transaction = waitForTransaction(tx);
    const record = {
      ...scoreRecord,
      playedAt: Date.now()
    };
    const req = tx.objectStore('scores').add(record);
    await transaction;
    return req.result;
  }

  async getAllCollections() {
    const db = await getCollectionsDB(this);
    const tx = db.transaction('collections', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('collections').getAll();
    let collections = [];
    req.onsuccess = () => {
      collections = req.result || [];
    };
    await transaction;
    return collections;
  }

  async createCollection(name, beatmapId) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) throw new Error('Collection name is required.');
    if (beatmapId === undefined || beatmapId === null) {
      throw new Error('A beatmap is required to create a collection.');
    }

    const db = await getCollectionsDB(this);
    const collection = {
      id: `collection_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      beatmapIds: [beatmapId],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const tx = db.transaction('collections', 'readwrite');
    const transaction = waitForTransaction(tx);
    tx.objectStore('collections').add(collection);
    await transaction;
    return collection;
  }

  async addBeatmapToCollection(collectionId, beatmapId) {
    if (beatmapId === undefined || beatmapId === null) {
      throw new Error('A beatmap is required.');
    }

    const db = await getCollectionsDB(this);
    const tx = db.transaction('collections', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('collections');
    const req = store.get(collectionId);
    let result = null;
    req.onsuccess = () => {
      const collection = req.result;
      if (!collection) return;

      collection.beatmapIds = Array.isArray(collection.beatmapIds) ? collection.beatmapIds : [];
      const added = !collection.beatmapIds.includes(beatmapId);
      if (added) {
        collection.beatmapIds.push(beatmapId);
        collection.updatedAt = Date.now();
        store.put(collection);
      }
      result = { collection, added };
    };
    await transaction;
    return result;
  }

  async removeBeatmapFromCollection(collectionId, beatmapId) {
    const db = await getCollectionsDB(this);
    const tx = db.transaction('collections', 'readwrite');
    const transaction = waitForTransaction(tx);
    const store = tx.objectStore('collections');
    const req = store.get(collectionId);
    let removed = false;
    req.onsuccess = () => {
      const collection = req.result;
      if (!collection || !Array.isArray(collection.beatmapIds)) return;

      const nextIds = collection.beatmapIds.filter((id) => id !== beatmapId);
      removed = nextIds.length !== collection.beatmapIds.length;
      if (removed) {
        collection.beatmapIds = nextIds;
        collection.updatedAt = Date.now();
        store.put(collection);
      }
    };
    await transaction;
    return removed;
  }

  async deleteCollection(collectionId) {
    const db = await getCollectionsDB(this);
    const tx = db.transaction('collections', 'readwrite');
    const transaction = waitForTransaction(tx);
    tx.objectStore('collections').delete(collectionId);
    await transaction;
    return true;
  }

  async getScoresByBeatmap(beatmapId) {
    const db = await this.getDB();
    const tx = db.transaction('scores', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('scores').index('beatmapId').getAll(beatmapId);
    let scores = [];
    req.onsuccess = () => {
      scores = req.result || [];
    };
    await transaction;
    return scores.sort((a, b) => (b.score || 0) - (a.score || 0));
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
    const tx = db.transaction('settings', 'readonly');
    const transaction = waitForTransaction(tx);
    const req = tx.objectStore('settings').get(key);
    let value = defaultValue;
    req.onsuccess = () => {
      value = req.result !== undefined ? req.result.value : defaultValue;
    };
    await transaction;
    return value;
  }

  async setSetting(key, value) {
    const db = await this.getDB();
    const tx = db.transaction('settings', 'readwrite');
    const transaction = waitForTransaction(tx);
    tx.objectStore('settings').put({ key, value });
    await transaction;
    return value;
  }

  async getSettings() {
    return this.getSetting('userSettings', null);
  }

  async saveSettings(settings) {
    return this.setSetting('userSettings', settings);
  }
}

export const dbManager = new DatabaseManager();

// Đảm bảo tương thích tuyệt đối cho HMR nóng và mọi trường hợp runtime
if (!dbManager.softDeleteBeatmaps) {
  dbManager.softDeleteBeatmaps = async function (ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    return (await Promise.all(list.map((id) => this.softDeleteBeatmap(id)))).length;
  };
}
if (!dbManager.restoreBeatmaps) {
  dbManager.restoreBeatmaps = async function (ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    return (await Promise.all(list.map((id) => this.restoreBeatmap(id)))).length;
  };
}
if (!dbManager.permanentlyDeleteBeatmaps) {
  dbManager.permanentlyDeleteBeatmaps = async function (ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    return (await Promise.all(list.map((id) => this.permanentlyDeleteBeatmap(id)))).length;
  };
}
for (const method of [
  'getAllCollections',
  'createCollection',
  'addBeatmapToCollection',
  'removeBeatmapFromCollection',
  'deleteCollection'
]) {
  if (!dbManager[method]) {
    dbManager[method] = function (...args) {
      return DatabaseManager.prototype[method].apply(this, args);
    };
  }
}
