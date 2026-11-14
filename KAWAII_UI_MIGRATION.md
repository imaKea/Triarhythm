# KAWAII UI MIGRATION: Triarhythm

> **Cách dùng:** đặt file này ở thư mục gốc `Triarhythm/`, rồi bảo AI agent (Claude Code, Cursor...):
> *"Đọc `KAWAII_UI_MIGRATION.md` và làm đúng theo từng bước. Dừng ở Bước 1 để tôi duyệt trước khi sửa code."*
>
> **Trước khi chạy:** commit hoặc stash các thay đổi đang dở (repo đang ở branch `feat/osu-ui`).
> Đặt thư mục `Kawaii_Rhythm_Game_UI/` (đã giải nén) cạnh `Triarhythm/` hoặc trong `Triarhythm/_ref/` để agent đọc.

---

## 1. VAI TRÒ

Bạn là senior front-end engineer. Nhiệm vụ: **PORT GIAO DIỆN "Kawaii Rhythm Game UI"** (light pastel pink, xuất từ Figma Make) vào project **Triarhythm** (React 18 + Vite + Tailwind v3 + Laravel 12).

Đây là một đợt **RESKIN THUẦN**. Tuyệt đối không thay đổi cơ chế game, logic, backend hay dữ liệu.

## 2. NGUỒN

- **Thiết kế mới (CHỈ ĐỌC, không sửa):** `Kawaii_Rhythm_Game_UI/`
  - TypeScript, React 19, Tailwind v4, CSS thường trong `src/index.css` (~2250 dòng).
  - Màn hình nằm trong `src/App.tsx`: SongSelect, GameScreen, ResultScreen, Leaderboard, UIKit, SettingsModal, LoginModal, PauseModal.
- **Project đích:** `Triarhythm/`
  - JSX, Tailwind v3 qua `tailwind.config.js`, `@tailwind` directives trong `src/styles/index.css`.
- **Bỏ qua** nút "?" và toast đỏ "Failed to download code files" trong ảnh chụp. Đó là UI của Figma Make, không implement.

---

## 3. RÀNG BUỘC TUYỆT ĐỐI (vi phạm = làm lại)

### A. VÙNG CẤM SỬA (0 dòng diff)

- `src/core/**` (engine, parser, storage, api, pp, beatmap), **NGOẠI TRỪ** đúng các chuỗi màu được liệt kê ở mục 4 (GAMEPLAY) trong 5 file:
  - `core/engine/gameplayRenderer.js`
  - `core/engine/renderers/drawLayout.js`
  - `core/engine/renderers/drawNotes.js`
  - `core/engine/renderers/drawHud.js`
  - `core/engine/particleSystem.js` (chỉ tham số màu mặc định)
- `src/config/**` (layout, judgement, slide, pp). Không sửa kể cả `minAcc`, `lane`, toạ độ, và **màu rank/judgement trong `judgement.config.js`**. Nếu cần đổi màu rank ở UI thì override ở tầng UI (ví dụ `src/ui/RankBadge.jsx`), không sửa config.
- **Toàn bộ backend:** `app/**`, `routes/**`, `database/**`, `config/*.php`, `public/**`, `storage/**`, `.env`, `composer.json`, `artisan`.
- `vite.config.js` (đặc biệt proxy `/api`), `package.json`, `package-lock.json`: không thêm/xoá/nâng cấp dependency. **KHÔNG** nâng React lên 19, **KHÔNG** nâng Tailwind lên v4, **KHÔNG** thêm TypeScript.
- `dist/**`, `static/**` (audio, hitsound): không đụng.
- **Màu judgement** (`textMap` trong `addJudgementPopup`, FAST/LATE, subColor): giữ nguyên 100% (xem mục 4).

### B. KHÔNG ĐƯỢC ĐỔI trong mọi component

State, hooks, `useEffect`, props và chữ ký hàm, event handler, keybind, các lệnh gọi `apiClient`/`dbManager`, `eventBus`, ref (`videoRef`, `canvasRef`), thứ tự render có điều kiện, id/data-attribute mà logic dùng, text hiển thị dữ liệu động (điểm, combo, accuracy, tên bài).

Chỉ được đổi: `className`, style tĩnh, CSS, và markup trang trí thuần tuý (SVG nơ/thỏ) không mang logic.

### C. KỶ LUẬT DIFF

- Không refactor, không rename, không di chuyển file, không format lại toàn file. Giữ nguyên indent và EOL (CRLF/LF) hiện có để diff sạch, review được.
- Không tạo thêm tính năng, nút, màn hình mới ngoài những gì Triarhythm đã có.
- Không chắc một thay đổi có chạm logic hay không → **KHÔNG làm**, ghi vào mục "Cần hỏi" ở báo cáo cuối.

