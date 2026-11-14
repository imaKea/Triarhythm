# VAI TRÒ
Bạn là Senior Full-Stack Game Developer chuyên về Web Audio API, HTML5 Canvas và Rhythm Game (osu!, maimai DX, Rhythm Typer). Bạn viết code production-grade, có comment tiếng Việt cho phần logic khó, không dùng pseudo-code, không để "TODO" hay "...phần còn lại tương tự".

# MỤC TIÊU
Xây dựng hoàn chỉnh game nhịp điệu trên Web theo phong cách VSRG của maimai: note bay từ **tâm tam giác** ra các ô judgement nằm trên **vòng tam giác ngược**. 9 phím bàn phím cho Tap/Hold/Break, **chuột** cho Slide (ngôi sao trượt nối 3 lục giác ở 3 đỉnh), thêm đoạn gõ chữ (Typing Section) theo ý tưởng Rhythm Typer. Có parser `.osu/.osz`, Beatmap Editor, đăng nhập, cài đặt, trình duyệt bản đồ cộng đồng, bảng xếp hạng và hệ thống PP. Giao diện Neon Cyber / Arcade lấy cảm hứng từ maimai DX.

# 0. TRIẾT LÝ THIẾT KẾ
1. **Dễ đọc:** **không có approach circle.** Người chơi biết bấm ô nào nhờ **hướng bay của note từ tâm**. Ký tự phím chỉ là phụ trợ mờ trong ô.
2. **Web-first:** vào link là chơi được, không cài đặt, không bắt buộc đăng nhập (có Guest).
3. **Bản đồ tùy chỉnh:** ai cũng tạo, chia sẻ, chơi được; import từ `.osu/.osz`.
4. **Cạnh tranh:** PP, bảng xếp hạng bài và toàn cầu.
5. **Cộng đồng:** map browser, hồ sơ mapper, link chia sẻ, nút Discord, playtest trước khi đăng.

# 1. CÔNG NGHỆ (CHỐT, KHÔNG TỰ ĐỔI)
- Vite + Vanilla ES6 modules cho **game engine**; React 18 + Tailwind CSS chỉ cho UI ngoài gameplay (menu, settings, editor panel, browser, leaderboard).
- Game loop dùng `requestAnimationFrame` trên Canvas 2D, **tách hoàn toàn khỏi React state** (giao tiếp qua event bus hoặc store ngoài React).
- Thời gian game = `audioCtx.currentTime` (bù `outputLatency`/`baseLatency` + user offset). **Cấm** dùng `Date.now()` / `setInterval` để tính thời điểm nốt.
- Timestamp phím/chuột: quy đổi `event.timeStamp` (performance.now) sang audio time bằng cặp mốc `(performance.now(), audioCtx.currentTime)` lấy lúc bắt đầu bài và re-sync định kỳ.
- Firebase v10 modular: Auth (Google, Email, Anonymous = Guest), Firestore (users, charts, scores, leaderboards), Storage (nhạc/ảnh/video khi chia sẻ). Bản cục bộ lưu IndexedDB.
- Thư viện cho phép: `jszip`, `idb`, `vitest`. Hạn chế thêm dependency khác.

# 2. BỐ CỤC VÒNG TAM GIÁC NGƯỢC (ĐÃ CHỐT, THEO BẢN PHÁC)
Tam giác ngược (đỉnh nhọn hướng xuống) gồm các thành phần sau. Tất cả tọa độ nằm trong `layout.config.js` (id layout: `"triRing9"`).

| Thành phần | Mô tả | Màu mặc định (theo bản phác) |
|---|---|---|
| **Ring** | Viền tam giác đi qua 3 đỉnh | đỏ neon |
| **9 ô Tap** | Hình elip nằm trên 3 cạnh, mỗi cạnh 3 ô, trục dài dọc theo cạnh, xoay theo góc cạnh | viền trắng sáng (bản phác dùng nét đen) |
| **3 Slide Node** | Lục giác (đỉnh hướng lên) đặt ở 3 đỉnh tam giác | xanh lá |
| **Ngôi sao Slide** | Sao 5 cánh | xanh dương |
| **Origin** | Tâm tam giác, nơi mọi note xuất phát; vẽ một hub nhỏ phát sáng | |

**Hình học (đơn vị lưới, tam giác đều cạnh 2, tâm tại (0,0), trục y hướng xuống):**
- Đỉnh: `TL = (-1, -0.577)`, `TR = (1, -0.577)`, `B = (0, 1.155)`.
- Ô Tap nằm tại `t = 0.22, 0.50, 0.78` dọc mỗi cạnh; bán trục elip `a = 0.17` (dọc cạnh), `b = 0.12` (vuông góc cạnh).
- Slide Node: bán kính `hexRadius = 0.15`. `noteRadius = 0.10`. `spawnFrac = 0.18`.

