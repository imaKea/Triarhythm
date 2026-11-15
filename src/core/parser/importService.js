/**
 * ImportService - một luồng nhập map duy nhất cho toàn ứng dụng.
 *
 * Hỗ trợ:
 *  - Gói .osz / .zip (osu! hoặc maimai kèm maidata.txt)  -> importPackage()
 *  - File đơn .osu (+ audio/background rời)              -> parseOsu()
 *  - File đơn maidata.txt (+ audio/background rời)       -> parseMaimai()
 *
 * Trách nhiệm:
 *  - Nhận diện loại gói, parse toàn bộ difficulty
 *  - Sinh ID ổn định (cùng một map luôn ra cùng ID để chống trùng)
 *  - Dựng songEntry đúng chuẩn dbManager.saveBeatmap
 *  - Kiểm tra trùng trong IndexedDB và lưu
 *  - Đồng bộ metadata beatmap lên MySQL (Laravel API) — nguồn sự thật của dự án
 *
 * UI (App.jsx, AstroSongSelect.jsx) chỉ cần gọi importFiles() và hiển thị kết quả.
 */

import { importPackage } from './packageImporter.js';
import { parseOsu } from './osuParser.js';
import { parseMaimai } from './maimaiParser.js';
import JSZip from 'jszip';
import { dbManager } from '../storage/db.js';
import { apiClient } from '../api/client.js';

const AUDIO_REGEX = /\.(mp3|ogg|wav|m4a|aac|flac)$/i;
const IMAGE_REGEX = /\.(jpg|jpeg|png|webp)$/i;
const VIDEO_REGEX = /\.(mp4|webm|avi|flv|mkv|mov)$/i;

export function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');
}

export function inferDifficultyLevel(difficultyName = '') {
  const lower = String(difficultyName).toLowerCase();
  if (lower.includes('re:master') || lower.includes('remaster')) return '14';
  if (lower.includes('master')) return '13';
  if (lower.includes('insane') || lower.includes('expert')) return '12';
  if (lower.includes('hard') || lower.includes('advanced')) return '9';
  if (lower.includes('normal')) return '6';
  if (lower.includes('easy') || lower.includes('beginner') || lower.includes('basic')) return '3';
  return '10';
}

function isMaimaiBeatmap(beatmap) {
  return beatmap?.metadata?.source === 'maimai';
}

/**
 * Sinh ID ổn định cho bài hát.
 */
export function buildSongId({ kind, primary, difficultyName, fileName = '' }) {
  const meta = primary?.metadata || {};
  const title = meta.title || fileName;

  if (isMaimaiBeatmap(primary)) {
    return `maimai_${slugify(title)}_${slugify(meta.artist || 'unknown')}`;
  }

  const keys = primary?.keys ? `${primary.keys}k` : 'std';

  if (kind === 'package') {
    if (meta.beatmapSetId) return `osu_${keys}_set_${slugify(meta.beatmapSetId)}`;
    return `osu_${keys}_${slugify(title)}_${slugify(meta.artist || 'unknown')}`;
  }

  // File .osu đơn lẻ: giữ difficulty trong ID để có thể nạp nhiều diff rời
  return `osu_${keys}_${slugify(title)}_${slugify(difficultyName || meta.difficultyName || 'normal')}`;
}

function makeObjectUrl(blob) {
  if (!blob) return null;
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      return URL.createObjectURL(blob);
    } catch (_) {
      return null;
    }
  }
  return null;
}

function chartToDifficulty(chart, idx) {
  const beatmap = chart.beatmap || chart;
  const name = chart.difficultyName || chart.version || beatmap?.metadata?.difficultyName || `Diff #${idx + 1}`;
  const level = chart.difficultyLevel || beatmap?.metadata?.difficultyLevel || inferDifficultyLevel(name);
  return {
    difficultyName: name,
    difficultyLevel: level,
    beatmap,
    noteCount: chart.noteCount ?? beatmap?.notes?.length ?? 0
  };
}

/**
 * Dựng bản ghi lưu IndexedDB từ kết quả parse.
 */
