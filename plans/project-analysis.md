# Báo Cáo Phân Tích Dự Án Triarhythm

## Tổng Quan Dự Án

**Triarhythm** là một rhythm game web hoàn chỉnh được xây dựng theo phong cách VSRG (Vertical Scrolling Rhythm Game) của maimai DX, với các tính năng nổi bật:

- **Gameplay**: Note bay từ tâm tam giác ra 9 ô judgement trên vòng tam giác ngược
- **9 phím bàn phím** cho Tap/Hold/Break, **chuột** cho Slide (ngôi sao trượt nối 3 lục giác)
- **Typing Section** theo ý tưởng Rhythm Typer
- **Parser** `.osu/.osz` và `maidata.txt` (maimai/Simai)
- **Beatmap Editor** đầy đủ tính năng
- **Hệ thống PP/Star Rating** tự tính toán
- **Backend**: Laravel 12 + MySQL (API, Auth, Leaderboard, Admin Panel)
- **Frontend**: React 18 + Vite + Canvas 2D (Game Engine tách biệt React state)
- **Offline-first**: IndexedDB cache cho beatmap/asset, MySQL là nguồn sự thật

---

## Kiến Trúc Hệ Thống

### 1. Backend (Laravel 12)

#### Cấu Trúc Thư Mục
```
app/
├── Http/Controllers/Api/
│   ├── AuthController.php      # Đăng ký, đăng nhập, logout, settings, profile
│   ├── MapController.php       # CRUD beatmap, upload asset, soft delete, restore
│   ├── ScoreController.php     # Nộp điểm, tính PP server-side, user scores
│   ├── LeaderboardController.php # Global & Map leaderboard
│   └── AdminController.php     # Dashboard, user/map/score management, recalculate PP
├── Models/
│   ├── User.php                # Auth, PP calculation, relationships
│   ├── Map.php                 # Beatmap metadata, difficulties, soft deletes
│   ├── Score.php               # Score record với judgement breakdown
│   └── AdminLog.php            # Audit log cho admin actions
├── Services/
│   └── PpCalculator.php        # Server-side PP calculation (mirror client)
└── Middleware/
    ├── AuthenticateApiToken.php
    └── RequireAdmin.php
```

#### API Endpoints
| Prefix | Endpoints | Mô Tả |
|--------|-----------|-------|
| `/api/auth` | register, login, me, logout, settings, profile | Authentication |
| `/api/maps` | index, store, show, uploadAssets, destroy, restore, forceDestroy, trashed | Beatmap CRUD |
| `/api/scores` | store, user/{userId} | Score submission & retrieval |
| `/api/leaderboard` | global, map/{song_id} | Leaderboards |
| `/api/admin` | dashboard, users, maps, scores, logs, recalculate-pp | Admin Panel |

#### Database Schema (Migrations)
- `users`: id, username, email, password, role, is_banned, avatar, country, rating, total_pp, total_score, play_count, settings, api_token
- `maps`: id, user_id, song_id, title, artist, creator, source, status, bpm, preview_time, cover_url, audio_url, video_url, difficulties (JSON), metadata (JSON), play_count, deleted_at (soft delete)
- `scores`: id, user_id, song_id, difficulty_name, stars, score, accuracy, max_combo, rank, critical_perfect, perfect, great, good, miss, pp, mods (JSON)
- `admin_logs`: id, user_id, action, target_type, target_id, details (JSON), ip_address

#### Tính Năng Nổi Bật Backend
1. **Soft Delete + Restore + Force Delete** cho beatmap (thùng rác, Ctrl+Z)
2. **Server-side PP Calculation** - tính lại PP khi submit score, batch recalculate
3. **Asset Upload** lên Laravel Storage (`/storage/beatmaps/{song_id}/`)
4. **Admin Panel** đầy đủ: User management, Map management, Score moderation, Audit logs
5. **API Token Authentication** (SHA256 hash trong DB)

---

### 2. Frontend & Game Engine (React + Vanilla ES6 Modules)