| Lane | Phím | Cạnh | x | y |
|---|---|---|---|---|
| 0 | `7` | trên (TL→TR) | -0.56 | -0.577 |
| 1 | `8` | trên | 0.00 | -0.577 |
| 2 | `9` | trên | 0.56 | -0.577 |
| 3 | `Y` | trái (TL→B) | -0.78 | -0.196 |
| 4 | `H` | trái | -0.50 | 0.289 |
| 5 | `N` | trái | -0.22 | 0.774 |
| 6 | `O` | phải (TR→B) | 0.78 | -0.196 |
| 7 | `K` | phải | 0.50 | 0.289 |
| 8 | `M` | phải | 0.22 | 0.774 |

| Node | Vị trí | Tọa độ |
|---|---|---|
| S0 | đỉnh trên-trái | (-1, -0.577) |
| S1 | đỉnh trên-phải | (1, -0.577) |
| S2 | đỉnh dưới | (0, 1.155) |

- Mọi dữ liệu chart dùng **chỉ số lane 0–8** và **chỉ số node 0–2**, không dùng ký tự phím.
- **Perimeter order** (dùng cho parser): đi vòng từ đáy trái lên, qua cạnh trên, xuống đáy phải: `[5,4,3,0,1,2,6,7,8]` (`N H Y 7 8 9 O K M`).
- Hàm duy nhất `layoutToPixels(w, h)` dùng chung cho Game và Editor. Vùng bao của layout (gồm cả hexagon) là x ∈ [-1.2, 1.2], y ∈ [-0.8, 1.35]; canvas fit vào vùng này, giữ tỉ lệ, scale theo `devicePixelRatio`. Hàm ngược `pixelsToLayout` dùng cho chuột.
- Mỗi ô Tap: viền sáng, ký tự phím hiện tại (theo Keybind) ở giữa, sáng lên khi bấm. Mỗi Slide Node: sáng lên khi con trỏ nằm trong.
- **Unit test hình học (bắt buộc):** (1) không có hai ô Tap nào, và không có ô Tap nào với hexagon, chồng lên nhau (khoảng hở ≥ 0.03); (2) in ra khoảng cách tối thiểu từ mỗi tia bay (origin → tâm ô/node) tới các ô khác. Nếu test (1) fail, chỉnh `t`, `a`, `b` trong config thay vì sửa code.
- **Layout là dữ liệu:** engine đọc layout theo id (`"triRing9"` mặc định, trường `layout` trong beatmap); một layout gồm ring, danh sách ô tap `{lane, code, label, x, y, angle, a, b}`, danh sách slide node, `origin`, `noteRadius`, `spawnFrac`. Hiện chỉ cài `triRing9`.
- **Keybind mặc định** dùng `event.code`: `Digit7`/`Numpad7`, `Digit8`/`Numpad8`, `Digit9`/`Numpad9`, `KeyY`, `KeyH`, `KeyN`, `KeyO`, `KeyK`, `KeyM`. Mỗi lane gán được nhiều phím; Settings cho đổi từng ô, chặn trùng, "Reset mặc định", preset không-Numpad.

# 3. CƠ CHẾ GAMEPLAY
**Chuyển động note:** mỗi note có `time` (ms, lúc tâm note trùng tâm đích) và đích (ô Tap hoặc Slide Node). Note xuất hiện gần `origin` và bay **thẳng đều** theo tia tới đích. Không vẽ vòng thu nhỏ.
```
travelTime (ms) tính từ Note Speed NS 1.0–10.0, bước 0.1:
  NS < 5  : travelTime = 1200 + 600 * (5 - NS) / 5      // NS1 = 1800ms
  NS = 5  : travelTime = 1200
  NS > 5  : travelTime = 1200 - 750 * (NS - 5) / 5      // NS10 = 450ms

p     = (now - (time - travelTime)) / travelTime         // p = 1 khi note trùng đích
S     = origin + (P_dich - origin) * spawnFrac
pos   = S + (P_dich - S) * p
scale = 0.5 + 0.5 * min(1, p / 0.3)
alpha = min(1, p / 0.12)
```
- Note xuất hiện lúc `p = 0`. Note MISS vẫn bay tiếp tới `p = 1.12` rồi mờ dần.
- **Thứ tự vẽ:** ring, ô tap, node → đường Slide → note xa đích (p nhỏ) → note gần đích (p lớn, đè lên). Note có `time` sớm hơn luôn nằm trên.
- **Màu note:** Tap hồng, Hold cam vàng, Break cam đỏ kèm viền sáng, ngôi sao Slide xanh dương. Hai note có `time` trùng nhau (≤ 1ms) đổi sang màu vàng ("each") để nhận ra cặp bấm đồng thời.

