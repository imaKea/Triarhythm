import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import {
  slugify,
  inferDifficultyLevel,
  buildSongId,
  buildSongEntry,
  parseFiles,
  importFiles
} from '../src/core/parser/importService.js';

const osuPath = fileURLToPath(new URL(
  './fixtures/beyond-the-aexis/2025310 SDMNE - Beyond The Aexis/SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu',
  import.meta.url
));
const osuContent = fs.readFileSync(osuPath, 'utf8');

function makeOsuFile(content = osuContent) {
  return {
    name: 'SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu',
    type: 'text/plain',
    text: async () => content
  };
}

function makeFakeDb() {
  const store = new Map();
  return {
    store,
    getBeatmap: vi.fn(async (id) => store.get(id) || null),
    saveBeatmap: vi.fn(async (entry) => {
      store.set(entry.id, entry);
      return entry.id;
    })
  };
}

describe('slugify', () => {
  it('chuẩn hoá chữ hoa, khoảng trắng và ký tự đặc biệt', () => {
    expect(slugify('Hello World!')).toBe('hello_world');
    expect(slugify('  --Test__Song--  ')).toBe('test__song');
    expect(slugify('A/B:C')).toBe('a_b_c');
  });

  it('loại bỏ dấu tiếng Việt', () => {
    expect(slugify('Đường Về')).toBe('duong_ve');
  });

  it('giá trị rỗng trả về chuỗi rỗng', () => {
    expect(slugify('')).toBe('');
    expect(slugify()).toBe('');
  });
});

describe('inferDifficultyLevel', () => {
  it('suy ra level từ tên difficulty', () => {
    expect(inferDifficultyLevel('Re:Master')).toBe('14');
    expect(inferDifficultyLevel('Master')).toBe('13');
    expect(inferDifficultyLevel('Expert')).toBe('12');
    expect(inferDifficultyLevel('Insane')).toBe('12');
    expect(inferDifficultyLevel('Hard')).toBe('9');
    expect(inferDifficultyLevel('Normal')).toBe('6');
    expect(inferDifficultyLevel('Easy')).toBe('3');
  });

  it('mặc định level 10 với tên lạ', () => {
    expect(inferDifficultyLevel('Soulless Wanderers')).toBe('10');
  });
});

describe('buildSongId', () => {
  it('maimai dùng title + artist', () => {
    const primary = { metadata: { source: 'maimai', title: 'Test Song', artist: 'Some Artist' } };
    expect(buildSongId({ kind: 'maidata', primary })).toBe('maimai_test_song_some_artist');
  });

  it('osu package 7K ưu tiên beatmapSetId', () => {
    const primary = { keys: 7, metadata: { title: 'T', beatmapSetId: 12345 } };
    expect(buildSongId({ kind: 'package', primary })).toBe('osu_7k_set_12345');
  });

  it('osu package 5K không có set id dùng title/artist', () => {
    const primary = { keys: 5, metadata: { title: 'Song Name', artist: 'Artist' } };
    expect(buildSongId({ kind: 'package', primary })).toBe('osu_5k_song_name_artist');
  });

  it('file .osu đơn lẻ giữ difficulty trong ID', () => {
    const primary = { keys: 7, metadata: { title: 'Song', artist: 'Artist' } };
    expect(buildSongId({ kind: 'osu', primary, difficultyName: 'Soulless Wanderers' }))
      .toBe('osu_7k_song_soulless_wanderers');
  });
});

describe('buildSongEntry', () => {
  it('dựng record đầy đủ từ chart + assets', () => {
    const beatmap = {
      keys: 7,
      metadata: { id: 'osu-1', title: 'My Song', artist: 'My Artist', creator: 'Mapper' },
      notes: [{ type: 'tap', time: 0, lane: 0 }]
    };
    const entry = buildSongEntry({
      kind: 'package',
      charts: [{ difficultyName: 'Master', difficultyLevel: '13', beatmap, noteCount: 1 }],
      primary: beatmap,
      fileName: 'My Song.osz',
      sourcePackageBlob: new Blob(['package']),
      sourceText: 'original map text',
      sourceFileName: 'My Song.osz'
    });

    expect(entry.source).toBe('osu');
    expect(entry.title).toBe('My Song');
    expect(entry.artist).toBe('My Artist');
    expect(entry.creator).toBe('Mapper');
    expect(entry.difficulties).toHaveLength(1);
    expect(entry.beatmap).toBe(beatmap);
    expect(entry.audioBlob).toBeNull();
    expect(entry.audioSource).toBeNull();
    expect(entry.sourcePackageBlob).toBeInstanceOf(Blob);
    expect(entry.sourceText).toBe('original map text');
    expect(entry.sourceFileName).toBe('My Song.osz');
  });

  it('ném lỗi khi không có beatmap', () => {
    expect(() => buildSongEntry({ charts: [] })).toThrow(/beatmap/i);
  });
});

