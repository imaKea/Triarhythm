# Triarhythm

Rhythm game (React + Vite) với backend **Laravel 12 + MySQL**. IndexedDB đóng vai trò cache offline cho beatmap/asset; MySQL là nguồn sự thật cho tài khoản, map và điểm số.

## Kiến trúc

```
Frontend (React 18 + Vite)          Backend (Laravel 12)         Database
┌─────────────────────────┐  /api   ┌──────────────────────┐     ┌─────────┐
│ src/                    │ ──────► │ app/Http/Controllers │ ──► │  MySQL  │
│ - components/ (UI)      │  proxy  │   /Api/*             │     │ users   │
│ - core/ (engine/parser) │         │ routes/api.php       │     │ maps    │
│ - features/editor/      │         └──────────────────────┘     │ scores  │
│ IndexedDB (offline cache)│                                       └─────────┘
└─────────────────────────┘
```

- **Frontend**: `src/`, entry `index.html` + `src/main.jsx`.
- **Asset tĩnh của game**: `static/` (Vite `publicDir`). `public/` là web-root của Laravel (`index.php`, `.htaccess`).
- **Backend API**: `app/Http/Controllers/Api/{Auth,Map,Score,Leaderboard}Controller.php`, `routes/api.php`.
- **Model**: `app/Models/{User,Map,Score}.php`; migration trong `database/migrations/`.

## Yêu cầu

- Node.js 18+ và npm
- PHP 8.2+, Composer, MySQL (XAMPP hoặc tương đương)

## Cài đặt

```bash
# 1. Dependencies
npm install
composer install

# 2. Môi trường
copy .env.example .env        # Windows
php artisan key:generate

# 3. Tạo database + migrate
#    Tạo database `triarhythm` trong MySQL (phpMyAdmin/XAMPP) trước
php artisan migrate
```

`.env` cần trỏ đúng MySQL:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=triarhythm
DB_USERNAME=root
DB_PASSWORD=
```

## Chạy dev

Mở **2 terminal**:

```bash
# Terminal 1 - Laravel API (http://127.0.0.1:8000)
php artisan serve

# Terminal 2 - Vite frontend (http://localhost:3000, proxy /api -> :8000)
npm run dev
```

Frontend đọc `VITE_API_BASE_URL` (mặc định `/api`, xem `.env.example`).

## Test & build

```bash
npm test          # Vitest (unit tests)
npm run build     # build SPA ra dist/
```

`dist/` chỉ chứa SPA + asset trong `static/`, **không** chứa file PHP của Laravel.

## Ghi chú kiến trúc

- **IndexedDB** (`src/core/storage/db.js`) giữ beatmap, blob audio/background/video và lịch sử điểm để chơi offline.
- **MySQL** là nguồn chính cho auth/leaderboard. `src/core/api/client.js` là lớp gọi API duy nhất.
- **Import map** đi qua một luồng duy nhất: `src/core/parser/importService.js` → lưu IndexedDB + đồng bộ metadata lên MySQL.
- **PP/Star**: `src/core/pp/ppCalculator.js`, cấu hình `src/config/pp.config.js`.
- ⚠️ `MapController` hiện lưu `audio_url/cover_url/video_url` dạng URL. Với dữ liệu import từ file, đây là `blob:` URL tạm thời — cần bổ sung upload file lên `storage/app/public` nếu muốn asset tồn tại lâu dài phía server.

## Cấu trúc chính

```
src/
  components/        # Song select, gameplay, leaderboard, editor shell, modals
  config/            # layout, judgement, pp, slide
  core/
    api/             # Laravel API client
    beatmap/         # schema + validator + sample chart
    engine/          # game engine + renderers
    parser/          # osu / maimai / package + importService
    pp/              # star & PP calculator
    storage/         # IndexedDB + score flow + seed
  features/editor/   # editor hook + panels
app/Http/Controllers/Api/   # Laravel API
routes/api.php              # API routes
static/                     # asset tĩnh của game (audio, sfx)
public/                     # Laravel web-root (index.php, .htaccess)
tests/                      # Vitest
```