1. **Tap:** bấm đúng phím trong cửa sổ chấm điểm. Ô elip chỉ là hiển thị, phán định chỉ phụ thuộc phím và thời gian.
2. **Hold:** `time` → `endTime`. Vẽ thành **dải capsule dọc theo tia**: head tới ô lúc `time`, tail tới ô lúc `endTime` (mỗi `p` bị kẹp tối đa 1). Khi head đã tới ô, head dừng lại và dải co dần khi tail tiến vào; lúc đang giữ, dải sáng lên kèm hiệu ứng tia chạy. Thả sớm thì mất phần điểm cuối (theo tỉ lệ thời gian giữ), đứt combo, dải chuyển xám; thả trong cửa sổ đầu/cuối thì tính đủ. Hold ngắn hơn `minHoldMs` (mặc định 250ms) khi import sẽ bị đổi thành Tap.
3. **Break:** màu cam đỏ/vàng, âm thanh + particle riêng, điểm gốc cao, có Break bonus để Achievement vượt 100% (tối đa 101.0000%).
4. **Slide (chuột) [Hình]:**
   - **Dữ liệu:** `time`, `path` (danh sách chỉ số node, 2 đến 4 phần tử, hai phần tử liền kề phải khác nhau, ví dụ `[0,1]` = trên-trái → trên-phải, `[0,1,2]` = chuỗi 2 chặng, `[0,1,2,0]` = đi trọn vòng), `waitBeats` (mặc định 1), `beatsPerSegment` (mặc định 2).
   - **Giai đoạn 1 – Bay vào:** ngôi sao bay từ `origin` tới node đầu như một note thường, tới nơi đúng lúc `time`.
   - **Giai đoạn 2 – Hiện đường đi:** **chỉ khi sao tới node** thì đường đi tiếp theo mới hiện ra (quét từ node đầu tới node cuối trong 150ms), vẽ bằng chuỗi mũi tên chevron nối các node. Mặc định trước `time` không vẽ đường đi; Settings có tùy chọn `slidePathPreview = onArrive | early` (early: vẽ mờ ngay khi sao xuất hiện).
   - **Giai đoạn 3 – Chờ 1 nhịp:** sao đứng yên trong node đầu `waitMs`.
   - **Giai đoạn 4 – Lướt:** sao trượt dọc đường đi, **tốc độ phụ thuộc BPM của bài:**
     ```
     beatLen    = beatLength của timing point GỐC (uninherited) đang hiệu lực tại `time`
     waitMs     = clamp(waitBeats * beatLen, 250, 1000)
     segMs      = clamp(beatsPerSegment * beatLen, 350, 1500)   // thời gian cho mỗi chặng giữa hai node
     glideStart = time + waitMs
     glideMs    = segMs * (path.length - 1)
     glideEnd   = glideStart + glideMs
     ```
     Các hằng số clamp đặt trong `slide.config.js`. Giá trị `waitMs/segMs` tính một lần lúc nạp chart (BPM đổi giữa chừng không làm Slide đang chạy đổi tốc độ).
   - **Đường đi:** mỗi chặng từ node A tới node B là polyline `[A, A', B', B]`, trong đó `A'`, `B'` là A, B dịch vào trong (về phía tâm tam giác) `slideInset = 0.12`. Phần song song `A'→B'` đi sát mép trong dãy ô Tap giống bản phác, phần móc `A→A'`, `B'→B` nằm gọn trong hexagon. Sao di chuyển đều theo độ dài cung trên polyline của từng chặng.
   - **Input và phán định:** người chơi nhấn giữ **chuột trái** và để con trỏ bám theo ngôi sao. Không có phán định riêng lúc nhấn.
     ```
     onTrack(t) = chuột trái đang giữ  &&  khoảng cách(con trỏ, tâm sao tại t) <= followRadius
     followRadius = 0.22 * hệ số Settings (0.5–2.0)
     ratio        = thời gian onTrack trong [glideStart, glideEnd] / glideMs
     reachedEnd   = có mẫu onTrack trong [glideEnd - 100ms, glideEnd + 150ms]
     ```
     Sao dừng ở node cuối thêm 150ms sau `glideEnd` rồi mờ. Đánh giá `onTrack` tại mỗi frame **và** mỗi pointer event (kể cả `getCoalescedEvents()`), mỗi mẫu có trọng số bằng khoảng thời gian tới mẫu kế (tối đa 50ms).
     | Điều kiện | Phán định |
     |---|---|
     | `reachedEnd` và `ratio ≥ 0.92` | CRITICAL PERFECT |
     | `reachedEnd` và `ratio ≥ 0.80` | PERFECT |
     | `reachedEnd` và `ratio ≥ 0.65` | GREAT |
     | `reachedEnd` và `ratio ≥ 0.45` | GOOD |
     | còn lại | MISS |
     Ngưỡng nằm trong `slide.config.js`. Kéo ngược hoặc đi tắt không ăn vì sao chỉ đi tới. Nhả chuột giữa chừng thì tính off-track, được bắt lại nếu con trỏ quay về gần sao.
   - Slide không đóng góp vào UR bar. HUD hiện nhãn phán định kèm `ratio %` tại node cuối. Phát sample `slide-start` đúng lúc `glideStart` (để người chơi biết lúc sao bắt đầu đi) và `slide-end` khi thành công.
   - Dùng Pointer Events (`pointerdown/move/up`, `setPointerCapture`). Con trỏ đổi thành vòng sáng khi đang chơi; kích thước vòng theo Settings.
   - Tap/Hold và Slide được chồng thời gian (một tay phím, một tay chuột). Chuột chỉ điều khiển **1 Slide tại một thời điểm**; Editor cảnh báo khi hai Slide chồng nhau trong `[time - 200, glideEnd + 200]`.
