/**
 * Bộ nhập gói bản đồ .osz / .zip (packageImporter)
 * Sử dụng JSZip để giải nén có chọn lọc, hỗ trợ gói bọc thư mục gốc,
 * tìm kiếm đệ quy và phân giải đường dẫn tài nguyên không phân biệt hoa thường.
 */

import JSZip from 'jszip';
import { parseOsu } from './osuParser.js';
import { parseMaimai } from './maimaiParser.js';

// Mẫu lọc hitsound
const HITSOUND_REGEX = /^(normal|soft|drum)-hit(normal|whistle|finish|clap)\d*\.(wav|ogg|mp3)$/i;

// Mẫu lọc các hiệu ứng âm thanh phụ trợ của osu! (không phải bài hát)
const SFX_REGEX = /^(combobreak|applause|sectionpass|sectionfail|failsound|pause|spinnerspin|count\d*|ready|go|warning)\.(wav|ogg|mp3)$/i;

// Các định dạng âm thanh được hỗ trợ
const AUDIO_EXT_REGEX = /\.(mp3|ogg|wav|m4a|aac|flac)$/i;

// Các định dạng hình ảnh được hỗ trợ
const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|webp)$/i;

// Các định dạng video được hỗ trợ
const VIDEO_EXT_REGEX = /\.(mp4|webm|avi|flv|mkv|mov)$/i;

function normalizePath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

// JSZip `async('blob')` không gán MIME type, khiến Laravel `mimes` validation
// từ chối file upload. Suy ra MIME từ phần mở rộng của entry.
const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
};

export function mimeFromFileName(name = '') {
  const ext = String(name).split('.').pop().toLowerCase();
  return MIME_BY_EXT[ext] || '';
}

/**
 * Đọc entry trong zip thành Blob có MIME type đúng (nếu nhận diện được).
 */
async function readEntryBlob(entry) {
  const blob = await entry.async('blob');
  const type = mimeFromFileName(entry?.name || '');
  return type ? new Blob([blob], { type }) : blob;
}

/**
 * Tìm file hình ảnh nền (bg.jpg, bg.png...) trong zip
 */
function findZipImage(zip, basePath, targetFilename) {
  const cleanTarget = (targetFilename || '').replace(/["']/g, '').trim().toLowerCase();
  if (cleanTarget) {
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const basename = normalizePath(relativePath).split('/').pop().toLowerCase();
      if (basename === cleanTarget) return zipEntry;
    }
  }

  // Fallback: Tìm file ảnh có tên chứa bg, cover, jacket hoặc ảnh lớn nhất
  const candidateImages = [];
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const basename = normalizePath(relativePath).split('/').pop().toLowerCase();
    if (IMAGE_EXT_REGEX.test(basename)) {
      const isBg = basename.includes('bg') || basename.includes('cover') || basename.includes('jacket');
      candidateImages.push({ entry: zipEntry, isBg });
    }
  }

  if (candidateImages.length > 0) {
    candidateImages.sort((a, b) => (a.isBg === b.isBg ? 0 : (a.isBg ? -1 : 1)));
    return candidateImages[0].entry;
  }
  return null;
}

/**
 * Tìm file video / BGA (pv.mp4, bga.mp4, movie.mp4...) trong zip
 */
function findZipVideo(zip, basePath, targetFilename) {
  const cleanTarget = (targetFilename || '').replace(/["']/g, '').trim().toLowerCase();
  if (cleanTarget) {
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const basename = normalizePath(relativePath).split('/').pop().toLowerCase();
      if (basename === cleanTarget) return zipEntry;
    }
  }

  // Fallback: Tìm video có tên chứa pv, bga, movie, track, video hoặc video bất kỳ
  const candidateVideos = [];
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const basename = normalizePath(relativePath).split('/').pop().toLowerCase();
    if (VIDEO_EXT_REGEX.test(basename)) {
      const isPriority = basename.includes('pv') || basename.includes('bga') || basename.includes('movie') || basename.includes('video') || basename.includes('track');
      candidateVideos.push({ entry: zipEntry, isPriority });
    }
  }

  if (candidateVideos.length > 0) {
    candidateVideos.sort((a, b) => (a.isPriority === b.isPriority ? 0 : (a.isPriority ? -1 : 1)));
    return candidateVideos[0].entry;
  }
  return null;
}

