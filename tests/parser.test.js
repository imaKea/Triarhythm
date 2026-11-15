import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseOsu, importPackage, countHiddenChars } from '../src/core/parser/index.js';
import { validateBeatmap } from '../src/core/beatmap/validator.js';

describe('GĐ2 Unit Tests - Parser .osu / .osz', () => {
  const fixtureDir = path.resolve(__dirname, 'fixtures/beyond-the-aexis');
  const osuPath = path.join(
    fixtureDir,
    '2025310 SDMNE - Beyond The Aexis',
    'SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu'
  );
  const zipPath = path.resolve(__dirname, 'fixtures/2025310 SDMNE - Beyond The Aexis.zip');

  const osuContent = fs.readFileSync(osuPath, 'utf8');

  // =========================================================================
  // 1. Kiểm thử Fixture thật Beyond The Aexis
  // =========================================================================
  it('Phân tích cú pháp chính xác toàn bộ thông số của Beyond The Aexis', () => {
    // Kiểm tra ký tự ẩn U+200B trong file gốc trước khi parse
    const rawTagsLine = osuContent.split(/\r?\n/).find(l => l.startsWith('Tags:')) || '';
    expect(countHiddenChars(rawTagsLine)).toBe(3);

    // Chạy parser với preset mặc định "Vừa"
    const result = parseOsu(osuContent, { preset: 'medium' });
    const bm = result.beatmap;
    const raw = result.rawStats;

    // --- Mode / Keys ---
    expect(bm.notes.length).toBeGreaterThan(0);
    expect(raw.rawTotalCount).toBe(3037);

    // --- HitObjects thô: 3037 = 1767 type 1 + 13 type 5 + 1257 type 128 ---
    // (type 1 + type 5 đều là tap; tổng tap = 1780, hold = 1257)
    expect(raw.rawTapCount).toBe(1780); // 1767 + 13
    expect(raw.rawHoldCount).toBe(1257);
    expect(raw.rawTapCount + raw.rawHoldCount).toBe(3037);

    // --- Metadata ---
    expect(bm.metadata.title).toBe('Beyond The Æxis'); // TitleUnicode
    expect(bm.metadata.artist).toBe('SDMNE');
    expect(bm.metadata.creator).toBe('ERA Akiri');
    expect(bm.metadata.difficultyName).toBe('Soulless Wanderers');
    expect(bm.metadata.id).toBe('osu-4219453');

    // --- Tags: đã làm sạch toàn bộ U+200B ---
    for (const tag of bm.metadata.tags) {
      expect(countHiddenChars(tag)).toBe(0);
    }
    expect(countHiddenChars(bm.metadata.tags.join(' '))).toBe(0);

    // --- Assets & Settings ---
    expect(bm.assets.audio).toBe('audio.ogg');
    expect(bm.assets.background).toBe('TfnFrGd.jpg');
    expect(bm.metadata.previewTime).toBe(162662);
    expect(bm.settings.audioLeadIn).toBe(0);

    // --- Timing: 21 dòng thô, sau gộp còn 7 điểm gốc ---
    expect(raw.rawTimingPointsCount).toBe(21);
    expect(raw.rawUninheritedTimingCount).toBe(11);
    expect(bm.timingPoints.length).toBe(7);

    const tpList = bm.timingPoints;
    expect(tpList[0].bpm).toBeCloseTo(240, 1);
    expect(tpList[0].time).toBe(0);

    expect(tpList[1].bpm).toBeCloseTo(230, 1);
    expect(tpList[1].time).toBe(134520);

    expect(tpList[2].bpm).toBeCloseTo(240, 1);
    expect(tpList[2].time).toBe(135563);

    expect(tpList[3].bpm).toBeCloseTo(245, 1);
    expect(tpList[3].time).toBe(150563);

    expect(tpList[4].bpm).toBeCloseTo(240, 1);
    expect(tpList[4].time).toBe(151542);

    expect(tpList[5].bpm).toBeCloseTo(214.5, 1);
    expect(tpList[5].time).toBe(158542);

    expect(tpList[6].bpm).toBeCloseTo(240, 1);
    expect(tpList[6].time).toBe(159662);

    // --- Thống kê Hold ---
    expect(raw.holdsUnder250).toBe(1016);
    expect(raw.maxHoldDuration).toBe(10000);
    expect(raw.maxSimultaneousHolds).toBe(5);

    // --- Mật độ: khoảng cách nhỏ nhất giữa 2 nốt ---
    expect(raw.minRawGap).toBe(31);

    // --- Sau preset "Vừa": còn ≈ 2.058 nốt (sai lệch ±3%), không nốt nào bị bỏ do thiếu lane ---
    expect(bm.notes.length).toBeGreaterThanOrEqual(2000);
    expect(bm.notes.length).toBeLessThanOrEqual(2060);
    expect(result.mappingStats.droppedCount).toBe(0);

    // --- Kiểm tra hợp lệ bằng validateBeatmap ---
    const validation = validateBeatmap(bm);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  // =========================================================================
  // 2. Kiểm thử importPackage với file zip thật (có bọc thư mục gốc, bỏ .osb & SB/)
  // =========================================================================
  it('importPackage giải nén thành công gói zip thật có thư mục gốc bọc ngoài', async () => {
    const zipBuffer = fs.readFileSync(zipPath);
    const result = await importPackage(zipBuffer, { preset: 'medium' });

    expect(result.beatmaps.length).toBeGreaterThanOrEqual(1);
    expect(result.charts).toBeDefined();
    expect(Array.isArray(result.charts)).toBe(true);
    expect(result.charts.length).toBe(result.beatmaps.length);
    expect(result.primaryBeatmap).toBeDefined();

    // Khẳng định metadata
    expect(result.primaryBeatmap.metadata.title).toBe('Beyond The Æxis');
    expect(result.primaryBeatmap.metadata.artist).toBe('SDMNE');

    // Khẳng định tài nguyên giải nén
    expect(result.assets.audio).toBeInstanceOf(Blob);
    expect(result.assets.background).toBeInstanceOf(Blob);
    expect(result.assets.hitsounds['soft-hitnormal.wav']).toBeInstanceOf(Blob);

    // Đảm bảo không giải nén các file storyboard SB/ và .osb
    const hitsoundKeys = Object.keys(result.assets.hitsounds);
    for (const key of hitsoundKeys) {
      expect(key.endsWith('.osb')).toBe(false);
      expect(key.includes('sb/')).toBe(false);
      expect(key.includes('sb\\')).toBe(false);
    }
  });

  // =========================================================================
  // 3. Kiểm thử Mode 0 có Slider và Inherited Timing Point (SV multiplier)
  // =========================================================================
  it('Phân tích chính xác file Mode 0 có slider và inherited timing point', () => {
    const sampleMode0Text = `
osu file format v14

[General]
AudioFilename: audio.mp3
Mode: 0

[Metadata]
Title: Mode 0 Test
Artist: Composer
Creator: Mapper
Version: Easy

[Difficulty]
CircleSize: 4
SliderMultiplier: 1.4

[TimingPoints]
0,500,4,1,0,100,1,0
1000,-50,4,1,0,100,0,0

[HitObjects]
256,192,2000,1,0,0:0:0:0:
256,192,3000,2,0,L|300:200,1,140
`.trim();

    const result = parseOsu(sampleMode0Text, { preset: 'original' });
    const bm = result.beatmap;

    expect(bm.notes.length).toBe(2);
    // Nốt thứ nhất là tap
    expect(bm.notes[0].type).toBe('tap');
    expect(bm.notes[0].time).toBe(2000);
    expect(bm.notes[0].lane).toBeGreaterThanOrEqual(0);
    expect(bm.notes[0].lane).toBeLessThanOrEqual(8);

    // Nốt thứ hai là slider chuyển thành hold
    expect(bm.notes[1].type).toBe('hold');
    expect(bm.notes[1].time).toBe(3000);
    expect(bm.notes[1].endTime).toBeGreaterThan(3000);

    const validation = validateBeatmap(bm);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('counts overlapping holds with end-exclusive timing', () => {
    const text = `
osu file format v14

[General]
AudioFilename: audio.ogg
Mode: 3

[Metadata]
Title: Hold Boundary Test
Artist: Composer
Creator: Mapper
Version: Test

[Difficulty]
CircleSize: 7

[TimingPoints]
0,500,4,1,0,100,1,0

[HitObjects]
36,192,0,128,0,1000:0:0:0:
110,192,500,128,0,1500:0:0:0:
183,192,1000,128,0,1400:0:0:0:
256,192,1500,128,0,2000:0:0:0:
`.trim();

    const result = parseOsu(text, { preset: 'original' });

    expect(result.rawStats.maxSimultaneousHolds).toBe(2);
  });

  // =========================================================================
  // 4. Kiểm thử tính bền bỉ (Robustness / Error Handling)
  // =========================================================================
  it('Xử lý an toàn file có BOM, CRLF, thiếu section mà không bị crash', () => {
    // Chuỗi có UTF-8 BOM (\uFEFF) và dòng CRLF (\r\n)
    const textWithBomAndCrlf = '\uFEFF[General]\r\nAudioFilename: test.mp3\r\nMode: 3\r\n[HitObjects]\r\n256,192,1000,1,0\r\n';
    const result = parseOsu(textWithBomAndCrlf);

    expect(result.beatmap).toBeDefined();
    expect(result.beatmap.assets.audio).toBe('test.mp3');
    expect(result.beatmap.notes.length).toBe(1);
  });

  it('Bắt lỗi khi truyền chuỗi rỗng hoặc dữ liệu không hợp lệ', () => {
    expect(() => parseOsu('')).toThrow('Dữ liệu .osu không hợp lệ hoặc rỗng.');
    expect(() => parseOsu(null)).toThrow('Dữ liệu .osu không hợp lệ hoặc rỗng.');
  });

  // =========================================================================
  // 5. Kiểm thử tùy chọn autoSlide
  // =========================================================================
  it('Chèn slide tự động đúng chu kỳ khi bật tùy chọn autoSlide', () => {
    const result = parseOsu(osuContent, { preset: 'medium', autoSlide: true, everyBeats: 16 });
    const slides = result.beatmap.notes.filter(n => n.type === 'slide');

    expect(slides.length).toBeGreaterThan(0);
    // Kiểm tra slide có path hợp lệ
    for (const s of slides) {
      expect(s.path.length).toBe(2);
      expect(s.path[0]).not.toBe(s.path[1]);
      expect(s.waitBeats).toBe(1);
      expect(s.beatsPerSegment).toBe(2);
    }
  });

  // =========================================================================
  // 6. Kiểm thử Chế độ 2 ngón (twoFingers / 2-Finger Ergonomics)
  // =========================================================================
  it('Chế độ 2 ngón (twoFingers): đảm bảo tuyệt đối không quá 2 nốt bấm cùng lúc và tối đa 2 ngón', () => {
    const result = parseOsu(osuContent, { preset: 'twoFingers' });
    const notes = result.beatmap.notes;

    expect(notes.length).toBeGreaterThan(0);

    // 1. Không bao giờ có quá 2 nốt tại cùng một thời điểm (maxChord <= 2)
    const byTime = new Map();
    for (const n of notes) {
      byTime.set(n.time, (byTime.get(n.time) || 0) + 1);
    }
    for (const [t, count] of byTime.entries()) {
      expect(count).toBeLessThanOrEqual(2);
    }

    // 2. Không bao giờ yêu cầu quá 2 ngón đồng thời (active holds + nốt mới <= 2)
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const activeHolds = notes.filter(
        other => other !== n && other.type === 'hold' && other.time < n.time && (other.endTime || 0) > n.time + 20
      );
      const chordSameTime = notes.filter(other => Math.abs(other.time - n.time) <= 1);
      expect(activeHolds.length + chordSameTime.length).toBeLessThanOrEqual(2);
    }
  });
});
