# Frontend: Majdata API Client (`src/core/api/majdata.js`)

```javascript
/**
 * Majdata.net API Client
 * Gọi qua backend proxy Laravel (/api/majdata/*) để tránh CORS và bảo mật
 */

import { apiClient } from './client.js';

const MAJDATA_API_BASE = '/api/majdata';

/**
 * Lấy danh sách chart từ Majdata
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.search='']
 * @param {string} [params.sort='newest'] - newest, oldest, popular, rating, title
 * @param {boolean} [params.isRanking=false]
 * @param {string} [params.category='']
 * @param {AbortSignal} [signal]
 */
export async function fetchChartList(params = {}, signal = null) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.search) searchParams.set('search', params.search);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.isRanking) searchParams.set('isRanking', 'true');
  if (params.category) searchParams.set('category', params.category);

  const response = await apiClient.request(`${MAJDATA_API_BASE}/list?${searchParams.toString()}`, {
    signal,
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Failed to fetch chart list');
  }

  // Normalize response - Majdata might return different structures
  const rawData = response.data;
  let charts = [];
  let pagination = { page: 1, limit: 20, total: 0, totalPages: 1 };

  if (Array.isArray(rawData)) {
    charts = rawData;
  } else if (rawData?.data && Array.isArray(rawData.data)) {
    charts = rawData.data;
    pagination = rawData.pagination || pagination;
  } else if (rawData?.charts && Array.isArray(rawData.charts)) {
    charts = rawData.charts;
    pagination = rawData.pagination || pagination;
  }

  return {
    charts: charts.map(normalizeChartSummary),
    pagination,
  };
}

/**
 * Lấy chi tiết metadata của một chart
 * @param {string} chartId
 * @param {AbortSignal} [signal]
 */
export async function fetchChartSummary(chartId, signal = null) {
  const response = await apiClient.request(`${MAJDATA_API_BASE}/chart/${encodeURIComponent(chartId)}/summary`, {
    signal,
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Chart not found');
  }

  return normalizeChartSummary(response.data);
}

/**
 * Lấy nội dung maidata.txt (Simai format)
 * @param {string} chartId
 * @param {AbortSignal} [signal]
 */
export async function fetchChartData(chartId, signal = null) {
  const response = await apiClient.request(`${MAJDATA_API_BASE}/chart/${encodeURIComponent(chartId)}/chart`, {
    signal,
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Failed to fetch chart data');
  }

  return response.data.maidata || response.data.chart || '';
}

/**
 * Tải file audio (track) dưới dạng Blob
 * @param {string} chartId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function fetchTrackBlob(chartId, signal = null) {
  const response = await fetch(`${MAJDATA_API_BASE}/chart/${encodeURIComponent(chartId)}/track`, {
    signal,
    headers: {
      'Accept': 'audio/mpeg, audio/*',
    },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('Audio track not found');
    throw new Error(`Failed to download audio: ${response.status}`);
  }

  return response.blob();
}

/**
 * Tải file ảnh cover/background dưới dạng Blob
 * @param {string} chartId
 * @param {boolean} [fullImage=true]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function fetchImageBlob(chartId, fullImage = true, signal = null) {
  const params = new URLSearchParams();
  params.set('fullImage', fullImage ? 'true' : 'false');

  const response = await fetch(`${MAJDATA_API_BASE}/chart/${encodeURIComponent(chartId)}/image?${params.toString()}`, {
    signal,
    headers: {
      'Accept': 'image/jpeg, image/png, image/webp, image/*',
    },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('Image not found');
    throw new Error(`Failed to download image: ${response.status}`);
  }

  return response.blob();
}

/**
 * Tải file video background dưới dạng Blob
 * @param {string} chartId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function fetchVideoBlob(chartId, signal = null) {
  const response = await fetch(`${MAJDATA_API_BASE}/chart/${encodeURIComponent(chartId)}/video`, {
    signal,
    headers: {
      'Accept': 'video/mp4, video/webm, video/*',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null; // Video is optional
    throw new Error(`Failed to download video: ${response.status}`);
  }

  return response.blob();
}

/**
 * Lấy thông tin package download (tất cả asset URLs)
 * @param {string} chartId
 * @param {AbortSignal} [signal]
 */
export async function fetchDownloadPackage(chartId, signal = null) {
  const response = await apiClient.request(`${MAJDATA_API_BASE}/chart/${encodeURIComponent(chartId)}/download`, {
    signal,
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Failed to get download info');
  }

  return response.data;
}

/**
 * Parse chart ID từ URL Majdata
 * Hỗ trợ các format: 
 * - https://majdata.net/chart/12345
 * - https://majdata.net/chart/abc-def
 * - https://majdata.net/#/chart/12345
 * - Chỉ ID: "12345"
 */
export function parseChartIdFromUrl(input) {
  if (!input) return null;
  
  const trimmed = input.trim();
  
  // Nếu chỉ là ID đơn giản
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }

  // Thử match từ URL
  const patterns = [
    /majdata\.net[/#]?chart\/([a-zA-Z0-9_-]+)/i,
    /majdata\.net[/#]?maichart\/([a-zA-Z0-9_-]+)/i,
    /chart\/([a-zA-Z0-9_-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Chuẩn hóa dữ liệu chart từ API response
 * @param {Object} raw
 */
function normalizeChartSummary(raw) {
  if (!raw) return null;

  return {
    id: raw.id || raw.chartId || raw.chart_id || '',
    title: raw.title || raw.name || raw.song_name || 'Unknown Title',
    artist: raw.artist || raw.song_artist || 'Unknown Artist',
    designer: raw.designer || raw.mapper || raw.creator || 'Unknown Designer',
    category: raw.category || raw.difficulty || raw.level || '',
    level: raw.level || raw.difficultyLevel || raw.lv || '',
    bpm: raw.bpm ? parseFloat(raw.bpm) : null,
    duration: raw.duration || raw.length || null,
    coverUrl: raw.coverUrl || raw.cover_url || raw.image || raw.thumbnail || null,
    previewUrl: raw.previewUrl || raw.preview_url || raw.sample || null,
    isRanking: raw.isRanking || raw.is_ranking || false,
    createdAt: raw.createdAt || raw.created_at || raw.date || null,
    updatedAt: raw.updatedAt || raw.updated_at || null,
    // Raw data for debugging
    _raw: raw,
  };
}

/**
 * Tải toàn bộ assets của một chart và import vào game
 * @param {string} chartId
 * @param {Object} callbacks
 * @param {Function} callbacks.onProgress - (stage, progress, message) => void
 * @param {AbortSignal} [signal]
 * @returns {Promise<{maidata: string, track: Blob, image: Blob, video: Blob|null}>}
 */
export async function downloadChartAssets(chartId, callbacks = {}, signal = null) {
  const { onProgress } = callbacks;
  
  const updateProgress = (stage, progress, message) => {
    if (onProgress) onProgress(stage, progress, message);
  };

  // 1. Fetch chart summary first (for metadata)
  updateProgress('summary', 0, 'Fetching chart info...');
  const summary = await fetchChartSummary(chartId, signal);
  
  // 2. Fetch maidata.txt
  updateProgress('chart', 10, 'Downloading chart data...');
  const maidata = await fetchChartData(chartId, signal);
  
  // 3. Fetch audio track
  updateProgress('track', 30, 'Downloading audio track...');
  const trackBlob = await fetchTrackBlob(chartId, signal);
  
  // 4. Fetch cover image
  updateProgress('image', 60, 'Downloading cover image...');
  const imageBlob = await fetchImageBlob(chartId, true, signal);
  
  // 5. Fetch video (optional)
  updateProgress('video', 80, 'Checking for video...');
  let videoBlob = null;
  try {
    videoBlob = await fetchVideoBlob(chartId, signal);
  } catch (e) {
    // Video not found is OK
    console.log('No video available for this chart');
  }
  
  updateProgress('complete', 100, 'All assets downloaded!');

  return {
    chartId,
    summary,
    maidata,
    track: trackBlob,
    image: imageBlob,
    video: videoBlob,
  };
}

/**
 * Tạo File object từ Blob với tên file phù hợp
 */
export function createFileFromBlob(blob, filename, type = null) {
  if (!blob) return null;
  
  const fileType = type || blob.type || 'application/octet-stream';
  return new File([blob], filename, { type: fileType });
}

/**
 * Tạo danh sách File objects từ assets đã tải về
 * Dùng để gọi importFiles()
 */
export function createImportFileList(assets) {
  const files = [];
  
  // maidata.txt
  if (assets.maidata) {
    const maidataBlob = new Blob([assets.maidata], { type: 'text/plain' });
    files.push(createFileFromBlob(maidataBlob, 'maidata.txt', 'text/plain'));
  }
  
  // Audio track
  if (assets.track) {
    // Detect extension from blob type or default to mp3
    const ext = assets.track.type.includes('mpeg') || assets.track.type.includes('mp3') ? 'mp3' : 'ogg';
    files.push(createFileFromBlob(assets.track, `track.${ext}`, assets.track.type));
  }
  
  // Cover image
  if (assets.image) {
    const ext = assets.image.type.includes('png') ? 'png' : 
                assets.image.type.includes('webp') ? 'webp' : 'jpg';
    files.push(createFileFromBlob(assets.image, `cover.${ext}`, assets.image.type));
  }
  
  // Video (optional)
  if (assets.video) {
    const ext = assets.video.type.includes('webm') ? 'webm' : 'mp4';
    files.push(createFileFromBlob(assets.video, `video.${ext}`, assets.video.type));
  }
  
  return files;
}