export function buildSongEntry({
  kind,
  charts,
  primary,
  assets = {},
  fileName = '',
  difficultyName = '',
  sourcePackageBlob = null,
  sourceText = null,
  sourceFileName = ''
}) {
  const normalizedCharts = (charts || []).map(chartToDifficulty);
  // Loại bỏ hoàn toàn Utage theo yêu cầu của hệ thống ("bỏ utage")
  const filteredCharts = normalizedCharts.filter((c) => {
    const name = (c.difficultyName || '').toLowerCase();
    return !name.includes('utage') && !name.includes('宴');
  });

  // Sắp xếp các độ khó chuẩn Maimai: Basic -> Advanced -> Expert -> Master -> Re:Master
  const MAIMAI_ORDER = { 'basic': 1, 'advanced': 2, 'expert': 3, 'master': 4, 're:master': 5 };
  filteredCharts.sort((a, b) => {
    const catA = (a.category || a.difficultyName || '').toLowerCase().replace(/[^a-z:]/g, '');
    const catB = (b.category || b.difficultyName || '').toLowerCase().replace(/[^a-z:]/g, '');
    const orderA = MAIMAI_ORDER[catA] || 99;
    const orderB = MAIMAI_ORDER[catB] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return (parseFloat(a.difficultyLevel) || 0) - (parseFloat(b.difficultyLevel) || 0);
  });

  // Mặc định ưu tiên chọn Master nếu có, nếu không thì Re:Master hoặc độ khó cao nhất / đầu tiên
  const defaultChart = filteredCharts.find((c) => (c.difficultyName || '').toLowerCase() === 'master')
    || filteredCharts.find((c) => (c.difficultyName || '').toLowerCase().includes('master'))
    || filteredCharts[filteredCharts.length - 1]
    || filteredCharts[0];

  const primaryBeatmap = primary || defaultChart?.beatmap;
  if (!primaryBeatmap) throw new Error('Không có beatmap hợp lệ để lưu.');

  const source = isMaimaiBeatmap(primaryBeatmap) ? 'maimai' : 'osu';
  const id = buildSongId({ kind, primary: primaryBeatmap, difficultyName, fileName });

  return {
    id,
    source,
    title: primaryBeatmap.metadata?.title || fileName.replace(/\.(osz|zip|osu|txt)$/i, '') || 'Untitled',
    artist: primaryBeatmap.metadata?.artist || 'Unknown Artist',
    creator: primaryBeatmap.metadata?.creator || (source === 'maimai' ? 'Maimai Mapper' : 'Unknown Mapper'),
    difficultyName: defaultChart?.difficultyName || 'Master',
    difficultyLevel: defaultChart?.difficultyLevel || '10',
    difficulties: filteredCharts,
    beatmap: defaultChart?.beatmap || primaryBeatmap,
    audioBlob: assets.audio || null,
    audioBuffer: assets.audioBuffer || null,
    audioSource: makeObjectUrl(assets.audio),
    backgroundBlob: assets.background || null,
    backgroundSource: makeObjectUrl(assets.background),
    videoBlob: assets.video || null,
    videoSource: makeObjectUrl(assets.video),
    hitsounds: assets.hitsounds || null,
    sourcePackageBlob,
    sourceText,
    sourceFileName,
    updatedAt: Date.now()
  };
}

/**
 * Chuyển songEntry (IndexedDB) sang payload MySQL của Laravel MapController.
 * Gửi kèm chart đầy đủ để các thiết bị khác có thể tải và chơi lại map.
 */
export function songEntryToMapPayload(songEntry) {
  const beatmap = songEntry?.beatmap || {};
  return {
    song_id: songEntry.id,
    title: songEntry.title,
    artist: songEntry.artist,
    creator: songEntry.creator,
    source: songEntry.source || 'maimai',
    bpm: beatmap.timingPoints?.[0]?.bpm || 120,
    preview_time: beatmap.metadata?.previewTime || 0,
    cover_url: songEntry.serverAssets?.coverUrl || null,
    audio_url: songEntry.serverAssets?.audioUrl || null,
    video_url: songEntry.serverAssets?.videoUrl || null,
    difficulties: (songEntry.difficulties || []).map((d) => ({
      difficultyName: d.difficultyName,
      difficultyLevel: d.difficultyLevel,
      noteCount: d.noteCount,
      stars: d.stars || 0,
      beatmap: d.beatmap || null
    })),
    metadata: beatmap.metadata || {}
  };
}

