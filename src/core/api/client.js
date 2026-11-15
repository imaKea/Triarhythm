/**
 * Triarhythm API Client
 * Giao tiếp trực tiếp với Laravel Backend & MySQL Database (/api/*)
 */

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/api';

const ASSET_EXTENSIONS_BY_MIME = {
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-flac': 'flac',
  'audio/x-wav': 'wav',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
};

const ASSET_MAX_SIZES = {
  audio: 50 * 1024 * 1024,
  background: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

function assetFilename(asset, field) {
  const name = typeof asset.name === 'string' ? asset.name : '';
  if (/\.[a-z0-9]+$/i.test(name)) return name;

  const extension = ASSET_EXTENSIONS_BY_MIME[asset.type];
  if (!extension) {
    throw new Error(`Could not determine a supported file extension for ${field}.`);
  }
  return `${name || field}.${extension}`;
}

class ApiClient {
  constructor() {
    this.token = typeof localStorage !== 'undefined' ? localStorage.getItem('triarhythm_api_token') : null;
  }

  setToken(token) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem('triarhythm_api_token', token);
      else localStorage.removeItem('triarhythm_api_token');
    }
  }

  getToken() {
    if (!this.token && typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('triarhythm_api_token');
    }
    return this.token;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status >= 500) {
          const message = typeof data?.message === 'string' && !/^server error$/i.test(data.message)
            ? `: ${data.message}`
            : '';
          throw new Error(`Server error (HTTP ${response.status})${message} while requesting ${endpoint}. Check the Laravel log for details.`);
        }
        throw new Error(data?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (err) {
      console.warn(`[API] Lỗi gọi ${endpoint}:`, err.message);
      throw err;
    }
  }

  // --- AUTH ---
  async register({ username, email, password, name }) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, name }),
    });
    if (res?.token) this.setToken(res.token);
    return res;
  }

  async login({ login, password }) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    if (res?.token) this.setToken(res.token);
    return res;
  }

  async me() {
    return await this.request('/auth/me');
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (_) {}
    this.setToken(null);
  }

  // --- MAPS ---
  async getMaps({ q = '', source = '' } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (source) params.set('source', source);
    return await this.request(`/maps?${params.toString()}`);
  }

  async getMap(songId) {
    return await this.request(`/maps/${encodeURIComponent(songId)}`);
  }

  resolveAssetUrl(assetUrl) {
    if (!assetUrl) return null;
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const apiOrigin = new URL(API_BASE, appOrigin).origin;
    const url = new URL(assetUrl, apiOrigin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Map asset URL must use HTTP or HTTPS.');
    }
    return url.toString();
  }

  async fetchAssetBlob(assetUrl) {
    const resolvedUrl = this.resolveAssetUrl(assetUrl);
    if (!resolvedUrl) return null;
    const url = new URL(resolvedUrl);

    const headers = {};
    const token = this.getToken();
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const apiOrigin = new URL(API_BASE, appOrigin).origin;
    if (url.origin !== apiOrigin) {
      throw new Error('Map asset is hosted outside the configured game server.');
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Could not download map asset (HTTP ${response.status}).`);
    }
    return response.blob();
  }

  async saveMap(mapData) {
    return await this.request('/maps', {
      method: 'POST',
      body: JSON.stringify(mapData),
    });
  }

  /**
   * Upload audio/background/video (Blob/File) lên Laravel Storage.
   * Không set Content-Type để trình duyệt tự thêm boundary của multipart.
   */
  async uploadMapAssets(songId, { audio, background, video } = {}) {
    const headers = { Accept: 'application/json' };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const uploads = [
      ['audio', audio],
      ['background', background],
      ['video', video],
    ].filter(([, asset]) => asset);
    const uploadedAssets = {};

    for (const [field, asset] of uploads) {
      if (asset.size > ASSET_MAX_SIZES[field]) {
        throw new Error(`${field} exceeds the ${Math.round(ASSET_MAX_SIZES[field] / 1024 / 1024)} MB upload limit.`);
      }

      const form = new FormData();
      form.append(field, asset, assetFilename(asset, field));

      let response;
      try {
        response = await fetch(`${API_BASE}/maps/${encodeURIComponent(songId)}/assets`, {
          method: 'POST',
          headers,
          body: form,
        });
      } catch (error) {
        throw new Error(`Network error while uploading ${field}: ${error.message}. Check server upload limits and connectivity.`);
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || `Could not upload ${field} (HTTP ${response.status}: ${response.statusText}).`);
      }
      Object.assign(uploadedAssets, data?.assets || {});
    }

    return { success: true, assets: uploadedAssets };
  }

  async deleteMap(songId) {
    return await this.request(`/maps/${encodeURIComponent(songId)}`, {
      method: 'DELETE',
    });
  }

  async restoreMap(songId) {
    return await this.request(`/maps/${encodeURIComponent(songId)}/restore`, {
      method: 'POST',
    });
  }

  async forceDeleteMap(songId) {
    return await this.request(`/maps/${encodeURIComponent(songId)}/force`, {
      method: 'DELETE',
    });
  }

  async getTrashMaps() {
    return await this.request('/maps/trash/list');
  }

  // --- SCORES ---
  async submitScore(scoreData) {
    return await this.request('/scores', {
      method: 'POST',
      body: JSON.stringify(scoreData),
    });
  }

  async getUserScores(userId, filters = {}) {
    const params = new URLSearchParams(filters);
    const query = params.toString();
    return await this.request(`/scores/user/${encodeURIComponent(userId)}${query ? `?${query}` : ''}`);
  }

  // --- LEADERBOARDS ---
  async getGlobalLeaderboard(type = 'rating', limit = 50) {
    return await this.request(`/leaderboard/global?type=${type}&limit=${limit}`);
  }

  async getMapLeaderboard(songId, difficulty = '') {
    const params = new URLSearchParams();
    if (difficulty) params.set('difficulty', difficulty);
    return await this.request(`/leaderboard/map/${encodeURIComponent(songId)}?${params.toString()}`);
  }

  // --- ADMIN PANEL API ---
  async adminGetDashboard() {
    return await this.request('/admin/dashboard');
  }

  async adminGetUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await this.request(`/admin/users${qs ? '?' + qs : ''}`);
  }

  async adminUpdateUserRole(userId, role) {
    return await this.request(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async adminToggleUserBan(userId) {
    return await this.request(`/admin/users/${userId}/ban`, {
      method: 'PUT',
    });
  }

  async adminResetUserPassword(userId, password = '') {
    return await this.request(`/admin/users/${userId}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify(password ? { password } : {}),
    });
  }

  async adminDeleteUser(userId) {
    return await this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async adminGetMaps(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await this.request(`/admin/maps${qs ? '?' + qs : ''}`);
  }

  async adminUpdateMap(mapId, data) {
    return await this.request(`/admin/maps/${mapId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteMap(mapId) {
    return await this.request(`/admin/maps/${mapId}`, {
      method: 'DELETE',
    });
  }

  async adminGetScores(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await this.request(`/admin/scores${qs ? '?' + qs : ''}`);
  }

  async adminDeleteScore(scoreId) {
    return await this.request(`/admin/scores/${scoreId}`, {
      method: 'DELETE',
    });
  }

  async adminRecalculatePP() {
    return await this.request('/admin/scores/recalculate-pp', {
      method: 'POST',
    });
  }

  async adminGetLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await this.request(`/admin/logs${qs ? '?' + qs : ''}`);
  }
}

export const apiClient = new ApiClient();

if (!apiClient.resolveAssetUrl) {
  apiClient.resolveAssetUrl = function (assetUrl) {
    return ApiClient.prototype.resolveAssetUrl.call(this, assetUrl);
  };
}
if (!apiClient.fetchAssetBlob) {
  apiClient.fetchAssetBlob = function (assetUrl) {
    return ApiClient.prototype.fetchAssetBlob.call(this, assetUrl);
  };
}

export default apiClient;
