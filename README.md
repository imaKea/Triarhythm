# Triarhythm

Rhythm game (React + Vite) với backend **Laravel 12 + MySQL**. IndexedDB đóng vai trò cache offline cho beatmap/asset; MySQL là nguồn sự thật cho tài khoản, map và điểm số.

## Kiến trúc

```
Frontend (React 18 + Vite)          Backend (Laravel 12)         Database
┌─────────────────────────┐  /api   ┌──────────────────────┐     ┌─────────┐
│ src/                    │ ──────► │ app/Http/Controllers │ ──► │  MySQL  │
│ - components/ (UI)      │  proxy  │   /Api/*             │     │ users   │
│ - core/ (engine/parser) │         │ routes/api.php       │     │ maps    │
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

# 4. Symlink storage để asset upload truy cập được qua /storage/...
php artisan storage:link
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

# Terminal 2 - Vite frontend (http://localhost:3000, proxy /api + /storage -> :8000)
npm run dev
```

Frontend đọc `VITE_API_BASE_URL` (mặc định `/api`, xem `.env.example`).

## Asset upload

Asset của map (audio / background / video) được upload lên **Laravel Storage**:

- Endpoint: `POST /api/maps/{song_id}/assets` (multipart, field `audio`, `background`, `video`).
- File lưu tại `storage/app/public/beatmaps/{song_id}/`, phục vụ qua `/storage/...` (cần `php artisan storage:link`).
- URL tương đối được lưu vào cột `audio_url`, `cover_url`, `video_url` của bảng `maps` và vào `serverAssets` trong IndexedDB.
- URL tạm `blob:` của trình duyệt bị bỏ qua (`MapController::cleanUrl`) để không ghi dữ liệu chết vào MySQL.
- Docker image đặt giới hạn PHP để phù hợp giới hạn từng file; frontend gửi từng asset riêng để tránh request gộp quá lớn.
- Khi deploy trên Render, `storage/app/public` cần persistent disk hoặc object storage như S3/R2 nếu muốn file vẫn tồn tại sau khi service restart/redeploy.

## Test & build

```bash
npm test          # Vitest (unit tests)
npm run build     # build SPA ra dist/
```

`dist/` chỉ chứa SPA + asset trong `static/`, **không** chứa file PHP của Laravel.

## Ghi chú kiến trúc

- **IndexedDB** (`src/core/storage/db.js`) giữ beatmap, blob audio/background/video và lịch sử điểm để chơi offline.
- **MySQL** là nguồn chính cho auth/leaderboard. `src/core/api/client.js` là lớp gọi API duy nhất.
- **Import map** đi qua một luồng duy nhất: `src/core/parser/importService.js` → lưu IndexedDB + đồng bộ metadata lên MySQL (`saveMap`) + upload asset lên Laravel Storage (`saveAssets`).
- **PP/Star**: `src/core/pp/ppCalculator.js`, cấu hình `src/config/pp.config.js`.

## Tính năng nổi bật & Giao diện chuẩn osu!(lazer)

- **Giao diện osu!(lazer) Design System**:
  - Tông màu chủ đạo: Dark violet (`#181224`), Accent pink (`#ff66ab`), Neon Purple (`#6c5ce7`).
  - Typography: Torus / Nunito / Be Vietnam Pro, JetBrains Mono cho số liệu.
  - Hiệu ứng Glassmorphism backdrop-blur, bo góc chuẩn lazer (`12px`), tab switcher, avatar tròn viền phát sáng.
  - **Song Select**: Card nghiêng góc osu!, huy hiệu xếp hạng SS/S/A/B/C/D, bộ lọc tìm kiếm tức thì (`stars>5`, `bpm<200`), nút F2 ngẫu nhiên, F5 tải lại, context menu chuột phải.
  - **Result Screen**: Cấp độ chữ cái lớn, điểm số 8 chữ số cuộn hoạt ảnh, thanh đếm số lượng phán định, biểu đồ phân bố độ lệch thời gian (UR Histogram), thống kê PP đạt được và so sánh kỷ lục cá nhân.
  - **Gameplay & Lead-in**: Đếm ngược 3-2-1 khi bắt đầu / tiếp tục từ Pause, 1 giây audio lead-in (-1000ms) chống hiện tượng "rocket note".

- **Hệ thống Quản trị (Admin Panel CRUD)**:
  - Bảng điều khiển phân tích số liệu KPI: tổng người chơi, tổng map, lượt chơi, biểu đồ 7 ngày gần nhất, phân bố cấp bậc rank.
  - Quản lý tài khoản: Đổi vai trò (user ↔ admin), cấm/bỏ cấm (ban/unban), đặt lại mật khẩu, xóa tài khoản.
  - Quản lý beatmap: Chỉnh sửa metadata trực tiếp, bật/tắt trạng thái phát hành (Draft/Published), xóa map.
  - Kiểm duyệt điểm số: Xóa điểm nghi vấn gian lận, tự động tính toán lại PP người chơi, nút "Tính lại toàn bộ PP" (Batch recalculate).
  - Nhật ký hoạt động (Audit Activity Logs): Ghi lại chi tiết mọi hành vi quản trị cùng IP và thời gian.

- **Hoàn tác Xóa Beatmap (Soft Delete, Ctrl+Z & Thùng rác)**:
  - Khi xóa map, map được đưa vào trạng thái lưu trữ an toàn (soft delete) cả trên MySQL (`deleted_at`) và IndexedDB (`deletedAt`).
  - Phím tắt **Ctrl+Z** hoặc nút trên Toast hoàn tác ngay lập tức trong vòng 7 giây.
  - Giao diện **Thùng rác Beatmap (Trash Bin)** cho phép duyệt danh sách các map đã xóa, khôi phục từng bài hoặc dọn sạch vĩnh viễn (purge binary assets).

## Cấu trúc chính

```
src/
  components/        # Song select, gameplay, leaderboard, admin panel, modals
  config/            # layout, judgement, pp, slide
  core/
    api/             # Laravel API client & Token Auth
    beatmap/         # schema + validator + sample chart
    engine/          # game engine + renderers + audio lead-in + countdown
    parser/          # osu / maimai / package + importService
    pp/              # star & PP calculator
    storage/         # IndexedDB + soft delete + score flow + seed
  ui/                # Button, Modal, Toast, Slider, Dropdown, Toggle
app/Http/Controllers/Api/   # Laravel API (Auth, Map, Score, Leaderboard, Admin)
routes/api.php              # API routes & middleware (auth.api, admin)
static/                     # asset tĩnh của game (audio, sfx)
public/                     # Laravel web-root (index.php, .htaccess)
tests/                      # Vitest & PHPUnit Feature tests
```