export function buildSongEntryFromServerMap(serverMap, assets = {}, existing = null) {
  if (!serverMap?.song_id) throw new Error('Server map is missing its song ID.');

  const source = serverMap.source || 'maimai';
  const metadata = {
    ...(serverMap.metadata || {}),
    id: serverMap.song_id,
    title: serverMap.title || serverMap.metadata?.title || 'Untitled Track',
    artist: serverMap.artist || serverMap.metadata?.artist || 'Unknown Artist',
    creator: serverMap.creator || serverMap.metadata?.creator || 'Mapper',
    source,
    previewTime: serverMap.preview_time || serverMap.metadata?.previewTime || 0
  };
  const difficulties = (serverMap.difficulties || [])
    .map((difficulty) => {
      const sourceChart = difficulty.beatmap || difficulty.chart;
      if (!Array.isArray(sourceChart?.notes)) return null;
      const difficultyName = difficulty.difficultyName || sourceChart.metadata?.difficultyName || 'Normal';
      const difficultyLevel = difficulty.difficultyLevel || sourceChart.metadata?.difficultyLevel || '5';
      const chartMetadata = {
        ...metadata,
        ...(sourceChart.metadata || {}),
        id: serverMap.song_id,
        title: metadata.title,
        artist: metadata.artist,
        difficultyName,
        difficultyLevel
      };
      return {
        ...difficulty,
        difficultyName,
        difficultyLevel,
        noteCount: difficulty.noteCount ?? sourceChart.notes.length,
        beatmap: { ...sourceChart, metadata: chartMetadata }
      };
    })
    .filter(Boolean);

  if (difficulties.length === 0) {
    throw new Error('This server map has no chart data. Re-import and upload the original map package first.');
  }

  const primaryDifficulty = difficulties.find((difficulty) =>
    String(difficulty.difficultyName).toLowerCase() === 'master'
  ) || difficulties[difficulties.length - 1];
  const serverAssets = {
    audioUrl: serverMap.audio_url || existing?.serverAssets?.audioUrl || null,
    coverUrl: serverMap.cover_url || existing?.serverAssets?.coverUrl || null,
    videoUrl: serverMap.video_url || existing?.serverAssets?.videoUrl || null
  };

  return {
    ...(existing || {}),
    id: serverMap.song_id,
    source,
    title: metadata.title,
    artist: metadata.artist,
    creator: metadata.creator,
    difficultyName: primaryDifficulty.difficultyName,
    difficultyLevel: primaryDifficulty.difficultyLevel,
    difficulties,
    beatmap: primaryDifficulty.beatmap,
    metadata,
    audioBlob: assets.audio || existing?.audioBlob || null,
    backgroundBlob: assets.background || existing?.backgroundBlob || null,
    videoBlob: assets.video || existing?.videoBlob || null,
    serverAssets,
    sourcePackageBlob: existing?.sourcePackageBlob || null,
    sourceText: existing?.sourceText || null,
    sourceFileName: existing?.sourceFileName || '',
    updatedAt: Date.now()
  };
}

/**
 * Đồng bộ payload map lên MySQL. Bỏ qua an toàn khi chạy ngoài trình duyệt (test/SSR).
 */
async function defaultSaveMap(payload) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  return apiClient.saveMap(payload);
}

/**
 * Chuẩn hoá response upload asset (`{ assets: { audio_url, ... } }`) về camelCase.
 */
export function serverAssetsFromResponse(res) {
  const assets = res?.assets || res || {};
  return {
    audioUrl: assets.audio_url || null,
    coverUrl: assets.cover_url || null,
    videoUrl: assets.video_url || null
  };
}

/**
 * Upload audio/background/video lên Laravel Storage. Bỏ qua khi không có asset.
 */
async function defaultSaveAssets(songEntry) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  const { audioBlob, backgroundBlob, videoBlob } = songEntry || {};
  if (!audioBlob && !backgroundBlob && !videoBlob) return null;
  return apiClient.uploadMapAssets(songEntry.id, {
    audio: audioBlob,
    background: backgroundBlob,
    video: videoBlob
  });
}