#### Cấu Trúc Thư Mục
```
src/
├── App.jsx                    # Root component, screen router, state management
├── main.jsx                   # Entry point
├── components/                # React UI Components
│   ├── AstroSongSelect.jsx    # Song select màn hình chính (osu! lazer style)
│   ├── GameplayView.jsx       # Gameplay wrapper (React ↔ Canvas bridge)
│   ├── AstroSettingsModal.jsx # Settings modal (keybind, audio, video, gameplay)
│   ├── AstroAuthModal.jsx     # Login/Register modal
│   ├── LeaderboardView.jsx    # Global & Map leaderboard
│   ├── AdminPanel.jsx         # Admin dashboard UI
│   ├── ProfileModal.jsx       # Player profile
│   ├── RingPreview.jsx        # Layout preview
│   ├── PlayerLoader.jsx       # Loading screen trước gameplay
│   └── MapEditor.jsx          # Beatmap Editor (6 tabs)
├── core/
│   ├── api/client.js          # API client (fetch wrapper, token management)
│   ├── beatmap/
│   │   ├── schema.js          # JSON Schema v2 + validateBeatmap()
│   │   ├── validator.js       # Validation logic
│   │   ├── difficulty.js      # Difficulty calculation (legacy)
│   │   └── sampleChart.js     # Sample chart for testing
│   ├── engine/                # GAME ENGINE (Vanilla ES6, tách biệt React)
│   │   ├── gameEngine.js      # Main loop, note lifecycle, judgement, input
│   │   ├── audioEngine.js     # Web Audio API, sync, procedural synth, hitsound
│   │   ├── gameplayRenderer.js # Canvas 2D renderer (delegates to renderers/)
│   │   ├── inputManager.js    # Keyboard, pointer, touch input
│   │   ├── scoreManager.js    # Score, combo, achievement, UR, rank
│   │   ├── slideManager.js    # Slide note logic, path, rendering
│   │   ├── particleSystem.js  # Particle effects
│   │   ├── eventBus.js        # Event emitter (engine ↔ React communication)
│   │   └── renderers/
│   │       ├── drawLayout.js  # Triangle ring, lanes, nodes, hub
│   │       ├── drawNotes.js   # Tap, hold, break, ring, slide, typing notes
│   │       ├── drawHud.js     # HUD, combo, UR bar, progress
│   │       └── index.js
│   ├── parser/                # PARSER MODULE (Vanilla ES6)
│   │   ├── osuParser.js       # .osu parser (v14, Mode 0/3, slider→hold)
│   │   ├── maimaiParser.js    # maidata.txt parser (Simai format)
│   │   ├── packageImporter.js # .osz/.zip import (JSZip)
│   │   ├── importService.js   # Unified import flow (parse → IndexedDB → API sync)
│   │   ├── laneMapper.js      # Mode 3/0 → triRing9 lane mapping (5K/7K special)
│   │   ├── densityReducer.js  # 2-finger ergonomics, minGap, maxChord
│   │   ├── timingGrid.js      # Timing point processing, beat snap grid
│   │   ├── cleanString.js     # Unicode cleanup (U+200B removal)
│   │   └── index.js
│   ├── pp/
│   │   └── ppCalculator.js    # Star Rating & PP calculation (client-side)
│   └── storage/
│       ├── db.js              # IndexedDB manager (beatmaps, users, scores, settings)
│       ├── scoreService.js    # Score persistence
│       └── seedData.js        # Default data initialization
├── config/
│   ├── layout.config.js       # triRing9 geometry, coordinates, keybinds
│   ├── judgement.config.js    # Judgement windows, weights, scores, ranks
│   ├── pp.config.js           # PP/Star constants
│   └── slide.config.js        # Slide timing, path, follow radius
├── ui/                        # Reusable UI Components (Button, Modal, Toast, etc.)
└── styles/                    # Tailwind + custom CSS
```

#### Game Engine Architecture (Core Philosophy)
- **Tách biệt hoàn toàn khỏi React state** - chạy trên `requestAnimationFrame` loop
- **Thời gian game = `audioCtx.currentTime`** (bù `baseLatency`/`outputLatency` + user offset)
- **Timestamp input**: quy đổi `event.timeStamp` (performance.now) sang audio time bằng cặp mốc sync
- **Object pooling, sprite cache** - không cấp phát trong render loop
- **Giao tiếp React ↔ Engine**: EventBus (`gameEvents.emit/on`)

#### Renderer Pipeline
```
GameplayRenderer.render(gameState, particleSystem)
  1. drawPlayfield()        # Background, triangle ring, 9 tap lanes, 3 slide nodes, origin hub
  2. drawCenterCombo()      # Combo at center (optional)
  3. drawNotes()            # Active notes (sorted by p, then time)
  4. particleSystem.draw()  # Particles
  5. drawJudgements()       # Judgement popups
  6. renderPointerRing()    # Mouse/touch ring
  7. drawTypingSection()    # Typing bar (if active)
  8. drawHud()              # Score, combo, UR bar, progress, skip prompt
```

---

### 3. Parser System (.osu / .osz / maidata.txt)