5. **Typing Section:** đoạn chart gõ chữ cái theo nhịp.
   - Dữ liệu: `time`, `endTime`, `chars: [{time, char}]`.
   - Render: **dải chữ cuộn ngang** ở mép dưới canvas (ngoài vùng tam giác); các chip ký tự trôi từ **phải sang trái** về vạch phán định ở đầu trái, thời gian trôi dùng cùng `travelTime`. Chip tới hạn nổi bật, chip đã gõ đổi màu theo phán định. Trong đoạn Typing, 9 ô Tap được làm mờ.
   - Input: dùng `event.key` (chuẩn hóa chữ thường, bỏ qua phím bổ trợ và `isComposing`), không dùng bảng keybind 9 ô.
   - Phán định: cùng cửa sổ thời gian như Tap. Gõ sai chữ trong cửa sổ GOOD thì ghi 1 lỗi (đứt combo, bật/tắt được), không tiêu thụ ký tự. Không gõ kịp thì MISS.
   - Ràng buộc: trong `[time - 300ms, endTime + 300ms]` không được có note Tap/Hold/Break/Slide.
6. **Chấm điểm:**
   - Mức: `CRITICAL PERFECT`, `PERFECT`, `GREAT`, `GOOD`, `MISS`. Cửa sổ cho Tap/Hold/Break/Typing (`judgement.config.js`): CP ±25ms, P ±50ms, GREAT ±100ms, GOOD ±150ms, ngoài đó = MISS.
   - HUD: nhãn phán định tại đích, bảng combo, Accuracy / Achievement %, **UR Bar** (vạch sớm/muộn, tick trung bình; UR = độ lệch chuẩn × 10), tiến độ bài.
   - Trọng số: Tap 1, Hold 2, Slide 3, Break 5, Typing char 1. CP = 100%, P = 80%, GREAT = 50–80% (theo loại), GOOD = 25%, MISS = 0. Break bonus cộng tối đa +1.0000%.
   - Rank: `SSS+ ≥100.5`, `SSS ≥100`, `SS+ ≥99.5`, `SS ≥99`, `S+ ≥98`, `S ≥97`, `AAA ≥94`, `AA ≥90`, `A ≥80`, `B ≥75`, còn lại `C`. Hiển thị cờ `AP` / `FC`.
7. **Hit sound:** phát bằng Web Audio (`AudioBufferSourceNode`, preload và decode sẵn mọi sample, **không** tạo `<audio>` mới mỗi lần bấm), giới hạn tối đa 24 voice đồng thời. Ưu tiên volume: note → timing point → Settings. Sample lấy từ gói map nếu có (xem mục 5), nếu không dùng sample mặc định của game.
8. **Video nền:** hỗ trợ `<video>` làm nền (tắt tiếng), mỗi frame so `video.currentTime` với `audioTime - videoOffset`, lệch > 80ms thì đồng bộ lại; có tùy chọn tắt video. Background Dim áp dụng cho cả ảnh và video.

# 4. ĐỊNH DẠNG BEATMAP (JSON CHUẨN)
```json
{
  "version": 2,
  "layout": "triRing9",
  "metadata": { "id": "", "title": "", "artist": "", "creator": "", "creatorUid": "", "difficultyName": "", "stars": 0, "previewTime": 0, "source": "osu|manual", "tags": [] },
  "assets": { "audio": "audio.ogg", "background": "bg.jpg", "video": null, "videoOffset": 0, "hitsounds": { "normal": "soft-hitnormal.wav" } },
  "settings": { "noteSpeed": 8, "audioLeadIn": 0 },
  "timingPoints": [ { "time": 0, "bpm": 240, "beatLength": 250, "meter": 4, "uninherited": true, "volume": 90, "sampleSet": "soft" } ],
  "notes": [
    { "type": "tap",   "time": 2000, "lane": 0 },
    { "type": "hold",  "time": 3000, "endTime": 4000, "lane": 4 },
    { "type": "break", "time": 5000, "lane": 7 },
    { "type": "slide", "time": 6000, "path": [0, 1, 2], "waitBeats": 1, "beatsPerSegment": 2 },
    { "type": "typing", "time": 10000, "endTime": 11000,
      "chars": [ { "time": 10000, "char": "h" }, { "time": 10250, "char": "i" } ] }
  ]
}
```
`stars` do hệ thống tự tính. `noteSpeed` là mặc định của chart, người chơi ghi đè trong Settings. Viết JSON Schema + `validateBeatmap()`: lane 0–8; node 0–2; `path` dài 2–4 và không có hai phần tử liền kề trùng nhau; `waitBeats` ∈ [0.5, 4]; `beatsPerSegment` ∈ [0.5, 8]; thời gian không giảm; `endTime > time`; Typing không chồng note khác; Slide chồng Slide chỉ là cảnh báo, không phải lỗi.