function assetsFromFiles(fileList) {
  const files = Array.from(fileList || []);
  const audio = files.find((f) => f?.type?.startsWith('audio/') || AUDIO_REGEX.test(f?.name || '')) || null;
  const background = files.find((f) => f?.type?.startsWith('image/') || IMAGE_REGEX.test(f?.name || '')) || null;
  const video = files.find((f) => f?.type?.startsWith('video/') || VIDEO_REGEX.test(f?.name || '')) || null;
  return { audio, background, video, audioBuffer: null, hitsounds: null };
}

function safeArchivePath(file) {
  const rawPath = file?.webkitRelativePath || file?.name || '';
  const parts = String(rawPath)
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map((part) => part.replace(/[:\x00-\x1F]/g, '_'));
  return parts.join('/') || 'file';
}

async function zipFiles(files) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(safeArchivePath(file), file);
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

/**
 * Parse danh sách File thành dữ liệu beatmap (chưa lưu DB).
 */
export async function parseFiles(fileList, options = {}) {
  const files = Array.from(fileList || []);
  if (files.length === 0) throw new Error('Không có file nào được chọn.');

  const packageFile = files.find((f) => /\.(osz|zip)$/i.test(f?.name || ''));
  const maidataFile = files.find((f) => /maidata\.txt$/i.test(f?.name || ''));

  if (packageFile) {
    const pkg = await importPackage(packageFile, options);
    return {
      kind: 'package',
      charts: pkg.charts,
      primary: pkg.primaryBeatmap,
      assets: pkg.assets || {},
      fileName: packageFile.name,
      sourceFileName: packageFile.name,
      sourcePackageBlob: packageFile
    };
  }

  if (maidataFile) {
    const text = await maidataFile.text();
    const parsed = parseMaimai(text, options);
    const charts = parsed.difficulties.map((d) => ({
      difficultyName: d.difficultyName,
      difficultyLevel: d.difficultyLevel,
      beatmap: d.beatmap,
      noteCount: d.noteCount
    }));
    return {
      kind: 'maidata',
      charts,
      primary: parsed.primaryBeatmap || charts[charts.length - 1]?.beatmap || charts[0]?.beatmap,
      assets: assetsFromFiles(files),
      fileName: maidataFile.name,
      sourcePackageBlob: await zipFiles(files),
      sourceText: text,
      sourceFileName: maidataFile.name
    };
  }

  const osuFile = files.find((f) => /\.osu$/i.test(f?.name || ''));
  if (osuFile) {
    const text = await osuFile.text();
    const parsed = parseOsu(text, options);
    return {
      kind: 'osu',
      charts: [{
        difficultyName: parsed.beatmap.metadata.difficultyName,
        difficultyLevel: inferDifficultyLevel(parsed.beatmap.metadata.difficultyName),
        beatmap: parsed.beatmap,
        noteCount: parsed.beatmap.notes.length
      }],
      primary: parsed.beatmap,
      assets: assetsFromFiles(files),
      fileName: osuFile.name,
      sourceText: text,
      sourceFileName: osuFile.name
    };
  }

  throw new Error('Không nhận diện được file map. Hỗ trợ: .osz, .zip, .osu, maidata.txt.');
}

/**
 * Nhập và lưu map vào IndexedDB (và đồng bộ metadata lên MySQL).
 *
 * @param {FileList|File[]} fileList
 * @param {Object} options
 * @param {'twoFingers'|string} [options.preset]
 * @param {boolean} [options.autoSlide]
 * @param {Object} [options.db] - inject fake DB khi test
 * @param {boolean} [options.syncMap=true] - đồng bộ metadata lên Laravel API
 * @param {Function|null} [options.saveMap] - inject fake saver khi test
 * @param {Function|null} [options.saveAssets] - inject fake uploader khi test
 * @returns {Promise<{status: 'saved'|'duplicate', songEntry: Object, kind: string, difficultyCount: number}>}
 */
