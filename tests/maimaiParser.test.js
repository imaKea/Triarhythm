import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseMaimai, parseSimaiDuration, MAIMAI_TO_LANE } from '../src/core/parser/maimaiParser.js';
import { importPackage } from '../src/core/parser/packageImporter.js';

describe('Maimai / Simai Chart Parser (maimaiParser.js)', () => {
  const sampleMaidata = `
&title=Test Track
&artist=Test Artist
&first=0.5
&des_2=Mapper Adv
&des_4=Mapper Master
&lv_2=5
&lv_4=12+
&inote_2=(120){4}1,2,3,4,
{4}1-4[4:1],C1,B2,1b,
{2}7h[4:1],E
&inote_4=(200){4}1/8,2/7,C1h[4:1],1-4[4:1]/8-5[4:1],E
`;

  it('1. Phân tích chính xác metadata và danh sách các độ khó', () => {
    const result = parseMaimai(sampleMaidata);
    expect(result.metadata.title).toBe('Test Track');
    expect(result.metadata.artist).toBe('Test Artist');
    expect(result.metadata.offsetMs).toBe(500);
    expect(result.difficulties.length).toBe(2);

    const adv = result.difficulties.find((d) => d.difficultyName === 'Advanced');
    expect(adv).toBeDefined();
    expect(adv.difficultyLevel).toBe('5');
    expect(adv.beatmap.settings.noteSpeed).toBe(10.0);

    const master = result.difficulties.find((d) => d.difficultyName === 'Master');
    expect(master).toBeDefined();
    expect(master.difficultyLevel).toBe('12+');
  });

  it('2. Convert slide sang Ring, touch tâm sang Ring, và nốt outer touch (B, A, D, E) sang Ring', () => {
    const result = parseMaimai(sampleMaidata);
    const adv = result.difficulties.find((d) => d.difficultyName === 'Advanced');
    const notes = adv.beatmap.notes;

    // Slide 1-4[4:1] convert sang nốt Ring (Spacebar) đồng thời giữ nốt gốc Button 1 (Lane 2)
    const slideRing = notes.find((n) => n.time === 500 + 4 * 500 && n.type === 'ring');
    expect(slideRing).toBeDefined();
    expect(slideRing.lane).toBeUndefined();

    const slideButton = notes.find((n) => n.time === 500 + 4 * 500 && n.lane === MAIMAI_TO_LANE[1]);
    expect(slideButton).toBeDefined();
    expect(slideButton.type).toBe('tap');

    // C1 là Center Touch -> convert sang nốt Ring (Spacebar)
    const centerRingNote = notes.find((n) => n.time === 500 + 5 * 500 && n.type === 'ring');
    expect(centerRingNote).toBeDefined();
    expect(centerRingNote.lane).toBeUndefined();

    // B2 là Outer Touch (vành trong quanh tâm) -> convert sang nốt Ring (Spacebar), không tạo nốt trên Lane 6
    const b2Note = notes.find((n) => n.time === 500 + 6 * 500 && n.type === 'ring');
    expect(b2Note).toBeDefined();
    expect(b2Note.lane).toBeUndefined();
    expect(Boolean(b2Note.isHold)).toBe(false);
  });

  it('3. Ánh xạ chuẩn xác 8 phím vật lý maimai sang 9 ô phím Triarhythm', () => {
    expect(MAIMAI_TO_LANE[1]).toBe(2); // Top-Right -> Lane 2 (8·9)
    expect(MAIMAI_TO_LANE[8]).toBe(0); // Top-Left  -> Lane 0 (4·5)
    expect(MAIMAI_TO_LANE[7]).toBe(3); // Left      -> Lane 3 (R)
    expect(MAIMAI_TO_LANE[6]).toBe(4); // Left      -> Lane 4 (F)
    expect(MAIMAI_TO_LANE[5]).toBe(5); // Left      -> Lane 5 (V)
    expect(MAIMAI_TO_LANE[2]).toBe(6); // Right     -> Lane 6 (I)
    expect(MAIMAI_TO_LANE[3]).toBe(7); // Right     -> Lane 7 (J)
    expect(MAIMAI_TO_LANE[4]).toBe(8); // Right     -> Lane 8 (N)
  });

  it('4. Phân tích chính xác nốt Break và nốt Hold với duration', () => {
    const result = parseMaimai(sampleMaidata);
    const adv = result.difficulties.find((d) => d.difficultyName === 'Advanced');
    const notes = adv.beatmap.notes;

    const breakNote = notes.find((n) => n.type === 'break');
    expect(breakNote).toBeDefined();
    expect(breakNote.lane).toBe(MAIMAI_TO_LANE[1]); // Phím 1b -> Lane 2

    const holdNote = notes.find((n) => n.type === 'hold');
    expect(holdNote).toBeDefined();
    expect(holdNote.lane).toBe(MAIMAI_TO_LANE[7]); // Phím 7h -> Lane 3
    expect(holdNote.endTime).toBeGreaterThan(holdNote.time);
  });

  it('5. Tính toán chuẩn xác thời lượng Hold [divisor:count]', () => {
    // BPM = 120 -> 1 beat = 500ms
    // [4:1] = 1 phách = 500ms
    expect(parseSimaiDuration('4:1', 120)).toBe(500);
    // [1:1] = 4 phách = 2000ms
    expect(parseSimaiDuration('1:1', 120)).toBe(2000);
    // [8:1] = 0.5 phách = 250ms
    expect(parseSimaiDuration('8:1', 120)).toBe(250);
  });

  it('6. Nhập và giải nén thành công gói Aegleseeker.zip thật', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/Aegleseeker.zip');
    if (!fs.existsSync(fixturePath)) {
      console.warn('Bỏ qua test Aegleseeker.zip do không tìm thấy fixture.');
      return;
    }

    const buf = fs.readFileSync(fixturePath);
    const pkg = await importPackage(buf);

    expect(pkg.charts).toBeDefined();
    expect(pkg.charts.length).toBe(4); // Có 4 độ khó: Advanced, Expert, Master, Re:Master

    const names = pkg.charts.map((c) => c.difficultyName);
    expect(names).toContain('Advanced');
    expect(names).toContain('Expert');
    expect(names).toContain('Master');
    expect(names).toContain('Re:Master');

    // Kiểm tra asset trích xuất
    expect(pkg.assets.audio).toBeDefined();
    expect(pkg.assets.background).toBeDefined();

    // Blob giải nén phải có MIME type để Laravel `mimes` validation chấp nhận upload
    expect(pkg.assets.audio.type).toMatch(/^audio\//);
    expect(pkg.assets.background.type).toMatch(/^image\//);

    // Kiểm tra độ khó Re:Master
    const remaster = pkg.charts.find((c) => c.difficultyName === 'Re:Master');
    expect(remaster.difficultyLevel).toBe('14');
    expect(remaster.beatmap.notes.length).toBeGreaterThan(500);

    // Kiểm tra có nốt Ring trong Re:Master (Slide + Touch Center)
    const ringNotes = remaster.beatmap.notes.filter((n) => n.type === 'ring');
    expect(ringNotes.length).toBeGreaterThan(50);
  });

  it('7. Convert Touch cầu vồng (Touch Hold: C1h, Ch...) thành Ring Hold, Slide thường thành Ring Tap, Outer Touch thành Ring', () => {
    const maidataWithTouchHold = `
&title=Touch Hold Test
&artist=Artist
&first=0
&lv_4=12
&inote_4=(120){4}1-4[4:1],C1,Ch[4:1],B2,E3h[4:1]
`;
    const res = parseMaimai(maidataWithTouchHold);
    const notes = res.difficulties[0].beatmap.notes;

    // Slide 1-4[4:1]: convert sang Ring Tap, KHÔNG phải Hold
    const slideRing = notes.find((n) => n.time === 0 && n.type === 'ring');
    expect(slideRing).toBeDefined();
    expect(Boolean(slideRing.isHold)).toBe(false);

    // Touch Tap C1: convert sang Ring Tap, KHÔNG phải Hold
    const touchTapRing = notes.find((n) => n.time === 500 && n.type === 'ring');
    expect(touchTapRing).toBeDefined();
    expect(Boolean(touchTapRing.isHold)).toBe(false);

    // Touch Hold Ch[4:1] (nốt giữ cầu vồng): convert sang Ring Hold có isHold: true và endTime
    const touchHoldRing = notes.find((n) => n.time === 1000 && n.type === 'ring');
    expect(touchHoldRing).toBeDefined();
    expect(touchHoldRing.isHold).toBe(true);
    expect(touchHoldRing.endTime).toBeGreaterThan(touchHoldRing.time);

    // Outer Touch B2: convert sang Ring Tap (Spacebar), không tạo nốt trên Lane 6
    const b2Note = notes.find((n) => n.time === 1500 && n.type === 'ring');
    expect(b2Note).toBeDefined();
    expect(b2Note.lane).toBeUndefined();
    expect(Boolean(b2Note.isHold)).toBe(false);

    // Outer Touch Hold E3h[4:1]: convert sang Ring Hold
    const e3hNote = notes.find((n) => n.time === 2000 && n.type === 'ring');
    expect(e3hNote).toBeDefined();
    expect(e3hNote.isHold).toBe(true);
    expect(e3hNote.endTime).toBe(2500);
  });

  it('8. Giữ hoàn toàn 100% snap của maimai, tất cả nốt được giữ nguyên không chuyển đổi thành drag note', () => {
    const maidataHighSnap = `
&title=High Snap Test
&artist=Artist
&first=0
&lv_4=13
&inote_4=(120){4}1,2,{8}3,4,5,6,{16}7,8,1,2,E
`;
    const res = parseMaimai(maidataHighSnap);
    const notes = res.difficulties[0].beatmap.notes;

    // Giữ nguyên toàn bộ 10 nốt (2 nốt {4} + 4 nốt {8} + 4 nốt {16})
    expect(notes.length).toBe(10);
    notes.forEach((n) => {
      expect(n.type).toBe('tap');
      expect(n.lane).toBeDefined();
    });
  });

  it('9. Bỏ qua mọi luật hạn chế số phím (maxChord), giữ nguyên hợp âm 3-4 nút và tuyệt đối không dùng Lane 1 (phím 6·7)', () => {
    const maidataChords = `
&title=Chord Test
&artist=Artist
&first=0
&lv_4=14
&inote_4=(120){1}1/2/7/8,{1}1234,{1}5678,E
`;
    const res = parseMaimai(maidataChords);
    const notes = res.difficulties[0].beatmap.notes;

    // Thời điểm 0: 4 nốt đồng thời (1, 2, 7, 8)
    const chord1 = notes.filter((n) => n.time === 0);
    expect(chord1.length).toBe(4);
    const lanes1 = chord1.map((n) => n.lane);
    expect(lanes1).toContain(MAIMAI_TO_LANE[1]);
    expect(lanes1).toContain(MAIMAI_TO_LANE[2]);
    expect(lanes1).toContain(MAIMAI_TO_LANE[7]);
    expect(lanes1).toContain(MAIMAI_TO_LANE[8]);

    // Thời điểm 2000 (1 phách = 2000ms): 4 nốt viết liền 1234
    const chord2 = notes.filter((n) => n.time === 2000);
    expect(chord2.length).toBe(4);

    // Kiểm tra tất cả nốt không bao giờ xuất hiện ở Lane 1 (phím 6·7)
    notes.forEach((n) => {
      if (n.lane !== undefined) {
        expect(n.lane).not.toBe(1);
      }
    });
  });

  it('10. Trích xuất đầy đủ video (pv.mp4 / bga.mp4) và background khi có trong zip', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('maidata.txt', '&title=Video Track\n&artist=Artist\n&inote_1=(120){4}1,2,3,4,E');
    zip.file('track.mp3', new Uint8Array([1, 2, 3]));
    zip.file('bg.jpg', new Uint8Array([4, 5, 6]));
    zip.file('pv.mp4', new Uint8Array([7, 8, 9]));
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    const pkg = await importPackage(buf);
    expect(pkg.assets.background).toBeDefined();
    expect(pkg.assets.video).toBeDefined();
    expect(pkg.charts[0].videoBlob).toBeDefined();
    expect(pkg.charts[0].backgroundBlob).toBeDefined();
  });

  it('11. Xử lý chính xác nốt zero-length hold h[1:0] (như map 系ぎて) thành nốt Tap, không tạo hold dài gây đè nốt trong đoạn spin', () => {
    // Trong Simai, h[1:0] có multiplier = 0 -> thời lượng = 0.
    // Parser phải nhận diện duration = 0 và coi như nốt Tap, không sinh ra nốt hold 1 measure (2.7s)
    expect(parseSimaiDuration('1:0', 88.8)).toBe(0);
    expect(parseSimaiDuration('0.6757##4.2255', 88.8)).toBe(4225.5);

    const spinMaidata = `
&title=Spin Test
&artist=Artist
&first=0
&lv_4=15
&inote_4=(88.8){4}4h[1:0],6,5,4,8h[1:0],2,1,8,E
`;
    const res = parseMaimai(spinMaidata);
    const notes = res.difficulties[0].beatmap.notes;

    // 4h[1:0] và 8h[1:0] phải là nốt Tap, KHÔNG phải nốt Hold
    const note4 = notes.find((n) => n.lane === MAIMAI_TO_LANE[4] && n.time === 0);
    expect(note4).toBeDefined();
    expect(note4.type).toBe('tap');
    expect(note4.endTime).toBeUndefined();

    const note8 = notes.find((n) => n.lane === MAIMAI_TO_LANE[8] && Math.abs(n.time - 4 * (60000 / 88.8)) <= 2);
    expect(note8).toBeDefined();
    expect(note8.type).toBe('tap');
    expect(note8.endTime).toBeUndefined();
  });

  it('12. Đảm bảo triệt để không có nốt nào trên cùng 1 lane bị chồng chéo lên nốt Hold', () => {
    // Nếu có nốt Hold dài mà nốt tiếp theo xuất hiện trước khi Hold kết thúc -> phải cắt ngắn Hold
    const overlapMaidata = `
&title=Overlap Test
&artist=Artist
&first=0
&lv_4=12
&inote_4=(120){1}1h[1:2],{4}1,1,1,1,E
`;
    const res = parseMaimai(overlapMaidata);
    const notes = res.difficulties[0].beatmap.notes;
    const lane2Notes = notes.filter((n) => n.lane === MAIMAI_TO_LANE[1]);

    const hold = lane2Notes.find((n) => n.type === 'hold');
    const nextTap = lane2Notes.find((n) => n.time > 0);

    expect(hold).toBeDefined();
    expect(nextTap).toBeDefined();
    // endTime của nốt hold trước đó phải <= thời gian bắt đầu của nốt kế tiếp
    expect(hold.endTime).toBeLessThanOrEqual(nextTap.time);
  });

  it('13. Chuyển đổi toàn bộ Touch notes (A, B, C, D, E) thành nốt Ring (phím Space) và khử trùng lặp khi nhiều touch cùng thời điểm (B1/B8)', () => {
    const multiTouchMaidata = `
&title=Multi Touch Test
&artist=Artist
&first=0
&lv_4=14
&inote_4=(120){4}B1/B8,,B2/B7,{16}C1h[4:1]/B3/B6,,E2,E3,E
`;
    const res = parseMaimai(multiTouchMaidata);
    const notes = res.difficulties[0].beatmap.notes;

    // Tuyệt đối không sinh ra bất kỳ nốt nào trên các lane 0..8
    const laneNotes = notes.filter((n) => n.lane !== undefined);
    expect(laneNotes.length).toBe(0);

    // Thời điểm 0: B1/B8 chỉ sinh ra đúng 1 nốt Ring duy nhất (khử trùng lặp)
    const ringAt0 = notes.filter((n) => n.time === 0 && n.type === 'ring');
    expect(ringAt0.length).toBe(1);
    expect(Boolean(ringAt0[0].isHold)).toBe(false);

    // Thời điểm 1000: B2/B7 chỉ sinh ra đúng 1 nốt Ring duy nhất
    const ringAt1000 = notes.filter((n) => n.time === 1000 && n.type === 'ring');
    expect(ringAt1000.length).toBe(1);
    expect(Boolean(ringAt1000[0].isHold)).toBe(false);

    // Thời điểm 1500: C1h[4:1]/B3/B6 -> C1h là hold, được clamp bởi nốt Ring kế tiếp (E2 tại 1750) thành 1750 - 30 = 1720
    const ringAt1500 = notes.filter((n) => n.time === 1500 && n.type === 'ring');
    expect(ringAt1500.length).toBe(1);
    expect(ringAt1500[0].isHold).toBe(true);
    expect(ringAt1500[0].endTime).toBe(1720);

    // E2, E3 cũng là Touch notes -> convert thành Ring notes
    const ringE2 = notes.find((n) => n.time === 1750 && n.type === 'ring');
    expect(ringE2).toBeDefined();
    const ringE3 = notes.find((n) => n.time === 1875 && n.type === 'ring');
    expect(ringE3).toBeDefined();
  });

  it('14. Khi convert slider maimai, ở cuối slider tự động thêm 1 nốt ring đơn (trừ note ring hold)', () => {
    // BPM = 120 (1 beat = 500ms).
    // Tại time = 0: Slide 1-5[2:1] (duration [2:1] = 2 beat = 1000ms).
    // Điểm kết thúc của slider là time = 1000ms.
    // Tại time = 2000: Đồng thời 2 slider 1-4[4:1]/8-5[4:1] (duration [4:1] = 1 beat = 500ms).
    // Điểm kết thúc của cả 2 slider là time = 2500ms.
    const sliderMaidata = `
&title=Slider End Ring Test
&artist=Triarhythm
&first=0
&lv_4=12
&inote_4=(120){2}1-5[2:1],,{2}1-4[4:1]/8-5[4:1],,E
`;
    const res = parseMaimai(sliderMaidata);
    const notes = res.difficulties[0].beatmap.notes;

    // 1. Slider 1-5[2:1] tại time = 0:
    // - Có nốt Ring tại time = 0 (bắt đầu slider)
    const ringAtStart = notes.find((n) => n.time === 0 && n.type === 'ring');
    expect(ringAtStart).toBeDefined();

    // - Cuối slider (time = 1000ms): PHẢI có 1 nốt Ring đơn (không phải Ring Hold)
    const ringAtSliderEnd = notes.find((n) => n.time === 1000 && n.type === 'ring');
    expect(ringAtSliderEnd).toBeDefined();
    expect(Boolean(ringAtSliderEnd.isHold)).toBe(false);
    expect(ringAtSliderEnd.endTime).toBeUndefined();

    // 2. Hai slider đồng thời 1-4[4:1]/8-5[4:1] tại time = 2000ms:
    // - Có nốt Ring tại time = 2000ms
    const ringAtDoubleStart = notes.filter((n) => n.time === 2000 && n.type === 'ring');
    expect(ringAtDoubleStart.length).toBe(1);

    // - Cuối slider (time = 2500ms): chỉ có ĐÚNG 1 nốt Ring đơn duy nhất (khử trùng lặp)
    const ringsAtDoubleEnd = notes.filter((n) => n.time === 2500 && n.type === 'ring');
    expect(ringsAtDoubleEnd.length).toBe(1);
    expect(Boolean(ringsAtDoubleEnd[0].isHold)).toBe(false);
    expect(ringsAtDoubleEnd[0].endTime).toBeUndefined();
  });
});
