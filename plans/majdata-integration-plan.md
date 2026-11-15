# Majdata.net Integration Plan

## Phase 1: Backend Proxy (Laravel)

### 1.1 Config: `config/services.php`
Add Majdata configuration:
```php
'majdata' => [
    'base_url' => env('MAJDATA_BASE_URL', 'https://majdata.net'),
    'timeout' => env('MAJDATA_TIMEOUT', 15),
    'max_response_size' => env('MAJDATA_MAX_RESPONSE_SIZE', 52428800), // 50MB
],
```

### 1.2 Environment: `.env.example`
Add:
```
# Majdata.net API Proxy
MAJDATA_BASE_URL=https://majdata.net
MAJDATA_TIMEOUT=15
MAJDATA_MAX_RESPONSE_SIZE=52428800
```

### 1.3 Controller: `app/Http/Controllers/Api/MajdataProxyController.php`
Endpoints:
- `GET /api/majdata/list` - Chart list with search, sort, pagination
- `GET /api/majdata/chart/{chartId}/summary` - Chart metadata
- `GET /api/majdata/chart/{chartId}/chart` - maidata.txt (Simai format)
- `GET /api/majdata/chart/{chartId}/track` - Audio (MP3 stream)
- `GET /api/majdata/chart/{chartId}/image` - Cover image (fullImage param)
- `GET /api/majdata/chart/{chartId}/video` - Video background (stream)
- `GET /api/majdata/chart/{chartId}/download` - Package info with all asset URLs

Security features:
- Chart ID validation (alphanumeric + dash/underscore only)
- Fixed base URL from config (no SSRF)
- Request timeout (15s)
- Response size limit (50MB)
- Streaming for binary assets
- Short-term caching (list: 60s, summary: 5min)
- User-Agent header
- Rate limiting via Laravel throttle middleware

### 1.4 Routes: `routes/api.php`
Add under new prefix:
```php
Route::prefix('majdata')->group(function () {
    Route::get('/list', [MajdataProxyController::class, 'list']);
    Route::get('/chart/{chartId}/summary', [MajdataProxyController::class, 'summary']);
    Route::get('/chart/{chartId}/chart', [MajdataProxyController::class, 'chart']);
    Route::get('/chart/{chartId}/track', [MajdataProxyController::class, 'track']);
    Route::get('/chart/{chartId}/image', [MajdataProxyController::class, 'image']);
    Route::get('/chart/{chartId}/video', [MajdataProxyController::class, 'video']);
    Route::get('/chart/{chartId}/download', [MajdataProxyController::class, 'downloadPackage']);
})->middleware('throttle:60,1'); // 60 requests/minute
```

---

## Phase 2: Frontend

### 2.1 API Client: `src/core/api/majdata.js`
- `fetchChartList(params)` - search, page, limit, sort
- `fetchChartSummary(chartId)` - metadata
- `fetchChartData(chartId)` - maidata.txt
- `fetchTrackBlob(chartId)` - audio blob
- `fetchImageBlob(chartId, fullImage)` - cover blob
- `fetchVideoBlob(chartId)` - video blob
- `downloadPackage(chartId)` - get all asset URLs
- AbortController support for cancellation
- Error handling with user-friendly messages

### 2.2 Component: `src/components/MajdataModal.jsx`
Using Kawaii UI components (Modal, Button, Toast, Skeleton, Dropdown)

**Tabs:**
1. **Browse Charts** - Search, sort, pagination, chart cards with cover/title/artist/designer/difficulties, "Download & Import" button
2. **majdata.net** - Iframe with sandbox, fallback to "Open in new tab" button
3. **Paste Link/ID** - Parse chart ID from URL, preview summary, import

**Import Flow:**
- Show progress: "Downloading chart → Downloading audio → Downloading cover → (video) → Importing"
- Convert blobs to File objects
- Call `importFiles([maidataFile, audioFile, imageFile, videoFile])` 
- Handle duplicate detection (by chartId/hash)
- Toast notifications for success/error

### 2.3 Integration: `src/components/AstroSongSelect.jsx`
- Add "Majdata" button next to "Add Song (+)" in top bar
- Open MajdataModal
- Style consistent with Kawaii design system

---

## Phase 3: Import Pipeline (Reuse Existing)

The existing `importService.js` already handles:
- `parseMaimai()` for maidata.txt parsing
- `importFiles()` for FileList → IndexedDB + MySQL sync + asset upload
- Duplicate detection by stable song ID

**Flow:**
1. Frontend downloads: maidata.txt (text), track.mp3 (blob), cover.jpg (blob), video.mp4 (blob, optional)
2. Create File objects from blobs
3. Call `importFiles(fileList, { preset: 'twoFingers', autoSlide: false, overwrite: true })`
4. Song appears in Song Select immediately

---

## Assumptions (to verify when API accessible)

1. **Majdata API Base**: `https://majdata.net/api/maichart/...`
2. **List endpoint**: `GET /api/maichart/list?page=1&limit=20&search=&sort=newest`
3. **List response**: `{ data: [...], pagination: {...} }` or similar
4. **Chart ID format**: Alphanumeric string (e.g., "12345", "abc-def")
5. **Chart endpoints**: 
   - `/api/maichart/{id}/summary` → JSON metadata
   - `/api/maichart/{id}/chart` → text/plain (maidata.txt)
   - `/api/maichart/{id}/track` → audio/mpeg
   - `/api/maichart/{id}/image?fullImage=true` → image/jpeg
   - `/api/maichart/{id}/video` → video/mp4
6. **CORS**: Likely restricted → proxy required
7. **Iframe**: Likely blocked by X-Frame-Options → fallback to new tab

---

## Files to Create/Modify

### New Files:
1. `app/Http/Controllers/Api/MajdataProxyController.php`
2. `src/core/api/majdata.js`
3. `src/components/MajdataModal.jsx`

### Modified Files:
1. `config/services.php` - add majdata config
2. `.env.example` - add env vars
3. `routes/api.php` - add majdata routes
4. `src/components/AstroSongSelect.jsx` - add Majdata button

---

## Testing Checklist

- [ ] Proxy returns chart list with search/pagination
- [ ] Proxy streams audio/image/video correctly
- [ ] Frontend modal opens/closes properly
- [ ] Browse tab: search, sort, pagination work
- [ ] Chart card shows cover, title, artist, difficulties
- [ ] "Download & Import" downloads all assets and imports
- [ ] Imported map appears in Song Select, playable
- [ ] Duplicate detection works (same chartId)
- [ ] Iframe tab shows fallback when blocked
- [ ] Paste ID tab parses URL and imports
- [ ] Progress UI shows during download/import
- [ ] Error handling with Toast notifications
- [ ] Responsive on mobile
- [ ] Keyboard accessible (Esc to close, Tab navigation)