#### Luồng Import (importService.js)
```
importFiles(fileList, options)
  → parseFiles()                    # Detect file type
      → importPackage()             # .osz/.zip (JSZip)
      → parseOsu()                  # .osu text
      → parseMaimai()               # maidata.txt
  → buildSongEntry()                # Normalize to IndexedDB format
  → dbManager.saveBeatmap()         # Save to IndexedDB
  → apiClient.saveMap()             # Sync metadata to MySQL (background)
  → apiClient.uploadMapAssets()     # Upload audio/bg/video to Laravel Storage
```

#### osuParser.js - Key Features
- **Mode 3 (mania)**: Column → perimeter groups → lane mapping (5K/7K special handling)
  - 5K: Col 2 (Spacebar) → Ring note
  - 7K: Col 3 (Spacebar) → Ring note
- **Mode 0 (standard)**: Slider → Hold conversion (pixelLength, SV multiplier, inherited timing points)
- **Density Reduction** (2-finger ergonomics):
  - `minGapMs` (default 100ms), `maxChord` (3), `minHoldMs` (250ms), `sameLaneMinGapMs` (150ms)
  - Presets: "Giữ nguyên" (0), "Vừa" (default), "Dễ" (250ms)
- **Auto Slide** (optional): Insert slide every N beats
- **Timing Points**: Merge consecutive uninherited with same beatLength, build beat snap grid
- **Hidden Char Cleanup**: Remove U+200B, U+200C, U+200D, FEFF

#### maimaiParser.js - Key Features
- **Simai Format** parsing: `(bpm)`, `{divisor}`, `,` (timestep), `/` (chord separator)
- **8-button cabinet mapping** → triRing9 lanes (MAIMAI_TO_LANE)
- **Slide Notes** → Ring note (Space) + Tap/Break at start
- **Touch Notes** (Center C, Outer A/B/D/E) → Ring notes (Tap/Hold)
- **No ergonomic limits** - preserves 100% original maimai chart density
- **Hold sanitization** - prevent overlapping holds on same lane

---

### 4. PP & Star Rating System

#### Star Rating (calculateStars)
```
For each note (sorted by time):
  dt = max(time_i - time_{i-1}, 25ms)
  speed = (1000/dt)^1.3
  variety = 1 + 0.15 * (distinct lanes/nodes in 1500ms window - 1)
  move = 1 + 0.25 * (distance between targets / max layout distance)
  typeMult = tap:1.0, hold:0.8, break:1.0, slide:1.2, typing:0.9
  strain = speed * variety * move * typeMult
  Strain decay: S_i = S_{i-1} * 0.9^(dt/400) + strain_i

Chunk into 400ms segments, take peak strain per segment
difficulty = Σ peak_k * 0.9^k
stars = starScale * sqrt(difficulty)  (clamped 1.0 - 15.0)
```

#### PP Calculation (calculatePP)
```
accFactor = clamp((achievement - 70) / 30 * 1.0105, 0, 1.0105)^3
lengthFactor = 0.9 + 0.1 * min(1, noteCount/500)
missPenalty = 0.97^missCount
PP = ppScale * stars^2.4 * accFactor * lengthFactor * missPenalty
```

#### Total PP (Player)
- Top 100 scores per chart (best PP per chart)
- `totalPP = Σ PP_i * 0.95^i` (weight decay)

---

### 5. Gameplay Mechanics (Theo SPEC.md)

#### Note Types
| Type | Mô Tả | Phím/Input | Trọng Số Điểm |
|------|-------|------------|---------------|
| **Tap** | Bấm một lần | 9 phím (lane 0-8) | 1 |
| **Hold** | Giữ từ `time` → `endTime` | 9 phím | 2 |
| **Break** | Điểm cao, bonus achievement | 9 phím | 5 |
| **Slide** | Chuột bám theo ngôi sao trượt | Chuột (pointer) | 3 |
| **Ring** | Tâm tam giác (Spacebar) | Space/KeyB/Enter | - |
| **Typing** | Gõ chữ cái theo nhịp | Bàn phím (event.key) | 1/char |

#### Judgement Windows (Tap/Hold/Break/Typing)
| Judgement | Window | Score Rate |
|-----------|--------|------------|
| CRITICAL PERFECT | ±25ms | 100% |
| PERFECT | ±50ms | 80% |
| GREAT | ±100ms | 50-80% (theo loại) |
| GOOD | ±150ms | 25% |
| MISS | >150ms | 0% |

#### Slide Judgement
- `ratio` = thời gian onTrack / glideMs
- `reachedEnd` = có mẫu onTrack trong [glideEnd-100ms, glideEnd+150ms]
- CRITICAL PERFECT: reachedEnd + ratio ≥ 0.92
- PERFECT: reachedEnd + ratio ≥ 0.80
- GREAT: reachedEnd + ratio ≥ 0.65
- GOOD: reachedEnd + ratio ≥ 0.45
- MISS: còn lại

