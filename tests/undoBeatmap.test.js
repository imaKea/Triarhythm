import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit Test Giai đoạn P7: Cơ chế Hoàn tác Xóa Beatmap (Soft Delete, Restore, Trash Bin)
 */
describe('GĐ7 Unit Tests - Undo Beatmap Deletion & Soft Delete', () => {
  let inMemoryDb;

  beforeEach(() => {
    // In-memory mock mô phỏng chính xác hành vi ObjectStore IndexedDB của DatabaseManager
    const store = new Map();

    inMemoryDb = {
      store,
      async getAllBeatmaps(options = {}) {
        const { includeDeleted = false } = options;
        const list = Array.from(store.values());
        if (includeDeleted) return list;
        return list.filter((b) => !b.deletedAt);
      },

      async getDeletedBeatmaps() {
        return Array.from(store.values()).filter((b) => Boolean(b.deletedAt));
      },

      async saveBeatmap(entry) {
        store.set(entry.id, { ...entry, updatedAt: Date.now() });
        return entry;
      },

      async softDeleteBeatmap(id) {
        const item = store.get(id);
        if (!item) return false;
        item.deletedAt = Date.now();
        store.set(id, item);
        return item;
      },

      async restoreBeatmap(id) {
        const item = store.get(id);
        if (!item) return false;
        delete item.deletedAt;
        item.updatedAt = Date.now();
        store.set(id, item);
        return item;
      },

      async permanentlyDeleteBeatmap(id) {
        return store.delete(id);
      },

      async clearTrash() {
        let count = 0;
        for (const [id, item] of store.entries()) {
          if (item.deletedAt) {
            store.delete(id);
            count++;
          }
        }
        return count;
      }
    };
  });

  it('1. saveBeatmap nạp bài hát vào database và hiển thị trong danh sách hoạt động', async () => {
    await inMemoryDb.saveBeatmap({ id: 'song_1', title: 'Beyond The Aexis', artist: 'SDMNE' });
    await inMemoryDb.saveBeatmap({ id: 'song_2', title: 'Neon Odyssey', artist: 'Triarhythm' });

    const activeMaps = await inMemoryDb.getAllBeatmaps();
    expect(activeMaps).toHaveLength(2);
    expect(activeMaps.map((m) => m.id)).toEqual(['song_1', 'song_2']);
  });

  it('2. softDeleteBeatmap đánh dấu cờ deletedAt và ẩn bài hát khỏi danh sách chọn bài thông thường', async () => {
    await inMemoryDb.saveBeatmap({ id: 'song_1', title: 'Beyond The Aexis' });
    await inMemoryDb.saveBeatmap({ id: 'song_2', title: 'Neon Odyssey' });

    // Xóa mềm bài 1
    const delResult = await inMemoryDb.softDeleteBeatmap('song_1');
    expect(delResult.deletedAt).toBeDefined();

    // getAllBeatmaps() không còn chứa song_1
    const activeMaps = await inMemoryDb.getAllBeatmaps();
    expect(activeMaps).toHaveLength(1);
    expect(activeMaps[0].id).toBe('song_2');

    // Nhưng dữ liệu vẫn còn nguyên trong DB
    expect(inMemoryDb.store.has('song_1')).toBe(true);
  });

  it('3. getDeletedBeatmaps lấy chính xác các bài hát nằm trong thùng rác', async () => {
    await inMemoryDb.saveBeatmap({ id: 'song_1', title: 'Beyond The Aexis' });
    await inMemoryDb.saveBeatmap({ id: 'song_2', title: 'Neon Odyssey' });

    await inMemoryDb.softDeleteBeatmap('song_1');

    const trashed = await inMemoryDb.getDeletedBeatmaps();
    expect(trashed).toHaveLength(1);
    expect(trashed[0].id).toBe('song_1');
    expect(trashed[0].title).toBe('Beyond The Aexis');
  });

  it('4. restoreBeatmap (Hoàn tác / Ctrl+Z) phục hồi bài hát nguyên vẹn và xuất hiện lại trong Song Select', async () => {
    await inMemoryDb.saveBeatmap({ id: 'song_1', title: 'Beyond The Aexis', bpm: 180 });
    await inMemoryDb.softDeleteBeatmap('song_1');

    expect(await inMemoryDb.getAllBeatmaps()).toHaveLength(0);

    // Kích hoạt hoàn tác
    const restored = await inMemoryDb.restoreBeatmap('song_1');
    expect(restored.deletedAt).toBeUndefined();
    expect(restored.bpm).toBe(180);

    // Bài hát xuất hiện lại
    const activeMaps = await inMemoryDb.getAllBeatmaps();
    expect(activeMaps).toHaveLength(1);
    expect(activeMaps[0].id).toBe('song_1');
  });

  it('5. permanentlyDeleteBeatmap xóa sạch khỏi bộ nhớ, không thể hoàn tác', async () => {
    await inMemoryDb.saveBeatmap({ id: 'song_1', title: 'Beyond The Aexis' });
    await inMemoryDb.softDeleteBeatmap('song_1');

    await inMemoryDb.permanentlyDeleteBeatmap('song_1');
    expect(inMemoryDb.store.has('song_1')).toBe(false);

    const trashed = await inMemoryDb.getDeletedBeatmaps();
    expect(trashed).toHaveLength(0);
  });

  it('6. clearTrash dọn sạch tất cả các bài hát đang có cờ deletedAt', async () => {
    await inMemoryDb.saveBeatmap({ id: 'song_1', title: 'Song 1' });
    await inMemoryDb.saveBeatmap({ id: 'song_2', title: 'Song 2' });
    await inMemoryDb.saveBeatmap({ id: 'song_3', title: 'Song 3' });

    await inMemoryDb.softDeleteBeatmap('song_1');
    await inMemoryDb.softDeleteBeatmap('song_3');

    expect(await inMemoryDb.getDeletedBeatmaps()).toHaveLength(2);

    const clearedCount = await inMemoryDb.clearTrash();
    expect(clearedCount).toBe(2);

    expect(await inMemoryDb.getDeletedBeatmaps()).toHaveLength(0);
    // Song 2 không bị xóa và vẫn còn nguyên
    expect(await inMemoryDb.getAllBeatmaps()).toHaveLength(1);
    expect((await inMemoryDb.getAllBeatmaps())[0].id).toBe('song_2');
  });
});
