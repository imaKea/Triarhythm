import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/core/api/client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('map asset uploads', () => {
  it('uploads each asset separately and combines returned server URLs', async () => {
    const fetchMock = vi.fn(async (_url, options) => {
      const field = [...options.body.keys()][0];
      const assetKey = field === 'background' ? 'cover_url' : `${field}_url`;
      return {
        ok: true,
        json: async () => ({ assets: { [assetKey]: `/storage/${field}` } })
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.uploadMapAssets('shared-map', {
      audio: new Blob(['audio'], { type: 'audio/ogg' }),
      background: new Blob(['image'], { type: 'image/png' })
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body.get('audio').name).toBe('audio.ogg');
    expect(fetchMock.mock.calls[1][1].body.get('background').name).toBe('background.png');
    expect(result.assets).toEqual({
      audio_url: '/storage/audio',
      cover_url: '/storage/background'
    });
  });

  it('rejects assets over the server limit before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.uploadMapAssets('shared-map', {
      audio: { size: 50 * 1024 * 1024 + 1, type: 'audio/mpeg' }
    })).rejects.toThrow(/audio exceeds the 50 MB upload limit/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('API request errors', () => {
  it('includes the status and endpoint for generic server errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ message: 'Server Error' })
    })));

    await expect(apiClient.saveMap({ song_id: 'broken-map' }))
      .rejects.toThrow('Server error (HTTP 500) while requesting /maps. Check the Laravel log for details.');
  });
});