---

## 4. GAMEPLAY: CHỈ ĐỔI MÀU, KHÔNG ĐỔI GÌ KHÁC

Áp dụng cho `components/GameplayView.jsx` và 5 file canvas ở mục 3A.

**Chỉ được sửa:** chuỗi màu hex/rgba/rgb, class màu Tailwind (`bg-[#...]`, `text-[#...]`, `from-/to-`, `border-/shadow-` màu), tham số `shadowColor`, và alpha của màu (khi cần giữ độ tương phản trên nền sáng).

**CẤM đổi:** kích thước, bán kính, `lineWidth`, font, toạ độ, vị trí DOM, cấu trúc JSX, thứ tự vẽ, công thức/animation/timing, `travelTime`, hit window, particle count/speed, bất kỳ dòng logic nào. Không thêm/bớt phần tử HUD (không thêm ảnh bìa thỏ, nơ giữa... nếu hiện chưa có). Chỉ recolor phần tử đã tồn tại.

Bảng đổi màu dưới đây tra giá trị hiện tại trong code rồi thay. Nếu số dòng lệch thì tìm theo nội dung.

### 4.1 Nền (`drawLayout.js` ~L25-33, `GameplayView.jsx` L414)

| Hiện tại | Đổi thành |
|---|---|
| `#040507` (canvas, không video) | Gradient kawaii `linear-gradient(145deg, #ffd9e5, #f8a3bb 42%, #ffdce7)`. Trong canvas dùng `createLinearGradient` với đúng 3 màu này |
| `rgba(4,5,7,dim)` (lớp dim khi có video) | `rgba(255,217,229,dim)`. Giữ nguyên biến `backgroundDim` |
| `bg-[#090912]` (wrapper GameplayView) | Cùng gradient ở trên |
| `bg-[#140b17]/90` (overlay pause) | `bg-[#fff5f8]/80`, giữ blur |

### 4.2 Đường ray / sân (`drawLayout.js`)

- Rail `#ffffff`: giữ.
- Halo `rgba(255,255,255,0.08)` → `rgba(255,255,255,0.55)`.
- Guide line `rgba(255,255,255,0.12)` → `rgba(255,255,255,0.35)`.
- Ô tap:
  - fill idle `rgba(255,255,255,0.015)` → `rgba(255,255,255,0.17)`
  - stroke idle `rgba(255,255,255,0.32)` → `#ffffff`
  - fill active `rgba(255,255,255,0.18)` → `rgba(255,255,255,0.55)`
- Badge phím idle:
  - nền `rgba(15,23,42,0.90)` → `#ffffff`
  - viền `rgba(0,229,255,0.6)` → `#ff7ca0`
  - chữ phím `#ffffff` → `#e94270`
- Badge phím active:
  - nền `#ffe082` → `#ffd76f`
  - chữ `#0f172a` → `#5b2a47`
  - `shadowColor` `#ffe082` → `#ff4d80`
- Lane 1 (disabled): nền → `rgba(255,255,255,0.7)`, viền và chữ → `#e8284f` (vẫn khác biệt rõ với các lane còn lại).
- Hub giữa:
  - `rgba(12,15,22,.95)` → `#ffffff`
  - `rgba(22,26,36,.9)` → `#ffd6e0`
  - viền → `#ff86a5` (vòng ngoài), `#ff7ca0` (vòng trong)
  - chấm giữa `#ffffff` → `#ff4d80`

### 4.3 Notes (`drawNotes.js` L52-62, L268, L305, L522)

| Loại | Hiện tại | Đổi thành |
|---|---|---|
| Tap | `#ff2a70` | `#ff6f99` |
| Each | `#ffe600` | `#ffd76f` |
| Hold | `#ff9100` | `#ff9d62` |
| Break | `#ff3d00` | `#e8284f` |
| Hold bị thả sớm | `#607d8b` | `#b9a3ad` (xám sáng hơn) |
| Slide/star | `#00e5ff`, aura `rgba(0,229,255,.28)` | `#67b9ed`, aura `rgba(103,185,237,.35)` |
| Slide xanh lá | `#00e676`, aura `rgba(0,230,118,.35)` | Dải xanh dương: dùng `#8fd0f5` để vẫn phân biệt được với slide thường |

- Viền trắng quanh note: giữ nguyên.
- Các pill/thanh nền tối `rgba(8,12,18,.92)`, `rgba(10,13,19,.96)`, `rgba(10,14,22,.94)` → `rgba(255,255,255,0.85)`.
- Viền cyan `#00e5ff` / `#06b6d4` → `#ff7ca0`.
- Chữ trên các nền đó đổi sang `#5b2a47` hoặc `#e94270` để đọc được.