/**
 * Tìm file trong JSZip không phân biệt hoa thường và phân giải đường dẫn tương đối
 * Nếu không tìm thấy theo tên, tự động tìm file âm thanh bài hát chính (lớn nhất và không phải hitsound / SFX)
 */
function findZipEntry(zip, basePath, targetFilename) {
  const cleanTarget = (targetFilename || '').replace(/["']/g, '').trim();
  const targetLower = cleanTarget.toLowerCase();

  if (cleanTarget) {
    // 1. Thử đường dẫn tương đối trực tiếp trong basePath
    const directPath = basePath ? `${basePath}/${cleanTarget}` : cleanTarget;
    const directNorm = normalizePath(directPath).toLowerCase();

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const norm = normalizePath(relativePath).toLowerCase();
      if (norm === directNorm) return zipEntry;
    }

    // 2. Thử tìm kiếm theo tên file đơn thuần (basename)
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const norm = normalizePath(relativePath);
      const basename = norm.split('/').pop().toLowerCase();
      if (basename === targetLower) return zipEntry;
    }

    // 2b. Thử khớp đuôi đường dẫn (ví dụ: zip có subfolder/audio.mp3)
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const norm = normalizePath(relativePath).toLowerCase();
      if (norm.endsWith('/' + targetLower)) return zipEntry;
    }
  }

  // 3. Fallback dự phòng: Tìm file âm thanh bài hát trong zip (bỏ qua hitsound, SFX, storyboard)
  const candidateAudioEntries = [];
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const norm = normalizePath(relativePath);
    if (norm.includes('SB/') || norm.includes('sb/') || norm.endsWith('.osb')) continue;

    const basename = norm.split('/').pop();
    if (AUDIO_EXT_REGEX.test(basename) && !HITSOUND_REGEX.test(basename) && !SFX_REGEX.test(basename)) {
      const data = zipEntry._data;
      const size = data ? (data.uncompressedSize || data.compressedSize || (data.compressedContent?.length || 0)) : 0;
      // Điểm ưu tiên: định dạng nhạc bài hát (.mp3, .ogg) ưu tiên hơn .wav (vốn hay dùng cho hiệu ứng)
      const isMusicExt = /\.(mp3|ogg|m4a|flac)$/i.test(basename);
      candidateAudioEntries.push({ entry: zipEntry, size, path: norm, isMusicExt });
    }
  }

  if (candidateAudioEntries.length > 0) {
    // Sắp xếp: Ưu tiên định dạng nhạc trước, sau đó sắp theo dung lượng lớn nhất
    candidateAudioEntries.sort((a, b) => {
      if (a.isMusicExt !== b.isMusicExt) return a.isMusicExt ? -1 : 1;
      return b.size - a.size;
    });
    return candidateAudioEntries[0].entry;
  }

  return null;
}