# 5. PARSER `.OSU` / `.OSZ`
Viết `parseOsu(text)` (JS thuần, không phụ thuộc DOM) hỗ trợ định dạng v14 và bản cũ, và `importPackage(file)` dùng JSZip. Xuất đúng JSON ở mục 4.

**Đóng gói (`importPackage`):**
- Nhận `.osz` **và** `.zip`. Gói có thể bị **bọc trong một thư mục gốc** (như file mẫu): tìm `.osu` đệ quy, phân giải đường dẫn asset tương đối theo thư mục chứa `.osu`, so tên file không phân biệt hoa thường.
- Gói có nhiều `.osu` thì cho người dùng chọn độ khó.
- Chỉ giải nén các file thật sự dùng: audio, ảnh nền, video và các hitsound khớp mẫu `^(normal|soft|drum)-hit(normal|whistle|finish|clap)\d*\.(wav|ogg|mp3)$`. **Bỏ qua** `.osb` và mọi thư mục storyboard (`SB/`).
- `decodeAudioData` có thể lỗi với `.ogg` trên một số trình duyệt (đặc biệt Safari): bắt lỗi và hiện thông báo thân thiện.

**Các section:**
1. `[General]`: `AudioFilename`, `AudioLeadIn`, `PreviewTime`, `Mode`, `SampleSet`.
2. `[Metadata]`: `Title`, `TitleUnicode`, `Artist`, `ArtistUnicode`, `Creator`, `Version`, `BeatmapID`, `Tags`. Ưu tiên bản Unicode. **Loại ký tự ẩn** (U+200B/200C/200D/FEFF) khỏi mọi chuỗi.
3. `[Difficulty]`: `CircleSize` (với Mode 3 chính là số phím `keys`), `SliderMultiplier`.
4. `[Events]`: ảnh nền (`0,0,"..."`) và video nếu có; lưu `videoOffset`.
5. `[TimingPoints]`: `time,beatLength,meter,sampleSet,sampleIndex,volume,uninherited,effects`.
   - Sắp xếp ổn định theo `time`; khi trùng `time` thì điểm gốc (`uninherited=1`) đứng trước.
   - `bpm = 60000 / beatLength` cho điểm gốc; **gộp** các điểm gốc liên tiếp có `beatLength` giống hệt nhau.
   - Điểm kế thừa (`beatLength` âm) chỉ dùng cho SV của slider ở Mode 0, **bị bỏ qua với Mode 3**.
   - `sampleSet`: 0 = theo `[General]`, 1 = normal, 2 = soft, 3 = drum.
   - Dựng lưới nhịp (Beat Snap 1/1, 1/2, 1/3, 1/4, 1/6, 1/8) từ các điểm gốc đã gộp, tính lại theo từng đoạn BPM.
6. `[HitObjects]` (`x,y,time,type,hitSound,objectParams,hitSample`), `type` là bitmask (giá trị 5 = tap + cờ new-combo, vẫn là tap):
   - `type & 1` → tap.
   - `type & 128` → hold, `endTime` là trường đầu của phần cuối (`endTime:hitSample`, ví dụ `358,192,26000,128,0,27000:0:0:0:0:` → hold từ 26000 tới 27000).
   - `type & 2` (slider, chỉ Mode 0) → mặc định thành hold: `duration = pixelLength / (SliderMultiplier * 100 * svMult) * beatLength * slides`. Tùy chọn: chuyển thành `slide` nối hai Slide Node gần điểm đầu/cuối nhất (bỏ nếu trùng node).
   - `type & 8` (spinner) → bỏ qua.
   - `hitSound` bitmask (`2` whistle, `4` finish, `8` clap) → ghi vào `hitsound.additions`; tùy chọn `finish` → `break`.