### 4.4 HUD canvas (`drawHud.js`, `gameplayRenderer.js`)

- Chữ trắng trên nền hồng nhạt phải đọc được: thêm/đổi `shadowColor` sang `rgba(233,66,112,.55)`. Không đổi cỡ chữ.
- **Judgement popup (`addJudgementPopup`: `textMap`, FAST/LATE, `customSub`): GIỮ NGUYÊN 100% mọi màu.**
  - Giữ: CRITICAL `#ffea00`, PERFECT `#ffd600`, GREAT `#00e676`, GOOD `#ff9100`, MISS `#78909c`, subColor trắng, FAST `#00e5ff`, LATE `#ff5252`, `customSub` `#00e5ff`.
  - Không đổi hex, không đổi alpha.
  - Nếu chữ khó đọc trên nền hồng, chỉ được thêm/đổi `shadowColor` (bóng đổ) rồi báo lại trong báo cáo. Không đụng màu chữ.
  - Áp dụng tương tự cho chữ judgement hiển thị ở DOM (nếu có).
- UR bar: chỉ đổi nền thanh tối → `rgba(255,255,255,0.45)` và vạch giữa trắng → `#ff4d80`. **Màu tick theo judgement (`#ffd54f` / `#ffffff`) giữ nguyên.**
- Badge rank:
  - badge thường `#ff2a70` → `#ff6f99`
  - badge rank vàng (`#ffd700`, chữ `#000000`): **giữ nguyên**

### 4.5 Particle (`particleSystem.js`)

- Chỉ đổi tham số màu mặc định: burst `#ff4081` → `#ff4d80`.
- Ripple `#ffffff` giữ nguyên.
- Không đổi count, speed, duration.

### 4.6 DOM trong `GameplayView.jsx`

- Progress bar `from-[#cc5289] to-[#ff66ab]` → phần chạy `#ffffff`, track `rgba(255,255,255,.35)` (giống Kawaii).
- Chữ phụ `text-[#b8c0d4]`, `text-[#7c849c]` → `text-[#a8556f]` hoặc `text-white/90` tuỳ nền.
- Điểm số, combo → trắng có `drop-shadow` hồng đậm `rgba(233,66,112,.45)`.
- **KHÔNG đổi màu bất kỳ chữ judgement nào** (PERFECT/GREAT/GOOD/MISS...).
- Panel đếm bên phải `bg-[#111122]/70` → `bg-white/40`.
- Nút kết thúc `bg-[#111122]/90` → `bg-white/70`.
- Accent `#ff66ab` → `#ff4d80`.
- Menu pause: nền `rgba(255,245,248,.8)`, chữ `#5b2a47`, nút active gradient `#ff85a2 → #ff4d80`.

---

## 5. CÁC MÀN HÌNH CÒN LẠI (được restyle đầy đủ, vẫn tuân thủ mục 3B)

Song select (`AstroSongSelect`), Result (`AstroResultScreen`), Leaderboard, Navbar (`RhythmNavbar`), Settings, Auth, Profile, UI Kit, `src/ui/*` (Button, Modal, Toggle, Slider, Tabs, Toast, Dropdown, RankBadge...), PlayerLoader.

Bám sát `App.tsx` + `index.css` của bản Kawaii:

- Bảng màu: `--pink #ff85a2`, `--hot #ff4d80`, `--plum #5b2a47`, `--pale #fff5f8`, `--red #e94267`, `--line #f3dbe4`
- Font Nunito 900, bo góc lớn, kính mờ, nơ/thỏ SVG

`AdminPanel.jsx` (1330 dòng, không có trong thiết kế Kawaii): chỉ để nó hưởng token màu mới, không restructure.

---

## 6. KỸ THUẬT PORT (các bẫy đã biết)

1. **KHÔNG copy nguyên `Kawaii/src/index.css`** vào project. Nó có rule global (`button{border:0;background:none}`, `body{...}`) và class dễ trùng (`.screen`, `.icon`, `.combo`, `.target`, `.judgement`, `.round-btn`...) sẽ phá component hiện có.
   - Tạo `src/styles/kawaii.css`, bọc mọi rule dưới `.kw-theme` **hoặc** prefix `kw-`.
   - Import sau `index.css` trong `main.jsx`.
   - Port luôn media query responsive ở cuối file nguồn (~dòng 2251).