export async function importPackage(fileOrBuffer, options = {}) {
  const mergedOptions = { preset: 'twoFingers', autoSlide: false, ...options };
  const zip = new JSZip();
  let zipData;

  try {
    zipData = await zip.loadAsync(fileOrBuffer);
  } catch (err) {
    throw new Error(`Không thể đọc file nén: ${err.message}`);
  }

  // 1. Kiểm tra xem file nén có phải là gói chart maimai (chứa maidata.txt) không
  let maidataEntry = null;
  let maidataFolder = '';
  for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
    if (zipEntry.dir) continue;
    const norm = normalizePath(relativePath);
    const basename = norm.split('/').pop().toLowerCase();
    if (basename === 'maidata.txt') {
      maidataEntry = zipEntry;
      maidataFolder = norm.includes('/') ? norm.substring(0, norm.lastIndexOf('/')) : '';
      break;
    }
  }

  // NẾU LÀ GÓI MAIMAI (SIMAI / ASTRODX / MAJDATA)
  if (maidataEntry) {
    const maidataText = await maidataEntry.async('text');
    const maimaiParsed = parseMaimai(maidataText, mergedOptions);

    const extractedAssets = {
      audio: null,
      audioBuffer: null,
      background: null,
      video: null,
      hitsounds: {}
    };

    // Tìm file nhạc bài hát: track.mp3, track.ogg... hoặc file nhạc lớn nhất
    const audioEntry = findZipEntry(zipData, maidataFolder, 'track.mp3');
    if (audioEntry) {
      extractedAssets.audio = await readEntryBlob(audioEntry);
      try {
        extractedAssets.audioBuffer = await audioEntry.async('arraybuffer');
      } catch (e) {}
    }

    // Tìm file ảnh bìa / hình nền: bg.jpg, bg.png, cover.jpg, jacket.png...
    const bgEntry = findZipImage(zipData, maidataFolder, maimaiParsed.metadata?.image || 'bg.jpg');
    if (bgEntry) {
      extractedAssets.background = await readEntryBlob(bgEntry);
    }

    // Tìm file video / BGA / PV: pv.mp4, movie.mp4, video.mp4, track.mp4...
    const videoEntry = findZipVideo(zipData, maidataFolder, maimaiParsed.metadata?.bga || maimaiParsed.metadata?.video || 'pv.mp4');
    if (videoEntry) {
      extractedAssets.video = await readEntryBlob(videoEntry);
    }

    const charts = maimaiParsed.difficulties.map((diff) => ({
      difficultyName: diff.difficultyName,
      difficultyLevel: diff.difficultyLevel,
      beatmap: diff.beatmap,
      filePath: maidataEntry.name,
      rawStats: { rawTotalCount: diff.noteCount },
      audioBlob: extractedAssets.audio,
      audioBuffer: extractedAssets.audioBuffer,
      videoBlob: extractedAssets.video,
      backgroundBlob: extractedAssets.background,
      hitsounds: {}
    }));

    return {
      charts,
      beatmaps: maimaiParsed.difficulties.map((d) => ({
        filePath: maidataEntry.name,
        folder: maidataFolder,
        version: d.difficultyName,
        beatmap: d.beatmap,
        rawStats: { rawTotalCount: d.noteCount }
      })),
      primaryBeatmap: maimaiParsed.primaryBeatmap,
      assets: extractedAssets,
      availableDifficulties: maimaiParsed.difficulties.map((d) => ({
        name: d.difficultyName,
        level: d.difficultyLevel,
        filePath: maidataEntry.name,
        rawCount: d.noteCount,
        finalCount: d.noteCount
      }))
    };
  }

  // 2. Nếu không phải maimai, tìm tất cả các file .osu đệ quy trong gói (osu! beatmap set)
  const osuEntries = [];
  for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
    if (zipEntry.dir) continue;
    const norm = normalizePath(relativePath);

    // Bỏ qua storyboard SB/ và file .osb
    if (norm.includes('SB/') || norm.includes('sb/') || norm.endsWith('.osb')) {
      continue;
    }

    if (norm.toLowerCase().endsWith('.osu')) {
      osuEntries.push({
        path: norm,
        entry: zipEntry,
        folder: norm.includes('/') ? norm.substring(0, norm.lastIndexOf('/')) : ''
      });
    }
  }

  if (osuEntries.length === 0) {
    throw new Error('Gói không chứa bất kỳ file bản đồ .osu hợp lệ nào.');
  }

  // 2. Phân tích từng file .osu tìm được (chỉ nhận chart osu!mania 5 key hoặc 7 key khi bật osu special mapping)
  const beatmaps = [];
  let skippedNonSpecialCount = 0;
  for (const osuItem of osuEntries) {
    const textContent = await osuItem.entry.async('text');
    try {
      const parseResult = parseOsu(textContent, mergedOptions);
      // Yêu cầu: Nếu yêu cầu bắt buộc chỉ nạp chart 5K / 7K
      if ((options.requireSpecialKeys || options.require5Keys) &&
          (parseResult.mode !== 3 || (parseResult.keys !== 5 && parseResult.keys !== 7))) {
        skippedNonSpecialCount++;
        continue;
      }
      beatmaps.push({
        filePath: osuItem.path,
        folder: osuItem.folder,
        version: parseResult.beatmap.metadata.difficultyName,
        beatmap: parseResult.beatmap,
        rawStats: parseResult.rawStats,
        reductionStats: parseResult.reductionStats
      });
    } catch (parseErr) {
      console.warn(`Lỗi phân tích file ${osuItem.path}:`, parseErr.message);
    }
  }

  if (beatmaps.length === 0) {
    if ((options.osuSpecialMapping || options.osu5KMapping || options.requireSpecialKeys || options.require5Keys) && skippedNonSpecialCount > 0) {
      throw new Error(`Gói map osu! này không có độ khó 5 key hoặc 7 key nào (đã bỏ qua ${skippedNonSpecialCount} diff không phải 5K/7K). Chức năng này chỉ hoạt động với chart 5 key hoặc 7 key.`);
    }
    throw new Error('Không phân tích được độ khó nào từ các file .osu trong gói.');
  }

  const primaryItem = beatmaps[0];
  const primaryBeatmap = primaryItem.beatmap;
  const targetFolder = primaryItem.folder;

  // 3. Giải nén có chọn lọc các asset thật sự cần thiết
  const extractedAssets = {
    audio: null,
    audioBuffer: null,
    background: null,
    video: null,
    hitsounds: {}
  };

  // 3a. Audio chính của bài hát
  const audioEntry = findZipEntry(zipData, targetFolder, primaryBeatmap.assets.audio);
  if (audioEntry) {
    extractedAssets.audio = await readEntryBlob(audioEntry);
    try {
      extractedAssets.audioBuffer = await audioEntry.async('arraybuffer');
    } catch (e) {}
  }

  // 3b. Ảnh nền
  const bgEntry = findZipImage(zipData, targetFolder, primaryBeatmap.assets?.background || 'bg.jpg');
  if (bgEntry) {
    extractedAssets.background = await readEntryBlob(bgEntry);
  }

  // 3c. Video nền
  const videoEntry = findZipVideo(zipData, targetFolder, primaryBeatmap.assets?.video || 'video.mp4');
  if (videoEntry) {
    extractedAssets.video = await readEntryBlob(videoEntry);
  }

  // 3d. Hitsounds khớp regex
  for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
    if (zipEntry.dir) continue;
    const norm = normalizePath(relativePath);
    if (norm.includes('SB/') || norm.includes('sb/') || norm.endsWith('.osb')) continue;

    const basename = norm.split('/').pop();
    if (HITSOUND_REGEX.test(basename)) {
      extractedAssets.hitsounds[basename.toLowerCase()] = await zipEntry.async('blob');
    }
  }

  const charts = beatmaps.map((b) => ({
    difficultyName: b.beatmap.metadata.difficultyName || b.version,
    beatmap: b.beatmap,
    filePath: b.filePath,
    rawStats: b.rawStats,
    audioBlob: extractedAssets.audio,
    audioBuffer: extractedAssets.audioBuffer,
    videoBlob: extractedAssets.video,
    backgroundBlob: extractedAssets.background,
    hitsounds: extractedAssets.hitsounds
  }));

  return {
    charts,
    beatmaps,
    primaryBeatmap,
    assets: extractedAssets,
    availableDifficulties: beatmaps.map((b) => ({
      name: b.version,
      filePath: b.filePath,
      rawCount: b.rawStats.rawTotalCount,
      finalCount: b.beatmap.notes.length
    }))
  };
}

export async function safeDecodeAudioData(audioContext, arrayBuffer) {
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error(
      `Trình duyệt của bạn không giải mã được file âm thanh (có thể do thiếu codec OGG/Vorbis): ${err.message}`
    );
  }
}