#### Achievement & Rank
- Achievement = (accumulatedScore / totalBaseWeight) * 100 + BreakBonus (max +1.0000%)
- Rank: SSS+ (≥100.5), SSS (≥100), SS+ (≥99.5), SS (≥99), S+ (≥98), S (≥97), AAA (≥94), AA (≥90), A (≥80), B (≥75), C (còn lại)
- Flags: AP (All Perfect), FC (Full Combo)

---

### 6. Editor (MapEditor.jsx - 6 Tabs)

1. **Setup**: Import .osu/.osz/.zip, upload audio/bg/video, videoOffset preview
2. **Timing**: Waveform timeline, Tap BPM, Offset placement, BPM segments, metronome
3. **Compose**: Interactive triangle ring + 9 tap lanes + 3 slide nodes
   - Tap/Hold/Break: click lane or press key, drag for hold, toggle break
   - Slide: click nodes sequentially (max 4), preview path, waitBeats/beatsPerSegment input
   - Snap to beat divisor, playback from any position (0.25x-1x), Undo/Redo (50+ steps)
   - Test Play from current position, shared renderer with game
4. **Typing**: Select timeline region, input string, auto-distribute chars to beat grid
5. **Hitsound**: Assign sample/volume per note or selection, upload custom, preview
6. **Publish**: Validate, show stars/maxPP, visibility (public/unlisted/private), export .zip/JSON, upload to server

---

### 7. UI/UX & Design System (osu!lazer Inspired)

- **Color Palette**: Dark violet `#181224`, Accent pink `#ff66ab`, Neon purple `#6c5ce7`
- **Typography**: Torus / Nunito / Be Vietnam Pro, JetBrains Mono cho số liệu
- **Effects**: Glassmorphism (backdrop-blur), 12px border radius, glowing borders
- **Song Select**: Tilted cards, rank badges (SS/S/A/B/C/D), instant search filters (`stars>5`, `bpm<200`), F2 random, F5 reload, context menu
- **Result Screen**: Large letter rank, animated 8-digit score, judgement breakdown, UR histogram, PP gained vs PB
- **Gameplay**: 3-2-1 countdown on start/resume, 1s audio lead-in (-1000ms) anti-rocket-note

---

### 8. Testing & Quality Assurance

#### Test Structure
```
tests/
├── parser.test.js           # osuParser fixture tests (Beyond The Aexis)
├── osuMapping5K.test.js     # 5K/7K lane mapping tests
├── maimaiParser.test.js     # maimai parser tests
├── validator.test.js        # validateBeatmap tests
├── difficulty.test.js       # Star rating tests
├── drawNotes.test.js        # Renderer tests
├── engine.test.js           # GameEngine tests
├── exportService.test.js    # Export tests
├── importService.test.js    # Import flow tests
├── geometry.test.js         # Layout geometry tests (no overlap, min distance)
├── Feature/                 # PHPUnit Feature Tests (Laravel)
│   ├── AdminPanelTest.php
│   ├── AuthAndPermissionTest.php
│   ├── BackendIntegrityTest.php
│   └── SoftDeleteMapTest.php
└── fixtures/                # Test data (osu files, zip packages)
```

#### Key Test Assertions (Beyond The Aexis Fixture)
- Mode 3, CircleSize 5 → keys = 5
- 3037 raw HitObjects = 1767 type 1 + 13 type 5 + 1257 type 128
- Metadata: TitleUnicode "Beyond The Æxis", Artist "SDMNE", Creator "ERA Akiri"
- 7 merged timing points (from 21 raw, 11 uninherited)
- 1016 holds < 250ms, max hold 10000ms, max 5 simultaneous holds
- Min raw gap = 31ms
- After "Vừa" preset: ~2058 notes (±3%), 0 dropped due to lane shortage
- Package: wrapped root folder, .osb & SB/ ignored

---

### 9. Deployment & Dev Workflow

#### Requirements
- Node.js 18+, npm
- PHP 8.2+, Composer, MySQL (XAMPP)

#### Setup
```bash
# 1. Dependencies
npm install
composer install

# 2. Environment
copy .env.example .env
php artisan key:generate

# 3. Database
# Create database `triarhythm` in MySQL
php artisan migrate

# 4. Storage link
php artisan storage:link
```

#### Development (2 Terminals)
```bash
# Terminal 1 - Laravel API (http://127.0.0.1:8000)
php artisan serve

# Terminal 2 - Vite Frontend (http://localhost:3000, proxy /api + /storage -> :8000)
npm run dev
```