**Chuyển đổi sang `triRing9`:**
- **Mode 3 (mania):** `col = floor(x * keys / 512)`. Chia vòng perimeter `[5,4,3,0,1,2,6,7,8]` thành `keys` nhóm liên tiếp, ranh giới `round(c * 9 / keys)`. Với 5 phím: cột 0 → `{N,H}`, cột 1 → `{Y,7}`, cột 2 → `{8}`, cột 3 → `{9,O}`, cột 4 → `{K,M}`. Trong nhóm, chọn lane **dùng lâu nhất** (để tránh nhấn lặp một phím). Lane bị hold khóa tới hết `endTime`. Nếu cả nhóm không có lane trống thì "tràn" sang lane gần nhất trên vòng perimeter; nếu vẫn không có thì bỏ nốt và đếm.
- **Mode 0:** `px = (x/512*2 - 1)`, `py = -0.577 + (y/384) * 1.732`, chọn ô Tap có tâm gần nhất.
- **Làm gọn mật độ (hộp thoại import có xem trước số nốt trước/sau):**
  | Tham số | Mặc định | Ý nghĩa |
  |---|---|---|
  | `minGapMs` | 100 | khoảng cách tối thiểu giữa hai thời điểm bấm liên tiếp, nốt đến sớm giữ lại |
  | `maxChord` | 3 | số nốt tối đa bấm cùng lúc |
  | `minHoldMs` | 250 | hold ngắn hơn thì đổi thành tap |
  | `sameLaneMinGapMs` | 150 | hai nốt cùng lane tối thiểu cách nhau |
  Preset: "Giữ nguyên" (`minGapMs=0`), "Vừa" (mặc định), "Dễ" (`minGapMs=250`).
- **Chèn Slide thử** (`autoSlide`, mặc định tắt): cứ mỗi `everyBeats` (mặc định 16) nhịp chèn một Slide, `path` xoay vòng `[0,1]`, `[1,2]`, `[2,0]`; bỏ qua vị trí trùng đoạn Typing hoặc Slide khác. Dùng để thử Slide với map không có Slide.
- Chart sinh từ `.osu` có `source: "osu"` và là **bản nháp** để chỉnh trong Editor.

**Fixture thật** `tests/fixtures/beyond-the-aexis/` (gói zip có sẵn, giải nén vào đó). Viết unit test Vitest khẳng định các giá trị sau:
| Mục | Giá trị đúng |
|---|---|
| Mode / số phím | 3 / `CircleSize 5` → `keys = 5` |
| HitObjects thô | 3037 = 1767 `type 1` + 13 `type 5` + 1257 `type 128` |
| Metadata | `TitleUnicode` "Beyond The Æxis"; Artist "SDMNE"; Creator "ERA Akiri"; Version "Soulless Wanderers"; BeatmapID 4219453 |
| Asset | `audio.ogg` (dài ≈274s), nền `TfnFrGd.jpg`, `PreviewTime 162662`, `AudioLeadIn 0`, hitsound `soft-hitnormal.wav` |
| Timing thô | 21 dòng (11 gốc + 10 kế thừa); sau gộp còn **7** điểm gốc: 240 BPM @0, 230 @134520, 240 @135563, 245 @150563, 240 @151542, ≈214.5 @158542, 240 @159662 |
| Tags | không còn ký tự U+200B (file gốc có 3 ký tự) |
| Hold | 1016 hold ngắn hơn 250ms; hold dài nhất 10000ms; tối đa 5 hold đồng thời |
| Mật độ | khoảng cách nhỏ nhất giữa hai nốt là 31ms |
| Sau preset "Vừa" | còn ≈ 2.058 nốt, không nốt nào bị bỏ vì thiếu lane trống (cho phép sai lệch ±3%) |
| Gói | có thư mục gốc bọc ngoài; `.osb` và `SB/` bị bỏ qua |
Ngoài ra: ≥ 1 test cho file Mode 0 có slider và inherited timing point (tự dựng nhỏ), test file lỗi (thiếu section, BOM, CRLF) không làm crash.

# 6. BEATMAP EDITOR
Chia thành các tab:
1. **Setup:** import `.osu/.osz/.zip` (hộp thoại làm gọn mật độ ở mục 5) hoặc upload `.mp3/.ogg/.wav` + ảnh nền + video nền. Chỉnh `videoOffset` có xem trước.
2. **Timing:** **waveform** trên timeline (`decodeAudioData`, downsample peaks, zoom/scroll mượt); **Tap BPM**; đặt Offset tại vị trí con trỏ; hiển thị các đoạn BPM từ timing point; metronome tick.
3. **Compose:** hiển thị **vòng tam giác + 9 ô Tap + 3 Slide Node** tương tác.
   - Tap/Hold/Break: click ô hoặc bấm đúng phím; kéo dài để đặt Hold; toggle Break.
   - **Slide:** chọn công cụ Slide, click lần lượt các Slide Node (node đầu → các node tiếp theo, tối đa 4), xem preview đường đi và vị trí sao theo thời gian; ô nhập `waitBeats`, `beatsPerSegment` kèm hiển thị `waitMs/segMs/glideMs` tính theo BPM tại vị trí đó; cảnh báo khi hai Slide chồng nhau.
   - Snap theo Beat Divisor; phát từ vị trí bất kỳ, tốc độ 0.25×–1×; Undo/Redo ≥ 50 bước; copy/paste; xóa vùng chọn; "Test Play" từ vị trí hiện tại.
   - Preview dùng **chung renderer** với game (note bay từ tâm đúng như lúc chơi); có công tắc hiện/ẩn tia dẫn.
