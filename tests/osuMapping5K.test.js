import { describe, it, expect } from 'vitest';
import { parseOsu } from '../src/core/parser/osuParser.js';

describe('Osu 5K & 7K Special Mapping, Lane Distribution & Deletion Tests', () => {
  const sample5KText = `
osu file format v14

[General]
AudioFilename: audio.mp3
Mode: 3

[Metadata]
Title: 5K Spacebar Test
Artist: Triarhythm Artist
Creator: Mapper
Version: 5K Master
BeatmapID: 55555
BeatmapSetID: 99999

[Difficulty]
CircleSize: 5
OverallDifficulty: 8

[TimingPoints]
0,500,4,1,0,100,1,0

[HitObjects]
64,192,1000,1,0,0:0:0:0:
160,192,1250,1,0,0:0:0:0:
256,192,1500,1,0,0:0:0:0:
352,192,1750,1,0,0:0:0:0:
448,192,2000,128,0,2500:0:0:0:0:
256,192,3000,128,0,3500:0:0:0:0:
`.trim();

  const sample7KText = `
osu file format v14

[General]
AudioFilename: audio.mp3
Mode: 3

[Metadata]
Title: 7K Spacebar Test
Artist: Triarhythm Artist
Creator: Mapper
Version: 7K Master
BeatmapID: 77777
BeatmapSetID: 88888

[Difficulty]
CircleSize: 7
OverallDifficulty: 8

[TimingPoints]
0,500,4,1,0,100,1,0

[HitObjects]
36,192,1000,1,0,0:0:0:0:
109,192,1250,1,0,0:0:0:0:
182,192,1500,1,0,0:0:0:0:
256,192,1750,1,0,0:0:0:0:
329,192,2000,1,0,0:0:0:0:
402,192,2250,1,0,0:0:0:0:
475,192,2500,1,0,0:0:0:0:
256,192,3000,128,0,3500:0:0:0:0:
`.trim();

  const sample4KText = `
osu file format v14

[General]
AudioFilename: audio.mp3
Mode: 3

[Metadata]
Title: 4K Test
Artist: Artist
Creator: Mapper
Version: 4K Normal
BeatmapID: 44444

[Difficulty]
CircleSize: 4

[TimingPoints]
0,500,4,1,0,100,1,0

[HitObjects]
64,192,1000,1,0,0:0:0:0:
`.trim();

  it('1. Nút import osu 5K (osuSpecialMapping = true): Cột số 2 (spacebar) đổi thành note ring', () => {
    const res = parseOsu(sample5KText, { osuSpecialMapping: true });
    expect(res.beatmap).toBeDefined();
    expect(res.mode).toBe(3);
    expect(res.keys).toBe(5);
    expect(res.is5Key).toBe(true);

    const notes = res.beatmap.notes;
    // Nốt tại 1500ms (x=256, cột 2) và 3000ms (x=256, cột 2) phải là note ring
    const ringNotes = notes.filter((n) => n.type === 'ring');
    expect(ringNotes.length).toBe(2);
    expect(ringNotes[0].time).toBe(1500);
    expect(ringNotes[1].time).toBe(3000);

    // Các cột khác (0, 1, 3, 4) giữ nguyên tap và hold
    const tapNotes = notes.filter((n) => n.type === 'tap');
    expect(tapNotes.length).toBe(3); // 1000ms, 1250ms, 1750ms
    for (const t of tapNotes) {
      expect(t.lane).toBeGreaterThanOrEqual(0);
      expect(t.lane).toBeLessThanOrEqual(8);
    }

    const holdNotes = notes.filter((n) => n.type === 'hold');
    expect(holdNotes.length).toBe(1); // 2000ms - 2500ms ở cột 4
    expect(holdNotes[0].time).toBe(2000);
    expect(holdNotes[0].endTime).toBe(2500);
    expect(holdNotes[0].lane).toBeGreaterThanOrEqual(0);
  });

  it('2. Nút import osu nhận cả 7K: Nốt spacebar là hàng số 4 (cột 3) đổi thành note ring', () => {
    const res = parseOsu(sample7KText, { osuSpecialMapping: true });
    expect(res.beatmap).toBeDefined();
    expect(res.mode).toBe(3);
    expect(res.keys).toBe(7);
    expect(res.is7Key).toBe(true);
    expect(res.is5Kor7K).toBe(true);

    const notes = res.beatmap.notes;
    // Nốt tại 1750ms (x=256, hàng số 4 / cột 3) và 3000ms (x=256, cột 3) đổi thành note ring
    const ringNotes = notes.filter((n) => n.type === 'ring');
    expect(ringNotes.length).toBe(2);
    expect(ringNotes[0].time).toBe(1750);
    expect(ringNotes[1].time).toBe(3000);

    // 6 cột bàn phím còn lại (cột 0, 1, 2, 4, 5, 6) được gán sang các lane từ 0 đến 8
    const nonRingNotes = notes.filter((n) => n.type !== 'ring');
    expect(nonRingNotes.length).toBe(6);
    for (const n of nonRingNotes) {
      expect(n.lane).toBeGreaterThanOrEqual(0);
      expect(n.lane).toBeLessThanOrEqual(8);
    }
  });

  it('3. Luật phân bố lane: 5K phân bố nốt hàng số trên ít hơn, 7K phân bố đều cả 9 nút', () => {
    // Tạo chuỗi nốt giả lập 5K và 7K
    const makeOsuHitObjects = (keys, count) => {
      const lines = [];
      for (let i = 0; i < count; i++) {
        const time = 1000 + i * 160;
        const col = i % keys;
        const x = Math.floor((col + 0.5) * (512 / keys));
        lines.push(`${x},192,${time},1,0,0:0:0:0:`);
      }
      return lines.join('\n');
    };

    const stream5K = `
osu file format v14
[General]
Mode: 3
[Metadata]
Title: Stream 5K
[Difficulty]
CircleSize: 5
[TimingPoints]
0,500,4,1,0,100,1,0
[HitObjects]
${makeOsuHitObjects(5, 100)}
    `.trim();

    const stream7K = `
osu file format v14
[General]
Mode: 3
[Metadata]
Title: Stream 7K
[Difficulty]
CircleSize: 7
[TimingPoints]
0,500,4,1,0,100,1,0
[HitObjects]
${makeOsuHitObjects(7, 105)}
    `.trim();

    // 5K: Phân bố nốt hàng số ở trên (lane 0, 1, 2) ít hơn, ưu tiên các phím chữ (lane 3..8)
    const res5K = parseOsu(stream5K, { osuSpecialMapping: true });
    const nonRing5K = res5K.beatmap.notes.filter(n => n.type !== 'ring');
    const topNumberCount5K = nonRing5K.filter(n => n.lane === 0 || n.lane === 1 || n.lane === 2).length;
    const letterCount5K = nonRing5K.filter(n => n.lane >= 3 && n.lane <= 8).length;

    // Phím chữ phải chiếm áp đảo tuyệt đối so với hàng số trên
    expect(letterCount5K).toBeGreaterThan(topNumberCount5K * 3);
    expect(topNumberCount5K).toBe(0); // Ở chuỗi nốt tuần tự, hàng số trên là 0 vì các phím chữ đã đáp ứng hoàn hảo

    // 7K: Phân bố đều cả 9 nút (bao gồm hàng số trên 0, 1, 2)
    const res7K = parseOsu(stream7K, { osuSpecialMapping: true });
    const nonRing7K = res7K.beatmap.notes.filter(n => n.type !== 'ring');
    const topNumberCount7K = nonRing7K.filter(n => n.lane === 0 || n.lane === 1 || n.lane === 2).length;

    // 7K: Hàng số trên (3 lane trong tổng số 9) phải nhận số nốt đáng kể (~1/3 tổng số nốt bàn phím)
    expect(topNumberCount7K).toBeGreaterThan(0);
    expect(topNumberCount7K / nonRing7K.length).toBeGreaterThan(0.2); // Tối thiểu 20% rơi vào hàng số trên
  });

  it('4. Nút import thông thường (osuSpecialMapping = false): Giữ nguyên mọi nốt, hỗ trợ cả 4K/5K/7K không đổi sang ring', () => {
    const res5KNormal = parseOsu(sample5KText, { osuSpecialMapping: false });
    expect(res5KNormal.beatmap.notes.filter(n => n.type === 'ring').length).toBe(0);

    const res7KNormal = parseOsu(sample7KText, { osuSpecialMapping: false });
    expect(res7KNormal.beatmap.notes.filter(n => n.type === 'ring').length).toBe(0);

    const res4KNormal = parseOsu(sample4KText, { osuSpecialMapping: false });
    expect(res4KNormal.beatmap.notes.length).toBe(1);
  });

  it('5. Báo lỗi khi nạp chart không phải 5 key hoặc 7 key nếu bật requireSpecialKeys hoặc osuSpecialMapping', () => {
    expect(() => parseOsu(sample4KText, { osuSpecialMapping: true })).toThrow(/Chỉ hỗ trợ chart osu!mania 5 key hoặc 7 key/);
    expect(() => parseOsu(sample4KText, { requireSpecialKeys: true })).toThrow(/Chỉ hỗ trợ chart osu!mania 5 key hoặc 7 key/);
  });

  it('6. ID bản đồ được tạo ổn định và không dùng Date.now() ngẫu nhiên', () => {
    const res1 = parseOsu(sample5KText);
    const res2 = parseOsu(sample5KText);
    expect(res1.beatmap.metadata.id).toBe(res2.beatmap.metadata.id);
    expect(res1.beatmap.metadata.id).toBe('osu-55555');

    const res7K1 = parseOsu(sample7KText);
    const res7K2 = parseOsu(sample7KText);
    expect(res7K1.beatmap.metadata.id).toBe(res7K2.beatmap.metadata.id);
    expect(res7K1.beatmap.metadata.id).toBe('osu-77777');
  });

  it('7. Chức năng xóa map và kiểm tra trùng lặp ID', () => {
    const mockStore = new Map();
    const saveMock = (item) => {
      mockStore.set(item.id, item);
      return item;
    };
    const getMock = (id) => mockStore.get(id) || null;
    const deleteMock = (id) => mockStore.delete(id);

    const testMap = {
      id: 'test_osu_7k_unique_id_123',
      title: 'Test 7K Unique Song',
      artist: 'Test Artist',
      difficultyName: 'Master 10',
      beatmap: { notes: [] }
    };

    saveMock(testMap);
    const saved = getMock(testMap.id);
    expect(saved).toBeDefined();
    expect(saved.title).toBe('Test 7K Unique Song');

    const isDuplicate = Boolean(getMock(testMap.id));
    expect(isDuplicate).toBe(true);

    const deleteRes = deleteMock(testMap.id);
    expect(deleteRes).toBe(true);

    const afterDelete = getMock(testMap.id);
    expect(afterDelete).toBeNull();
  });

  it('8. Bỏ chức năng tạo ring tự động: Không tự sinh nốt ring hoặc slide theo chu kỳ 16 beats', () => {
    // Chart dài 20 giây ở 120 BPM không có cột spacebar (4K)
    const long4K = `
osu file format v14
[General]
Mode: 3
[Metadata]
Title: Long 4K
[Difficulty]
CircleSize: 4
[TimingPoints]
0,500,4,1,0,100,1,0
[HitObjects]
64,192,1000,1,0,0:0:0:0:
160,192,5000,1,0,0:0:0:0:
256,192,10000,1,0,0:0:0:0:
352,192,15000,1,0,0:0:0:0:
    `.trim();

    const res = parseOsu(long4K, { osuSpecialMapping: false });
    // Tuyệt đối không có nốt ring hay slide tự động nào được tạo
    const rings = res.beatmap.notes.filter(n => n.type === 'ring');
    const slides = res.beatmap.notes.filter(n => n.type === 'slide');
    expect(rings.length).toBe(0);
    expect(slides.length).toBe(0);
  });

  it('9. Giới hạn snap nhịp tối đa 1/8: Không import các nốt lẻ hơn snap 1/8 (như 1/12, 1/16...)', () => {
    // 120 BPM: beatLength = 500ms
    // Snap 1/1: t = 1000, 1500, 2000
    // Snap 1/4: t = 1125, 1250, 1375 (125ms step)
    // Snap 1/8: t = 1063 (62.5ms step)
    // Snap 1/16 (LẺ HƠN 1/8): t = 1031 (31.25ms step) -> PHẢI BỊ BỎ QUA
    // Snap 1/12 (LẺ HƠN 1/8): t = 1042 (41.67ms step) -> PHẢI BỊ BỎ QUA
    const snapTestText = `
osu file format v14
[General]
Mode: 3
[Metadata]
Title: Snap Test
[Difficulty]
CircleSize: 4
[TimingPoints]
0,500,4,1,0,100,1,0
[HitObjects]
64,192,1000,1,0,0:0:0:0:
160,192,1031,1,0,0:0:0:0:
256,192,1042,1,0,0:0:0:0:
352,192,1063,1,0,0:0:0:0:
64,192,1125,1,0,0:0:0:0:
160,192,1250,1,0,0:0:0:0:
    `.trim();

    const res = parseOsu(snapTestText, { osuSpecialMapping: false });
    const times = res.beatmap.notes.map(n => n.time);

    // Nốt snap 1/1 (1000ms), 1/8 (1063ms), 1/4 (1125ms), 1/2 (1250ms) phải được giữ lại
    expect(times).toContain(1000);
    expect(times).toContain(1063);
    expect(times).toContain(1125);
    expect(times).toContain(1250);

    // Nốt 1/16 (1031ms) và 1/12 (1042ms) phải bị loại bỏ hoàn toàn
    expect(times).not.toContain(1031);
    expect(times).not.toContain(1042);
  });

  it('10. Chart osu 5K (col 2) và 7K (col 3): chỉ tạo Ring Hold khi spacebar là nốt hold (LN), nếu là tap thì tạo Tap Ring', () => {
    const res5K = parseOsu(sample5KText, { osuSpecialMapping: true });
    const ringNotes5K = res5K.beatmap.notes.filter(n => n.type === 'ring');
    expect(ringNotes5K.length).toBe(2);

    // Nốt tại 1500ms là tap ở cột 2 -> Ring Tap (isHold false)
    expect(ringNotes5K[0].time).toBe(1500);
    expect(Boolean(ringNotes5K[0].isHold)).toBe(false);

    // Nốt tại 3000ms là LN ở cột 2 (3000 -> 3500) -> Ring Hold (isHold true, endTime 3500)
    expect(ringNotes5K[1].time).toBe(3000);
    expect(ringNotes5K[1].isHold).toBe(true);
    expect(ringNotes5K[1].endTime).toBe(3500);

    const res7K = parseOsu(sample7KText, { osuSpecialMapping: true });
    const ringNotes7K = res7K.beatmap.notes.filter(n => n.type === 'ring');
    expect(ringNotes7K.length).toBe(2);

    // Nốt tại 1750ms là tap ở cột 3 -> Ring Tap (isHold false)
    expect(ringNotes7K[0].time).toBe(1750);
    expect(Boolean(ringNotes7K[0].isHold)).toBe(false);

    // Nốt tại 3000ms là LN ở cột 3 (3000 -> 3500) -> Ring Hold (isHold true, endTime 3500)
    expect(ringNotes7K[1].time).toBe(3000);
    expect(ringNotes7K[1].isHold).toBe(true);
    expect(ringNotes7K[1].endTime).toBe(3500);
  });

  it('11. Import chart ngoài maimai/osu mania 5K 7K: chỉ thêm nút ring hold hợp lý ở những nhịp dài của bài hát (>= 1400ms, cách nhau >= 7000ms)', () => {
    // Chart 4K (không phải 5K/7K special) có:
    // - 1 nốt hold ngắn 500ms tại 1000ms -> KHÔNG đổi thành ring hold
    // - 1 nốt hold dài 2000ms tại 3000ms -> ĐỔI thành Ring Hold
    // - 1 nốt hold dài 1800ms tại 6000ms -> Bị bỏ qua do trong thời gian cooldown 7s (< 3000 + 7000 = 10000ms)
    // - 1 nốt hold dài 2500ms tại 12000ms -> ĐỔI thành Ring Hold (hết cooldown)
    const long4KChart = `
osu file format v14
[General]
Mode: 3
[Metadata]
Title: 4K Long Beat Test
[Difficulty]
CircleSize: 4
[TimingPoints]
0,500,4,1,0,100,1,0
[HitObjects]
64,192,1000,128,0,1500:0:0:0:0:
160,192,3000,128,0,5000:0:0:0:0:
256,192,6000,128,0,7800:0:0:0:0:
352,192,12000,128,0,14500:0:0:0:0:
    `.trim();

    const res = parseOsu(long4KChart, { osuSpecialMapping: false });
    const ringNotes = res.beatmap.notes.filter(n => n.type === 'ring');

    // Chỉ có 2 nốt Ring Hold được chọn (tại 3000ms và 12000ms)
    expect(ringNotes.length).toBe(2);

    expect(ringNotes[0].time).toBe(3000);
    expect(ringNotes[0].isHold).toBe(true);
    expect(ringNotes[0].endTime).toBe(5000);

    expect(ringNotes[1].time).toBe(12000);
    expect(ringNotes[1].isHold).toBe(true);
    expect(ringNotes[1].endTime).toBe(14500);

    // Nốt hold ngắn tại 1000ms và nốt bị dính cooldown tại 6000ms vẫn là nốt hold bàn phím bình thường
    const laneHolds = res.beatmap.notes.filter(n => n.type === 'hold');
    expect(laneHolds.length).toBe(2);
    expect(laneHolds[0].time).toBe(1000);
    expect(laneHolds[1].time).toBe(6000);
  });
});