2. **Tailwind v4 ≠ v3:** không dùng `@import "tailwindcss"`, `@theme`, `@utility` hay cú pháp v4 trong code đích. Sửa token trong `tailwind.config.js` chỉ ở `theme.extend` (colors, boxShadow, borderRadius). Không đổi `content`, không thêm plugin.
3. **TSX → JSX:** bỏ type annotation. `Bow`/`Bunny`/`Icon` chuyển thành component JSX trong `src/ui/kawaii/`.
4. **Đổi theme tối → sáng:** trước khi sửa, `grep` toàn `src/` các mẫu:
   - `text-white`, `text-white/`, `bg-white/[`, `border-white/`
   - `bg-[#0`, `bg-[#1`, `from-[#`
   - `osu-dark|osu-darker|osu-panel|kawaii-dark|kawaii-panel`
   - `var(--osu-`, `var(--kawaii-`

   Lập bảng map theo vai trò (nền, panel, chữ chính, chữ phụ, viền, accent). Ưu tiên đổi token (`:root` vars + `tailwind.config.js`) để lan ra toàn app, rồi sửa tay các hex cứng còn sót. Với mỗi `text-white` nằm trên panel đã chuyển sang sáng → đổi sang `text-[#5b2a47]`. Tương phản chữ thường ≥ 4.5:1.
5. `index.css` hiện có `body{background-color:#140b17}` và scrollbar tối → chuyển sang `#fff5f8` và scrollbar hồng.
6. Giữ nguyên font Orbitron trong canvas (đó là font, không phải màu).
7. `prefers-reduced-motion` và animation hiện có: giữ nguyên.

---

## 7. QUY TRÌNH (làm tuần tự, commit sau mỗi giai đoạn)

| Bước | Việc cần làm |
|---|---|
| **0** | `git checkout -b feat/kawaii-light-ui`. Chạy `npm run build` lấy baseline và ghi nhận kết quả. |
| **1** | **KHẢO SÁT, KHÔNG SỬA:** liệt kê file sẽ chạm, bảng map token cũ → mới, danh sách chuỗi màu trong 6 file gameplay. **DỪNG lại** đưa người dùng duyệt, nhất là nếu phát hiện điều gì mâu thuẫn với ràng buộc. |
| **2** | Token + `kawaii.css` + `tailwind.config.js` + `index.css` + font. |
| **3** | `src/ui/*` và `RhythmNavbar`. |
| **4** | Song select, Leaderboard, Result, Settings, Auth, Profile, UI Kit, PlayerLoader, AdminPanel (chỉ token). |
| **5** | **GAMEPLAY (recolor-only)**, làm trong **một commit riêng** để review diff riêng. |
| **6** | Kiểm chứng (mục 8). |

---

## 8. KIỂM CHỨNG BẮT BUỘC TRƯỚC KHI BÁO XONG

1. Diff vùng cấm phải rỗng, ngoại trừ 5 file renderer/particle ở mục 3A:

   ```bash
   git diff --stat main..HEAD -- src/core src/config app routes database public vite.config.js package.json package-lock.json composer.json
   ```

2. `git diff -U0` của 5 file renderer/particle và `GameplayView.jsx`: mọi dòng +/- chỉ chứa chuỗi màu hoặc class màu. Dòng nào chứa số khác (`lineWidth`, `radius`, toạ độ, thời gian) hoặc logic thì hoàn tác. **In diff này ra trong báo cáo.**
3. Grep xác nhận màu judgement không đổi: các giá trị `#ffea00`, `#ffd600`, `#00e676`, `#ff9100`, `#78909c`, `#00e5ff`, `#ff5252` trong `textMap`/FAST/LATE của `gameplayRenderer.js` còn nguyên.
4. `npm run build` pass, không lỗi/warning mới so với baseline.
5. Không còn `text-white` vô hình trên nền sáng. Không còn hex tối (`#04`, `#09`, `#0f`, `#1e1124`, `#160c1a`, `#28162e`) trong UI, trừ khi có lý do ghi rõ.
6. Checklist chạy tay (liệt kê để người dùng test):
   - đăng nhập / đăng ký
   - import beatmap (kéo thả)
   - chọn bài
   - vào chơi bằng phím; tap/hold/slide/break nhận đúng và đúng thời điểm
   - pause / resume / thoát
   - màn kết quả + lưu điểm
   - leaderboard
   - đổi settings (note speed, dim, keybind) rồi vào game thấy áp dụng
   - admin panel
   - UI Kit

---

## 9. BÁO CÁO CUỐI

1. Danh sách file đã sửa, theo nhóm.
2. Bảng màu cũ → mới thực tế đã áp cho gameplay.
3. Kết quả các lệnh kiểm chứng ở mục 8.
4. Mục **"Cần hỏi / không dám làm"** (nếu có).
5. Rủi ro còn lại: độ đọc được của chữ judgement (vàng/xanh lá) trên nền hồng. Chỉ xử lý bằng `shadowColor` nếu cần, không đổi màu chữ.