4. **Typing:** chọn đoạn trên timeline, nhập chuỗi chữ, tự rải ký tự theo lưới nhịp, sửa từng ký tự; cảnh báo nếu chồng note khác.
5. **Hitsound:** gán sample và volume cho từng note hoặc vùng chọn; upload sample tùy chỉnh; nghe thử.
6. **Publish:** xem `stars` và `maxPP`, chạy `validateBeatmap`, chọn `public | unlisted | private`, xuất `.zip` (JSON + audio + ảnh + video + hitsound) hoặc JSON thuần; đăng Firebase khi đã đăng nhập. `unlisted` dùng để playtest qua link riêng.

# 7. GIAO DIỆN & HỆ THỐNG
- **Màn hình:** Title → Song Select (preview từ `previewTime`, chọn độ khó, top score cục bộ) → Gameplay → Result (rank, thống kê phán định, biểu đồ sớm/muộn, độ bám Slide, PP, Retry/Lưu điểm) → Map Browser → Settings → Leaderboard → Editor → Profile. Pause bằng Esc, đếm ngược 3 giây khi tiếp tục.
- **Auth:** Google, Email/Password, Guest (điểm Guest chỉ lưu cục bộ, có nút nâng cấp tài khoản).
- **Settings** (localStorage + đồng bộ Firestore nếu đăng nhập): Note Speed 1.0–10.0; Audio Offset −200…+200 ms (kèm hiệu chỉnh tap theo metronome); Keybind Customizer; Background Dim 0–100%; bật/tắt video nền; kích thước note; hiện/ẩn tia dẫn; **độ rộng bám Slide (0.5–2.0×)**; **`slidePathPreview`**; kích thước vòng con trỏ; âm lượng Music / Hitsound / Slide SFX; bật/tắt UR bar; FPS cap (60/120/144/Unlimited).
- **Map Browser:** lấy từ Firestore (`visibility = public`), phân trang; tìm theo tên/nghệ sĩ/mapper/tag; lọc theo stars, BPM, độ dài; sắp xếp mới nhất / nhiều lượt chơi / stars; nghe preview; **Tải về** (lưu IndexedDB); **Yêu thích**; **Báo cáo vi phạm** (nhạc có bản quyền, nội dung xấu). Link chia sẻ `/map/:id`. Trang Profile liệt kê map của mapper. Footer có link Discord.
- **Bảng xếp hạng:** Cục bộ (IndexedDB, dùng được cả khi Guest); Song Leaderboard theo chart (hạng, người chơi, Achievement %, PP, Score, Max Combo, Rank, ngày), mỗi người một điểm tốt nhất theo PP mỗi chart; Global Ranking theo tổng PP. **Firestore Security Rules:** chỉ chủ sở hữu ghi hồ sơ; điểm chỉ tạo/cập nhật của chính mình, không xóa của người khác; kiểm tra khoảng giá trị hợp lệ (Achievement ≤ 101.0001, combo ≤ số note…). Ghi chú giới hạn chống gian lận phía client; đề xuất Cloud Function tính lại PP và lưu input log (tùy chọn).
- **Phong cách:** nền tối, neon (ring đỏ, lục giác xanh lá, sao xanh dương, điểm nhấn vàng), ring phát sáng, hạt particle, chuyển cảnh mượt. ≥ 60 FPS với ≥ 300 note trên màn hình (object pooling, sprite cache, không cấp phát trong vòng lặp render).

# 8. HỆ THỐNG PP
Viết `calcStars(beatmap)` và `calcPP(stars, stats)` thuần (không phụ thuộc DOM), hằng số đặt trong `pp.config.js` để tinh chỉnh bằng playtest.

**Strain theo từng note** (sắp theo `time`; Hold và Slide tính tại đầu):
```
dt        = max(time_i - time_{i-1}, 25)                   // ms
speed_i   = (1000 / dt) ^ 1.3
variety_i = 1 + 0.15 * (số lane/node KHÁC NHAU trong 1500ms gần nhất - 1)
move_i    = 1 + 0.25 * (khoảng cách tâm đích_{i-1} → đích_i / khoảng cách lớn nhất trong layout)
typeMult  = tap 1.0 | hold 0.8 | break 1.0 | slide 1.2 | typing 0.9
strain_i  = speed_i * variety_i * move_i * typeMult
```
Cộng dồn có suy giảm: `S_i = S_{i-1} * 0.9^(dt / 400) + strain_i`. Chia bài thành đoạn 400ms, lấy đỉnh `S` mỗi đoạn, sắp giảm dần: `difficulty = Σ peak_k * 0.9^k`, `stars = starScale * sqrt(difficulty)`. `stars` không phụ thuộc Note Speed của người chơi.