describe('parseFiles', () => {
  it('keeps the original maimai zip and its filename when importing a package', async () => {
    const zip = new JSZip();
    zip.file('maidata.txt', '&title=Song\n&inote_1=8,E\n');
    zip.file('pv.mp4', 'video bytes');
    const packageFile = await zip.generateAsync({ type: 'blob' });
    Object.defineProperty(packageFile, 'name', { value: 'song-package.zip' });

    const parsed = await parseFiles([packageFile]);

    expect(parsed.sourcePackageBlob).toBe(packageFile);
    expect(parsed.sourceFileName).toBe('song-package.zip');
  });

  it('keeps all selected maimai files together in a zip package', async () => {
    const maidata = new Blob(['&title=Song\n&inote_1=8,E\n'], { type: 'text/plain' });
    Object.defineProperty(maidata, 'name', { value: 'maidata.txt' });
    const video = new Blob(['video bytes'], { type: 'video/mp4' });
    Object.defineProperties(video, {
      name: { value: 'pv.mp4' },
      webkitRelativePath: { value: 'Song/pv.mp4' }
    });

    const parsed = await parseFiles([maidata, video]);
    const zip = await JSZip.loadAsync(parsed.sourcePackageBlob);

    expect(await zip.file('maidata.txt').async('text')).toContain('&title=Song');
    expect(await zip.file('Song/pv.mp4').async('text')).toBe('video bytes');
  });

  it('phân tích file .osu đơn lẻ', async () => {
    const parsed = await parseFiles([makeOsuFile()], { preset: 'twoFingers' });
    expect(parsed.kind).toBe('osu');
    expect(parsed.charts).toHaveLength(1);
    expect(parsed.charts[0].difficultyName).toBeTruthy();
    expect(parsed.primary.metadata.title).toBe('Beyond The Æxis');
    expect(parsed.primary.notes.length).toBeGreaterThan(0);
    expect(parsed.sourceText).toBe(osuContent);
    expect(parsed.sourceFileName).toMatch(/\.osu$/i);
  });

  it('báo lỗi khi không nhận diện được file', async () => {
    await expect(parseFiles([{ name: 'readme.md', text: async () => '' }]))
      .rejects.toThrow(/Không nhận diện được file map/);
  });

  it('báo lỗi khi danh sách rỗng', async () => {
    await expect(parseFiles([])).rejects.toThrow(/Không có file nào/);
  });
});

describe('importFiles', () => {
  it('lưu map mới và trả về status saved', async () => {
    const db = makeFakeDb();
    const result = await importFiles([makeOsuFile()], {
      preset: 'twoFingers',
      db,
      syncMap: false
    });

    expect(result.status).toBe('saved');
    expect(result.kind).toBe('osu');
    expect(result.difficultyCount).toBe(1);
    expect(result.songEntry.title).toBe('Beyond The Æxis');
    expect(result.songEntry.sourceText).toBe(osuContent);
    expect(db.saveBeatmap).toHaveBeenCalledTimes(1);
    expect(db.store.has(result.songEntry.id)).toBe(true);
  });

  it('phát hiện map trùng theo ID ổn định', async () => {
    const db = makeFakeDb();
    const first = await importFiles([makeOsuFile()], { db, syncMap: false });
    const second = await importFiles([makeOsuFile()], { db, syncMap: false });

    expect(second.status).toBe('duplicate');
    expect(second.songEntry.id).toBe(first.songEntry.id);
    expect(db.saveBeatmap).toHaveBeenCalledTimes(1);
  });

  it('đồng bộ metadata map lên MySQL qua saveMap', async () => {
    const db = makeFakeDb();
    const saveMap = vi.fn(async () => ({ success: true }));

    const result = await importFiles([makeOsuFile()], {
      db,
      syncMap: true,
      saveMap
    });

    expect(saveMap).toHaveBeenCalledTimes(1);
    const payload = saveMap.mock.calls[0][0];
    expect(payload.song_id).toBe(result.songEntry.id);
    expect(payload.title).toBe(result.songEntry.title);
    expect(Array.isArray(payload.difficulties)).toBe(true);
    expect(payload.difficulties.length).toBe(1);
  });

  it('upload asset và lưu serverAssets vào IndexedDB', async () => {
    const db = makeFakeDb();
    const audio = { name: 'audio.ogg', type: 'audio/ogg', size: 16 };
    const saveMap = vi.fn(async () => ({}));
    const saveAssets = vi.fn(async () => ({
      assets: { audio_url: '/storage/beatmaps/x/audio.ogg', cover_url: null, video_url: null }
    }));

    const result = await importFiles([makeOsuFile(), audio], {
      db,
      syncMap: true,
      saveMap,
      saveAssets
    });

    expect(saveAssets).toHaveBeenCalledTimes(1);
    expect(result.songEntry.serverAssets.audioUrl).toBe('/storage/beatmaps/x/audio.ogg');
    const stored = db.store.get(result.songEntry.id);
    expect(stored.serverAssets.audioUrl).toBe('/storage/beatmaps/x/audio.ogg');
  });

  it('không gán serverAssets khi upload trả về rỗng', async () => {
    const db = makeFakeDb();
    const audio = { name: 'audio.ogg', type: 'audio/ogg', size: 16 };
    const saveAssets = vi.fn(async () => null);

    const result = await importFiles([makeOsuFile(), audio], {
      db,
      syncMap: true,
      saveMap: vi.fn(async () => ({})),
      saveAssets
    });

    expect(result.songEntry.serverAssets).toBeUndefined();
  });

  it('không chặn import khi đồng bộ MySQL thất bại', async () => {
    const db = makeFakeDb();
    const saveMap = vi.fn(async () => {
      throw new Error('mysql down');
    });

    const result = await importFiles([makeOsuFile()], { db, syncMap: true, saveMap });
    expect(result.status).toBe('saved');
    expect(db.store.has(result.songEntry.id)).toBe(true);
  });
});