async function saveAndSyncSongEntry(parsed, options = {}) {
  const {
    db = dbManager,
    syncMap = true,
    saveMap = defaultSaveMap,
    saveAssets = defaultSaveAssets
  } = options;

  if (!parsed.charts || parsed.charts.length === 0) {
    throw new Error('No valid difficulty found in map file.');
  }

  const songEntry = buildSongEntry({
    kind: parsed.kind,
    charts: parsed.charts,
    primary: parsed.primary,
    assets: parsed.assets,
    fileName: parsed.fileName,
    sourcePackageBlob: parsed.sourcePackageBlob || null,
    sourceText: parsed.sourceText || null,
    sourceFileName: parsed.sourceFileName || ''
  });

  const existing = await db.getBeatmap(songEntry.id);
  if (existing && !options.overwrite) {
    return { status: 'duplicate', songEntry: existing, kind: parsed.kind, difficultyCount: parsed.charts.length };
  }

  if (existing && options.overwrite) {
    songEntry.serverAssets = {
      ...existing.serverAssets,
      ...songEntry.serverAssets
    };
  }

  await db.saveBeatmap(songEntry);

  let savedEntry = songEntry;

  // Đồng bộ metadata map lên MySQL (Laravel API, chạy nền không chặn UI)
  if (syncMap && typeof saveMap === 'function') {
    try {
      await saveMap(songEntryToMapPayload(songEntry));
    } catch (err) {
      console.warn('[Import] Đồng bộ map lên MySQL thất bại:', err.message);
    }
  }

  // Upload audio/background/video lên Laravel Storage, lưu URL vào IndexedDB
  if (syncMap && typeof saveAssets === 'function') {
    try {
      const res = await saveAssets(songEntry);
      if (res) {
        savedEntry = { ...songEntry, serverAssets: serverAssetsFromResponse(res) };
        await db.saveBeatmap(savedEntry);
      }
    } catch (err) {
      console.warn('[Import] Upload asset lên server thất bại:', err.message);
    }
  }

  return {
    status: 'saved',
    songEntry: savedEntry,
    kind: parsed.kind,
    difficultyCount: parsed.charts.length
  };
}

/**
 * Nhập và lưu map vào IndexedDB (và đồng bộ metadata lên MySQL).
 * Hỗ trợ nhập hàng loạt (Bulk Import) khi chọn nhiều file gói (.osz, .zip).
 *
 * @param {FileList|File[]} fileList
 * @param {Object} options
 * @param {'twoFingers'|string} [options.preset]
 * @param {boolean} [options.autoSlide]
 * @param {Object} [options.db] - inject fake DB khi test
 * @param {boolean} [options.syncMap=true] - đồng bộ metadata lên Laravel API
 * @param {Function|null} [options.saveMap] - inject fake saver khi test
 * @param {Function|null} [options.saveAssets] - inject fake uploader khi test
 * @returns {Promise<{status: 'saved'|'duplicate'|'bulk', songEntry: Object, kind: string, difficultyCount: number, count?: number}>}
 */
export async function importFiles(fileList, options = {}) {
  const {
    preset = 'twoFingers',
    autoSlide = false,
  } = options;

  const files = Array.from(fileList || []);
  if (files.length === 0) throw new Error('No files selected.');

  // Kiểm tra nếu có nhiều gói (.osz / .zip) -> Bulk Import
  const packageFiles = files.filter((f) => /\.(osz|zip)$/i.test(f?.name || ''));
  if (packageFiles.length > 1) {
    const results = [];
    for (const pkgFile of packageFiles) {
      try {
        const pkg = await importPackage(pkgFile, { preset, autoSlide });
        const parsed = {
          kind: 'package',
          charts: pkg.charts,
          primary: pkg.primaryBeatmap,
          assets: pkg.assets || {},
          fileName: pkgFile.name,
          sourceFileName: pkgFile.name,
          sourcePackageBlob: pkgFile
        };
        const res = await saveAndSyncSongEntry(parsed, options);
        if (res) results.push(res);
      } catch (err) {
        console.warn(`[Bulk Import] Error importing "${pkgFile.name}":`, err.message);
      }
    }
    return {
      status: 'bulk',
      count: results.length,
      total: packageFiles.length,
      results,
      songEntry: results[results.length - 1]?.songEntry || null,
      kind: 'bulk',
      difficultyCount: results.reduce((acc, r) => acc + (r.difficultyCount || 0), 0)
    };
  }

  // Nhập gói đơn lẻ hoặc nhóm file thông thường
  const parsed = await parseFiles(fileList, { preset, autoSlide });
  return await saveAndSyncSongEntry(parsed, options);
}