#### Build & Test
```bash
npm test          # Vitest (unit tests)
npm run build     # Build SPA to dist/
```

---

## Tóm Tắt Kiến Trúc (Mermaid)

```mermaid
graph TB
    subgraph "Frontend (React + Vite)"
        A[App.jsx] --> B[Screen Router]
        B --> C[AstroSongSelect]
        B --> D[GameplayView]
        B --> E[MapEditor]
        B --> F[LeaderboardView]
        B --> G[AdminPanel]
        B --> H[Settings/Auth/Profile Modals]
        
        D --> I[GameEngine (Vanilla ES6)]
        I --> J[AudioEngine]
        I --> K[InputManager]
        I --> L[GameplayRenderer]
        I --> M[ScoreManager]
        I --> N[SlideManager]
        I --> O[ParticleSystem]
        
        L --> P[drawLayout.js]
        L --> Q[drawNotes.js]
        L --> R[drawHud.js]
        
        C --> S[importService.js]
        S --> T[osuParser.js]
        S --> U[maimaiParser.js]
        S --> V[packageImporter.js]
        S --> W[laneMapper.js]
        S --> X[densityReducer.js]
        
        I --> Y[ppCalculator.js]
        S --> Z[dbManager.js (IndexedDB)]
        Z --> AA[apiClient.js]
    end
    
    subgraph "Backend (Laravel 12)"
        AA --> AB[API Routes]
        AB --> AC[AuthController]
        AB --> AD[MapController]
        AB --> AE[ScoreController]
        AB --> AF[LeaderboardController]
        AB --> AG[AdminController]
        
        AC --> AH[User Model]
        AD --> AI[Map Model]
        AE --> AJ[Score Model]
        AG --> AK[AdminLog Model]
        
        AH --> AL[(MySQL)]
        AI --> AL
        AJ --> AL
        AK --> AL
        
        AD --> AM[Laravel Storage]
        AM --> AN[/storage/beatmaps/{song_id}/]
    end
    
    subgraph "Offline Storage"
        Z --> AO[(IndexedDB)]
        AO --> AP[beatmaps]
        AO --> AQ[users]
        AO --> AR[scores]
        AO --> AS[settings]
    end
```

---

## Điểm Mạnh Của Dự Án

1. **Kiến trúc tách biệt rõ ràng**: Game Engine (Vanilla ES6) hoàn toàn tách khỏi React UI
2. **Offline-first**: IndexedDB cache đầy đủ, chơi được không cần mạng
3. **Parser mạnh mẽ**: Hỗ trợ .osu/.osz (Mode 0/3), maidata.txt (Simai), auto density reduction
4. **Hệ thống PP chuẩn xác**: Client & Server đồng bộ công thức, batch recalculate
5. **Editor chuyên nghiệp**: 6 tabs, shared renderer, undo/redo, test play
6. **Admin Panel đầy đủ**: User/Map/Score management, audit logs, PP recalculation
7. **Soft Delete + Restore**: An toàn dữ liệu, UX tốt (Ctrl+Z, Trash bin)
8. **Test coverage**: Unit tests (Vitest) + Feature tests (PHPUnit) cho parser, engine, backend
9. **Design System nhất quán**: osu!lazer inspired, accessible, responsive

---

## Các Vấn Đề / Tiềm Năng Cải Thiện

1. **Firebase references trong SPEC.md** nhưng implementation dùng Laravel/MySQL - cần đồng bộ tài liệu
2. **Missing Editor Implementation**: MapEditor.jsx được list nhưng cần verify tính hoàn thiện
3. **Mobile Touch Support**: Có pointer events nhưng cần test kỹ trên mobile thực tế
4. **Video Background Sync**: Logic sync video/audio cần verify độ chính xác
5. **Performance**: Object pooling đã implement nhưng cần benchmark với 300+ notes
6. **Accessibility**: Cần thêm ARIA labels, keyboard navigation cho UI React
7. **Internationalization**: Hardcoded tiếng Việt trong backend/frontend

---

## Kết Luận

Triarhythm là một **dự án rhythm game web production-grade** với kiến trúc hiện đại, tách biệt rõ ràng giữa Game Engine (Canvas 2D, Web Audio API) và UI (React). Dự án triển khai đầy đủ các tính năng cốt lõi của một rhythm game cạnh tranh: gameplay maimai-style độc đáo, parser đa định dạng, editor mạnh mẽ, hệ thống PP/leaderboard, admin panel, và offline-first architecture. Codebase có tổ chức tốt, có test coverage, và sẵn sàng cho việc mở rộng hoặc deploy production.