**PP một lần chơi:**
```
accFactor    = clamp((Achievement - 70) / 30, 0, 1.0105) ^ 3
lengthFactor = 0.9 + 0.1 * min(1, noteCount / 500)
missPenalty  = 0.97 ^ missCount
PP           = ppScale * stars ^ 2.4 * accFactor * lengthFactor * missPenalty
```
**Tổng PP người chơi:** tối đa 100 điểm tốt nhất (mỗi chart một điểm), `totalPP = Σ PP_i * 0.95^i`. Unit test: cùng chart + cùng thống kê ra cùng kết quả; chart dày và nhiều lane hơn thì stars cao hơn; Achievement thấp hơn thì PP thấp hơn.

# 9. CÁCH LÀM VIỆC & ĐẦU RA
Làm theo giai đoạn; xong mỗi giai đoạn phải **dừng lại** để mình chạy thử và xác nhận rồi mới sang tiếp:
- **GĐ1 – Nền tảng:** cây thư mục, `package.json`, cấu hình Vite/Tailwind/Firebase (biến môi trường), `layout.config.js` + **unit test hình học (mục 2)**, JSON Schema + `validateBeatmap`, một chart mẫu. Giải nén file map mẫu vào `tests/fixtures/beyond-the-aexis/`.
- **GĐ2 – Parser `.osu/.osz`:** `importPackage`, chuyển đổi Mode 3 → `triRing9`, làm gọn mật độ, `autoSlide`, kèm **toàn bộ test fixture ở mục 5**. Có thể chạy độc lập để tạo chart từ map mẫu.
- **GĐ3 – Core Engine:** AudioEngine (sync, latency, offset), renderer vòng tam giác, chuyển động note từ tâm, Input Manager, Tap/Hold/Break, phán định + score + UR bar + hitsound. Chơi được chart sinh từ map mẫu.
- **GĐ4 – Slide:** sao bay vào, hiện đường đi khi sao tới node, chờ 1 nhịp, lướt theo BPM, `onTrack`/`ratio`/phán định, sample `slide-start`/`slide-end`.
- **GĐ5 – Typing + Video nền.**
- **GĐ6 – Editor:** các tab Setup, Timing, Compose, Typing, Hitsound, Publish.
- **GĐ7 – Online:** Auth, Map Browser, Leaderboard, PP, Firestore rules, Profile.
- **GĐ8 – Hoàn thiện:** tối ưu hiệu năng, hiệu chỉnh offset, kiểm thử, README chạy/deploy.

**Quy tắc xuất code:** mỗi file một khối code riêng, ghi đường dẫn phía trên; chạy được ngay bằng `npm install && npm run dev`, liệt kê biến môi trường cần có. Cuối mỗi giai đoạn nêu: (a) danh sách file, (b) cách kiểm thử thủ công, (c) giả định đã đặt, (d) việc còn tồn đọng. Nếu yêu cầu mơ hồ, chọn phương án hợp lý và nêu giả định, đừng hỏi lại quá nhiều.

# 10. TIÊU CHÍ NGHIỆM THU
- Bố cục khớp bản phác: vòng tam giác ngược, 9 ô elip (3 mỗi cạnh: `7 8 9` / `Y H N` / `O K M`), 3 lục giác ở 3 đỉnh; không có ô nào chồng lên nhau.
- **Không có vòng approach.** Note bay từ tâm tam giác, chỉ nhìn hướng bay đã biết ô đích; tâm note trùng tâm ô đúng lúc `time`, không trôi lệch sau 3 phút; đổi Offset có tác dụng ngay.
- Hold: head dừng ở ô, đuôi dải co về ô đúng lúc `endTime`.
- **Slide:** sao bay vào node đầu đúng lúc `time` → đường đi chỉ hiện sau khi sao tới → sao chờ đúng 1 nhịp (theo BPM tại thời điểm đó) → lướt với tốc độ tỉ lệ BPM → bám sát sao tới node cuối được CRITICAL PERFECT/PERFECT; bám lệch, nhả chuột, hoặc không tới node cuối thì thấp hơn hoặc MISS.
- Bấm `7 8 9 Y H N O K M` kích hoạt đúng ô; đổi keybind không ảnh hưởng dữ liệu chart.
- Import gói zip mẫu (có thư mục gốc bọc ngoài, có storyboard) ra đúng metadata, 7 timing point gốc, audio, nền, hitsound `soft-hitnormal.wav`; chart sinh ra chơi được, không có hai nốt trùng lane cùng thời điểm.
- Chart tạo ở Editor lưu → xuất → nhập lại → chơi được, kết quả giống hệt; preview trong Editor trùng với lúc chơi.
- Đăng map `unlisted` rồi mở bằng link `/map/:id` ở tài khoản khác thì tải và chơi được; map `public` hiện trong Map Browser.
- Điểm lưu đúng, PP tính nhất quán, hiện đúng trên Song Leaderboard, bảng cục bộ và Global Ranking.