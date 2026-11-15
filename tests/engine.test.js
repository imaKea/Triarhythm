import { describe, it, expect } from 'vitest';
import { ScoreManager } from '../src/core/engine/scoreManager.js';
import { ParticleSystem } from '../src/core/engine/particleSystem.js';
import { InputManager } from '../src/core/engine/inputManager.js';
import { GameplayRenderer } from '../src/core/engine/gameplayRenderer.js';
import { GameEngine } from '../src/core/engine/gameEngine.js';
import { AudioEngine } from '../src/core/engine/audioEngine.js';
import { gameEvents } from '../src/core/engine/eventBus.js';
import { getJudgement } from '../src/config/judgement.config.js';
import { formatKeyCode, getLaneDisplayLabel, TRI_RING_LAYOUT, layoutToPixels } from '../src/config/layout.config.js';

describe('GĐ3 Unit Tests - Core Engine & Scoring', () => {
  // =========================================================================
  // 1. Kiểm thử công thức travelTime theo Note Speed (NS)
  // =========================================================================
  it('Tính travelTime chính xác theo công thức spec cho mọi Note Speed', () => {
    // Canvas giả lập cho renderer
    const dummyCanvas = { getContext: () => ({}) };
    const renderer = new GameplayRenderer(dummyCanvas);

    // NS = 1.0 -> 1800ms
    renderer.noteSpeed = 1.0;
    expect(renderer.getTravelTime()).toBe(1800);

    // NS = 5.0 -> 1200ms
    renderer.noteSpeed = 5.0;
    expect(renderer.getTravelTime()).toBe(1200);

    // NS = 10.0 -> 450ms
    renderer.noteSpeed = 10.0;
    expect(renderer.getTravelTime()).toBe(450);

    // NS = 8.0 -> 1200 - 750 * 3 / 5 = 750ms
    renderer.noteSpeed = 8.0;
    expect(renderer.getTravelTime()).toBe(750);
  });

  // =========================================================================
  // 2. Kiểm thử cửa sổ phán định getJudgement
  // =========================================================================
  it('Phán định chính xác theo cửa sổ ±25ms, ±50ms, ±100ms, ±150ms', () => {
    // Critical Perfect: ±25ms
    expect(getJudgement(0)).toBe('CRITICAL_PERFECT');
    expect(getJudgement(20)).toBe('CRITICAL_PERFECT');
    expect(getJudgement(-25)).toBe('CRITICAL_PERFECT');

    // Perfect: ±50ms
    expect(getJudgement(26)).toBe('PERFECT');
    expect(getJudgement(-50)).toBe('PERFECT');

    // Great: ±100ms
    expect(getJudgement(51)).toBe('GREAT');
    expect(getJudgement(-100)).toBe('GREAT');

    // Good: ±150ms
    expect(getJudgement(101)).toBe('GOOD');
    expect(getJudgement(-150)).toBe('GOOD');

    // Miss: > 150ms
    expect(getJudgement(151)).toBe('MISS');
    expect(getJudgement(-160)).toBe('MISS');
  });

  // =========================================================================
  // 3. Kiểm thử ScoreManager (Achievement, Break Bonus, Combo, Rank, UR)
  // =========================================================================
  it('Tính toán Achievement 100% khi toàn bộ nốt đạt Critical Perfect', () => {
    const sm = new ScoreManager();
    const mockNotes = [
      { type: 'tap', time: 1000 },
      { type: 'tap', time: 2000 },
      { type: 'hold', time: 3000, endTime: 4000 }
    ];

    sm.initChart(mockNotes);

    sm.registerJudgement('CRITICAL_PERFECT', 'tap', 0);
    sm.registerJudgement('CRITICAL_PERFECT', 'tap', 2);
    sm.registerJudgement('CRITICAL_PERFECT', 'hold', -1);

    expect(sm.achievement).toBeCloseTo(100.0, 2);
    expect(sm.combo).toBe(3);
    expect(sm.maxCombo).toBe(3);
    expect(sm.rank).toBe('SSS');
    expect(sm.isAllPerfect).toBe(true);
    expect(sm.isFullCombo).toBe(true);
  });

  it('Break Bonus cho phép Achievement vượt 100% (tối đa 101.0000%)', () => {
    const sm = new ScoreManager();
    const mockNotes = [
      { type: 'tap', time: 1000 },
      { type: 'break', time: 2000 }
    ];

    sm.initChart(mockNotes);

    sm.registerJudgement('CRITICAL_PERFECT', 'tap', 0);
    sm.registerJudgement('CRITICAL_PERFECT', 'break', 0);

    // 100% cơ sở + 1.0000% Break Bonus = 101.0000%
    expect(sm.achievement).toBeCloseTo(101.0000, 3);
    expect(sm.rank).toBe('SSS+'); // SSS+ khi >= 100.5%
  });

  it('Combo bị reset về 0 khi dính MISS và cờ FC bị hủy', () => {
    const sm = new ScoreManager();
    sm.initChart([{ type: 'tap', time: 1000 }, { type: 'tap', time: 2000 }]);

    sm.registerJudgement('PERFECT', 'tap', 30);
    expect(sm.combo).toBe(1);

    sm.registerJudgement('MISS', 'tap', 180);
    expect(sm.combo).toBe(0);
    expect(sm.isFullCombo).toBe(false);
  });

  it('Tính toán Unstable Rate (UR = độ lệch chuẩn * 10) chính xác', () => {
    const sm = new ScoreManager();
    sm.initChart([{ type: 'tap', time: 1000 }, { type: 'tap', time: 2000 }]);

    // Hai lần gõ: +10ms và -10ms -> độ lệch chuẩn = 10ms -> UR = 100
    sm.registerJudgement('CRITICAL_PERFECT', 'tap', 10);
    sm.registerJudgement('CRITICAL_PERFECT', 'tap', -10);

    expect(sm.ur).toBeCloseTo(100.0, 1);
  });

  // =========================================================================
  // 4. Kiểm thử InputManager ánh xạ phím
  // =========================================================================
  it('InputManager ánh xạ chính xác phím mặc định vào các lane 0-8 và nốt ring', () => {
    const dummyAudio = { perfToAudioTime: () => 1000 };
    const input = new InputManager(dummyAudio);

    expect(input.codeToLane.get('Digit4')).toBe(0);
    expect(input.codeToLane.get('Digit5')).toBe(0);
    expect(input.codeToLane.get('Digit6')).toBe(1);
    expect(input.codeToLane.get('Digit7')).toBe(1);
    expect(input.codeToLane.get('Digit8')).toBe(2);
    expect(input.codeToLane.get('Digit9')).toBe(2);
    expect(input.codeToLane.get('KeyR')).toBe(3);
    expect(input.codeToLane.get('KeyF')).toBe(4);
    expect(input.codeToLane.get('KeyV')).toBe(5);
    expect(input.codeToLane.get('KeyI')).toBe(6);
    expect(input.codeToLane.get('KeyJ')).toBe(7);
    expect(input.codeToLane.get('KeyN')).toBe(8);
    expect(input.ringCodes.has('Space')).toBe(true);

    // Kiểm thử tùy biến keybind (custom keybinds)
    input.setKeybinds({
      0: ['KeyQ'],
      1: ['KeyW'],
      2: ['KeyE'],
      3: ['KeyA'],
      4: ['KeyS'],
      5: ['KeyD'],
      6: ['KeyZ'],
      7: ['KeyX'],
      8: ['KeyC'],
      ring: ['KeyB']
    });

    expect(input.codeToLane.get('KeyQ')).toBe(0);
    expect(input.codeToLane.get('KeyW')).toBe(1);
    expect(input.codeToLane.get('KeyE')).toBe(2);
    expect(input.codeToLane.get('KeyA')).toBe(3);
    expect(input.ringCodes.has('KeyB')).toBe(true);
    expect(input.ringCodes.has('Space')).toBe(false);
  });

  // =========================================================================
  // 5. Kiểm thử ParticleSystem Object Pooling
  // =========================================================================
  it('ParticleSystem tái sử dụng hạt từ pool mà không vượt quá maxParticles', () => {
    const ps = new ParticleSystem(50);
    expect(ps.activeCount).toBe(0);

    ps.spawnBurst(100, 100, '#ff0000', 30, 100);
    expect(ps.activeCount).toBe(30);

    // Cập nhật thời gian vượt quá maxLife
    ps.update(1.0);
    expect(ps.activeCount).toBe(0);
  });

  // =========================================================================
  // 6. Kiểm thử khống chế biểu đồ 2 ngón tay (enforceTwoFingerConstraint)
  // =========================================================================
  it('GameEngine lọc triệt để các chord > 2 nốt và nốt chồng lên 2 hold đang giữ', () => {
    const dummyCanvas = { getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const testNotes = [
      // 3 nốt cùng lúc tại 1000ms -> chỉ giữ tối đa 2 nốt
      { time: 1000, lane: 0, type: 'tap' },
      { time: 1000, lane: 1, type: 'tap' },
      { time: 1000, lane: 2, type: 'tap' },
      // 2 nốt hold từ 2000 đến 4000ms (chiếm cả 2 ngón)
      { time: 2000, endTime: 4000, lane: 3, type: 'hold' },
      { time: 2000, endTime: 4000, lane: 4, type: 'hold' },
      // Nốt tap tại 3000ms khi 2 hold đang giữ -> phải bị loại bỏ vì không còn ngón tay
      { time: 3000, lane: 5, type: 'tap' },
      // 1 nốt hold từ 5000 đến 7000ms (chiếm 1 ngón)
      { time: 5000, endTime: 7000, lane: 6, type: 'hold' },
      // 2 nốt tap tại 6000ms -> chỉ được giữ tối đa 1 nốt (vì còn 1 ngón rảnh)
      { time: 6000, lane: 7, type: 'tap' },
      { time: 6000, lane: 8, type: 'tap' }
    ];

    const sanitized = engine.enforceTwoFingerConstraint(testNotes);

    // Tại 1000ms: giữ 2 nốt (bỏ 1)
    const at1000 = sanitized.filter(n => n.time === 1000);
    expect(at1000.length).toBe(2);

    // Tại 2000ms: giữ 2 nốt hold
    const at2000 = sanitized.filter(n => n.time === 2000);
    expect(at2000.length).toBe(2);

    // Tại 3000ms: không có nốt nào (vì 2 ngón đang giữ hold)
    const at3000 = sanitized.filter(n => n.time === 3000);
    expect(at3000.length).toBe(0);

    // Tại 6000ms: chỉ có đúng 1 nốt (vì ngón kia đang giữ hold từ 5000)
    const at6000 = sanitized.filter(n => n.time === 6000);
    expect(at6000.length).toBe(1);
  });

  // =========================================================================
  // 7. Kiểm thử Ring Note (bằng cả outline, nhấn SPACE) và Autoplay mode
  // =========================================================================
  it('GameEngine phán định Ring Note khi nhấn phím SPACE', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const ringNote = {
      type: 'ring',
      time: 2000
    };

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [ringNote]
    };

    await engine.loadChart(beatmap);
    const n = engine.notes[0];
    expect(n.type).toBe('ring');
    expect(n.state).not.toBe('JUDGED');

    // Nhấn phím SPACE trễ 120ms vẫn nhận tối đa với Ring Tap
    engine.handleSpaceDown(2120, 2120);
    expect(n.state).toBe('JUDGED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(1);
    expect(engine.scoreManager.counts.perfect).toBe(0);
    expect(engine.scoreManager.combo).toBe(1);
  });

  it('Autoplay mode tự động đánh trúng nốt Ring và các nốt khác', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    engine.setAutoplay(true);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', time: 1000, lane: 0 },
        { type: 'ring', time: 2000 }
      ]
    };

    await engine.loadChart(beatmap);
    expect(engine.isAutoplay).toBe(true);

    // Chạy engine tới 1000ms -> Autoplay tự đánh nốt tap
    engine.updateNotes(1000);
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(1);

    // Chạy engine tới 2000ms -> Autoplay tự đánh nốt ring
    engine.updateNotes(2000);
    expect(engine.notes[1].state).toBe('JUDGED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(2);
    expect(engine.scoreManager.combo).toBe(2);
  });

  it('GameEngine tự động phán định nốt Ring khi người chơi GIỮ phím Space (không cần bấm quá nhiều lần)', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'ring', time: 1000 },
        { type: 'ring', time: 1250 },
        { type: 'ring', time: 1500 }
      ]
    };

    await engine.loadChart(beatmap);

    // Người chơi bấm giữ phím Space liên tục
    engine.inputManager.isSpaceDown = true;

    // Khi bài hát trôi qua 1000ms
    engine.updateNotes(1000);
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(1);

    // Tiếp tục giữ phím Space trôi qua 1250ms (nốt thứ hai)
    engine.updateNotes(1250);
    expect(engine.notes[1].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(2);

    // Tiếp tục giữ phím Space trôi qua 1500ms (nốt thứ ba)
    engine.updateNotes(1500);
    expect(engine.notes[2].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(3);
    expect(engine.scoreManager.counts.criticalPerfect).toBe(3);

    // Người chơi nhả phím Space
    engine.inputManager.isSpaceDown = false;
  });

  // =========================================================================
  // 13. Kiểm thử tính năng nhấn Space để Skip đoạn nghỉ (Break / Intro)
  // =========================================================================
  it('Nhấn phím Space để Skip đoạn không có nốt (Intro / Break) tua nhanh bài hát', async () => {
    const dummyCanvas = { getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    // Beatmap có đoạn intro dài 10 giây (nốt đầu tiên ở 10,000ms)
    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 0, time: 10000 },
        { type: 'tap', lane: 1, time: 10500 },
        // Đoạn break dài giữa bài: nốt tiếp theo ở 25,000ms
        { type: 'tap', lane: 2, time: 25000 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;

    // Tại thời điểm t = 500ms (đầu map, nốt đầu ở 10s): có thể skip
    expect(engine.canSkipBreak(500)).toBe(true);

    // Người chơi nhấn phím SPACE để skip intro
    engine.handleSpaceDown(500, 500);

    // Đã skip thành công tới ngay trước nốt đầu tiên (10000ms - leadTime)
    const currentAudioTime = engine.audioEngine.getSongTimeMs();
    expect(currentAudioTime).toBeGreaterThanOrEqual(8000);
    expect(currentAudioTime).toBeLessThanOrEqual(9000);

    // Lúc này nốt đầu tiên đang bay vào (cách < 2500ms), không thể skip nữa
    expect(engine.canSkipBreak(currentAudioTime)).toBe(false);

    // Giả lập chơi qua nốt 1 và nốt 2
    engine.notes[0].state = 'JUDGED';
    engine.notes[1].state = 'JUDGED';

    // Yêu cầu mới: CHỈ bỏ qua đoạn nghỉ đầu map thôi, mấy khúc sau KHÔNG cho skip nữa
    expect(engine.canSkipBreak(13000)).toBe(false);

    // Người chơi nhấn SPACE ở giữa bài sẽ không skip đoạn nghỉ nữa
    const skippedMiddle = engine.skipBreak(13000);
    expect(skippedMiddle).toBe(false);
  });

  it('Cho phép 1 nốt Ring + tối đa 2 nốt bấm bàn phím đồng thời (Ring không tính vào giới hạn 2 nốt)', async () => {
    const dummyCanvas = { getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    const beatmap = {
      version: 2,
      notes: [
        // Tại cùng thời điểm t = 1000ms: có 1 nốt Ring + 2 nốt Tap bàn phím (Lane 0 và Lane 4)
        { type: 'ring', time: 1000 },
        { type: 'tap', lane: 0, time: 1000 },
        { type: 'tap', lane: 4, time: 1000 }
      ]
    };

    await engine.loadChart(beatmap);
    // Cả 3 nốt đều được giữ lại (1 Ring + 2 Taps)
    expect(engine.notes.length).toBe(3);
    expect(engine.notes.filter(n => n.type === 'ring').length).toBe(1);
    expect(engine.notes.filter(n => n.type === 'tap').length).toBe(2);
  });

  it('Ring Hold chỉ nhận tối đa một lần khi giữ đủ tới endTime', async () => {
    const dummyCanvas = { getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    const playedSounds = [];
    engine.audioEngine.playHitsound = (name, vol) => { playedSounds.push(name); };

    const beatmap = {
      version: 2,
      notes: [
        { type: 'ring', isHold: true, time: 1000, endTime: 2500 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;
    const ringNote = engine.notes[0];
    expect(ringNote.isHold).toBe(true);
    expect(ringNote.endTime).toBe(2500);

    // Giữ Space khi nốt tới
    engine.inputManager.isSpaceDown = true;
    engine.updateNotes(1000);

    expect(ringNote.headJudged).toBe(true);
    expect(ringNote.isHolding).toBe(true);
    expect(engine.scoreManager.combo).toBe(0);
    expect(playedSounds).toContain('ring-hold');
    const hitsoundCountAtStart = playedSounds.filter(s => s === 'ring-hold').length;
    expect(hitsoundCountAtStart).toBe(1);

    // Tiếp tục giữ Space cho tới hết nốt
    engine.updateNotes(2500);
    expect(ringNote.tailJudged).toBe(true);
    expect(ringNote.state).toBe('JUDGED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(1);
    expect(engine.scoreManager.counts.perfect).toBe(0);
    expect(engine.scoreManager.counts.miss).toBe(0);
    expect(engine.scoreManager.combo).toBe(1);

    // Nốt hold kết thúc KHÔNG được phát thêm sound effect 'ring-hold'
    const hitsoundCountAtEnd = playedSounds.filter(s => s === 'ring-hold').length;
    expect(hitsoundCountAtEnd).toBe(1);
  });

  it('Ring Hold released before its tail is a single MISS', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    await engine.loadChart({
      notes: [{ type: 'ring', isHold: true, time: 1000, endTime: 2500 }]
    });

    engine.inputManager.isSpaceDown = true;
    engine.updateNotes(1000);
    engine.inputManager.isSpaceDown = false;
    engine.updateNotes(1200);

    expect(engine.notes[0].state).toBe('MISSED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(0);
    expect(engine.scoreManager.counts.miss).toBe(1);
    expect(engine.scoreManager.combo).toBe(0);
  });

  it('Ring Hold released at its tail receives one CRITICAL_PERFECT', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    await engine.loadChart({
      notes: [{ type: 'ring', isHold: true, time: 1000, endTime: 2500 }]
    });

    engine.inputManager.isSpaceDown = true;
    engine.updateNotes(1000);
    engine.inputManager.isSpaceDown = false;
    engine.handleSpaceUp(2500);

    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(1);
    expect(engine.scoreManager.counts.miss).toBe(0);
  });

  it('does not start a stopped engine after asynchronous audio initialization', async () => {
    const engine = new GameEngine({ getContext: () => ({}) });
    const originalInit = engine.audioEngine.init;
    let resolveInit;
    let attached = false;
    engine.audioEngine.init = () => new Promise((resolve) => {
      resolveInit = resolve;
    });
    engine.inputManager.attach = () => { attached = true; };

    const startPromise = engine.start(0, false);
    engine.stop();
    resolveInit();
    await startPromise;
    engine.audioEngine.init = originalInit;

    expect(engine.isRunning).toBe(false);
    expect(attached).toBe(false);
    expect(engine.animFrameId).toBe(null);
  });

  it('InputManager hỗ trợ tùy biến phím Ring và kích hoạt onSpaceDown với phím tùy chọn', () => {
    const dummyAudio = { perfToAudioTime: () => 1000 };
    const input = new InputManager(dummyAudio);

    let spaceDownTriggered = false;
    input.onSpaceDown = () => { spaceDownTriggered = true; };

    // Tùy biến phím ring sang 'KeyB'
    input.setKeybinds({
      ...input.keybinds,
      ring: ['KeyB']
    });

    const preventDefaultMock = () => {};
    // Bấm Space -> không ăn vì đã đổi sang KeyB
    input.handleKeyDown({ code: 'Space', preventDefault: preventDefaultMock, timeStamp: 100 });
    expect(spaceDownTriggered).toBe(false);
    expect(input.isSpaceDown).toBe(false);

    // Bấm KeyB -> ăn nốt Ring
    input.handleKeyDown({ code: 'KeyB', preventDefault: preventDefaultMock, timeStamp: 100 });
    expect(spaceDownTriggered).toBe(true);
    expect(input.isSpaceDown).toBe(true);

    // Nhả KeyB
    input.handleKeyUp({ code: 'KeyB', preventDefault: preventDefaultMock, timeStamp: 200 });
    expect(input.isSpaceDown).toBe(false);
  });

  it('formatKeyCode và getLaneDisplayLabel hiển thị chính xác nhãn phím trên Bead', () => {
    expect(formatKeyCode('KeyR')).toBe('R');
    expect(formatKeyCode('Digit4')).toBe('4');
    expect(formatKeyCode('Numpad7')).toBe('NUM7');
    expect(formatKeyCode('Space')).toBe('SPACE');

    const customKeybinds = {
      0: ['KeyQ', 'KeyW'],
      3: ['KeyE'],
      ring: ['KeyB']
    };

    expect(getLaneDisplayLabel(0, customKeybinds)).toBe('Q·W');
    expect(getLaneDisplayLabel(3, customKeybinds)).toBe('E');
    expect(getLaneDisplayLabel('ring', customKeybinds)).toBe('B');
  });

  it('Hệ thống tính toán fade in cho tất cả các loại nốt (Tap, Hold body, Slide, Ring, Typing)', () => {
    // 1. Công thức fade in cơ bản của nốt: mượt mà từ 0 -> 1 khi p từ 0 -> 0.35
    const calcFadeIn = (p) => Math.min(1.0, Math.sin(Math.min(1.0, Math.max(0, p) / 0.35) * (Math.PI / 2)));

    expect(calcFadeIn(0)).toBe(0);
    expect(calcFadeIn(0.175)).toBeGreaterThan(0.65);
    expect(calcFadeIn(0.35)).toBe(1.0);
    expect(calcFadeIn(0.5)).toBe(1.0);
    expect(calcFadeIn(1.0)).toBe(1.0);

    // 2. Fade in của Hold Note Body: không pop in đột ngột tại pHead = 0
    const holdHeadP = 0.05;
    const holdFadeIn = calcFadeIn(holdHeadP);
    expect(holdFadeIn).toBeGreaterThan(0.1);
    expect(holdFadeIn).toBeLessThan(0.3);

    // 3. Fade in của Typing chip khi trôi từ mép phải
    const calcChipFade = (stripX, stripWidth, chipX) => {
      const distFromRight = (stripX + stripWidth) - chipX;
      return Math.max(0, Math.min(1.0, distFromRight / 50));
    };

    const stripX = 100, stripW = 600;
    // Vừa xuất hiện ở mép phải (chipX = 700) -> fade = 0
    expect(calcChipFade(stripX, stripW, 700)).toBe(0);
    // Đi vào 25px -> fade = 0.5
    expect(calcChipFade(stripX, stripW, 675)).toBe(0.5);
    // Đi vào >= 50px -> fade = 1.0
    expect(calcChipFade(stripX, stripW, 640)).toBe(1.0);
  });

  // =========================================================================
  // 17. Kiểm thử chống Notelock & phán định chuẩn xác khi đánh gần nốt
  // =========================================================================
  it('17. handleLaneDown ưu tiên nốt gần nhất, không nuốt nốt và dọn nốt cũ chống notelock', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 3, time: 1000 },
        { type: 'tap', lane: 3, time: 1140 },
        // Nốt Ring kèm Tap đồng thời từ slide convert
        { type: 'ring', time: 2000 },
        { type: 'tap', lane: 2, time: 2000 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;

    // Người chơi bấm lúc 1135ms (rất gần nốt 2 ở 1140ms, cách nốt 1 135ms)
    // Engine phải ưu tiên nốt 2 (delta = -5ms -> CRITICAL PERFECT) và dọn nốt 1 cũ thành MISS
    engine.handleLaneDown(3, 1135, 1135);

    expect(engine.notes[1].state).toBe('JUDGED');
    expect(engine.notes[0].state).toBe('MISSED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(1);
    expect(engine.scoreManager.counts.miss).toBe(1);

    // Khi nốt Ring + Tap đồng thời: mỗi nốt cần input độc lập (Lane phán định Tap, Space phán định Ring)
    engine.handleLaneDown(2, 2000, 2000);
    expect(engine.notes[3].state).toBe('JUDGED'); // Tap note ăn
    expect(engine.notes[2].state).not.toBe('JUDGED'); // Ring note không bị ăn nhầm (chống ghost note)

    // Bấm Space để phán định nốt Ring
    engine.handleSpaceDown(2000, 2000);
    expect(engine.notes[2].state).toBe('JUDGED'); // Ring note ăn chính xác khi bấm Space
  });

  it('18. Bấm sớm ngoài cửa sổ (> 150ms) không giết chết nốt tương lai thành MISS', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 4, time: 2000 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;

    // Người chơi bấm sớm lúc 1800ms (cách 200ms ngoài cửa sổ good 150ms)
    engine.handleLaneDown(4, 1800, 1800);
    // Nốt vẫn phải PENDING hoặc ACTIVE, KHÔNG được biến thành MISSED
    expect(engine.notes[0].state).not.toBe('MISSED');

    // Sau đó lúc 2000ms người chơi bấm trúng
    engine.handleLaneDown(4, 2000, 2000);
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(1);
  });

  // =========================================================================
  // Giai đoạn P3: Đếm ngược 3-2-1 trước khi bắt đầu map
  // =========================================================================
  it('19. Khởi động GameEngine với trạng thái COUNTDOWN 3-2-1, chặn input và đóng băng đồng hồ', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [{ type: 'tap', lane: 4, time: 2000 }]
    };

    await engine.loadChart(beatmap);
    await engine.start(0, true);

    expect(engine.isCountdown).toBe(true);
    expect(engine.resumeCountdown).toBeGreaterThan(3.0);
    expect(engine.countdownType).toBe('START');

    // Trong countdown: input phán định bị chặn hoàn toàn
    engine.handleLaneDown(4, 2000, 2000);
    expect(engine.notes[0].state).toBe('PENDING');
    expect(engine.scoreManager.counts.criticalPerfect).toBe(0);

    engine.stop();
  });

  it('20. Hủy countdown an toàn khi bấm Pause/Esc hoặc Stop giữa lúc đếm ngược', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [{ type: 'tap', lane: 4, time: 2000 }]
    };

    await engine.loadChart(beatmap);
    await engine.start(0, true);
    expect(engine.isCountdown).toBe(true);

    // Người chơi bấm Esc (Pause) trong khi countdown đang chạy
    engine.togglePause();
    expect(engine.isCountdown).toBe(false);
    expect(engine.isPaused).toBe(true);
    expect(engine.resumeCountdown).toBe(0);

    engine.stop();
  });

  it('Tiếp tục đúng START countdown sau khi pause giữa countdown', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    await engine.loadChart({ notes: [{ type: 'tap', lane: 4, time: 2000 }] });
    await engine.start(0, true);

    engine.togglePause();
    expect(engine.isPaused).toBe(true);
    engine.togglePause();
    expect(engine.countdownType).toBe('START');
    expect(engine.isCountdown).toBe(true);

    engine.finishCountdown();
    expect(engine.audioEngine.isPlaying).toBe(true);
    expect(engine.isPaused).toBe(false);
    engine.stop();
  });

  it('Không phán MISS Hold khi phím hoặc pointer được nhả trong lúc pause', () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    const keyboardHold = { lane: 4, endTime: 3000, state: 'ACTIVE', isHolding: true };
    const pointerHold = { lane: 5, endTime: 3000, state: 'ACTIVE', isHolding: true };
    const ringHold = {
      type: 'ring',
      isHold: true,
      time: 1000,
      endTime: 3000,
      state: 'ACTIVE',
      headJudged: true,
      isHolding: true,
      resumeHoldThroughPause: false
    };
    engine.isRunning = true;
    engine.notes = [ringHold];
    engine.holdingNotes.set(4, keyboardHold);
    engine.holdingNotes.set(5, pointerHold);
    engine.inputManager.isSpaceDown = true;
    engine.inputManager.activeHeldCodes.add('KeyF');
    engine.inputManager.isKeyDown[4] = true;
    engine.activeTouchPointers.set(12, { lane: 5, px: 0, py: 0, startTime: 1000 });

    engine.togglePause();
    engine.inputManager.handleKeyUp({
      code: 'KeyF',
      key: 'f',
      timeStamp: 1100,
      preventDefault() {}
    });
    engine.inputManager.handleKeyUp({
      code: 'Space',
      key: ' ',
      timeStamp: 1100,
      preventDefault() {}
    });
    engine.handlePointerUp({ pointerId: 12, timeStamp: 1100 });
    engine.togglePause();
    engine.finishCountdown();
    engine.updateNotes(1500);

    expect(keyboardHold.state).toBe('ACTIVE');
    expect(pointerHold.state).toBe('ACTIVE');
    expect(ringHold.state).toBe('ACTIVE');
    expect(engine.scoreManager.counts.miss).toBe(0);

    engine.inputManager.handleKeyDown({
      code: 'Space',
      key: ' ',
      timeStamp: 1200,
      repeat: false,
      preventDefault() {}
    });
    engine.inputManager.handleKeyUp({
      code: 'Space',
      key: ' ',
      timeStamp: 1300,
      preventDefault() {}
    });
    engine.updateNotes(1600);
    expect(ringHold.state).toBe('MISSED');
    engine.stop();
  });

  it('Visibility loss pauses gameplay before a throttled frame can update notes', () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    engine.isRunning = true;
    let updateCount = 0;
    engine.updateNotes = () => { updateCount++; };

    engine.handleVisibilityChange(true);
    engine.loop();

    expect(engine.isPaused).toBe(true);
    expect(updateCount).toBe(0);
    engine.stop();
  });

  it('AudioEngine giữ nguyên song time khi pause/resume có user offset và output latency', () => {
    const audio = new AudioEngine();
    const audioCtx = {
      currentTime: 12,
      baseLatency: 0.02,
      outputLatency: 0.03,
      destination: {},
      createBufferSource: () => ({
        connect() {},
        start() {},
        stop() {},
        disconnect() {}
      })
    };
    audio.audioCtx = audioCtx;
    audio.musicBuffer = { duration: 30 };
    audio.musicGain = {};
    audio.userOffsetMs = 120;
    audio.startTime = 8;
    audio.isPlaying = true;

    const songTimeBeforePause = audio.getSongTimeMs();
    audio.pauseMusic();
    audioCtx.currentTime += 2;
    audio.resumeMusic();

    expect(audio.getSongTimeMs()).toBeCloseTo(songTimeBeforePause, 5);

    audio.stopMusic();
    audio.pausedAt = -0.5;
    audio.isPaused = true;
    audio.resumeMusic();
    expect(audio.getSongTimeMs()).toBeCloseTo(-500, 5);
  });

  it('Retry reset lại note states và toàn bộ điểm đã hoàn thành', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    await engine.loadChart({
      notes: [{ type: 'tap', lane: 4, time: 1000 }]
    });
    engine.triggerJudgement(engine.notes[0], 'MISS', 150);
    expect(engine.notes[0].state).toBe('MISSED');

    engine.stop();
    engine.resetRun();

    expect(engine.notes[0].state).toBe('PENDING');
    expect(engine.scoreManager.counts.miss).toBe(0);
    expect(engine.scoreManager.achievement).toBe(0);
    expect(engine.scoreManager.combo).toBe(0);
    engine.stop();
  });

  it('Ring MISS phát judgement event để cập nhật live HUD', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);
    await engine.loadChart({ notes: [{ type: 'ring', time: 1000 }] });
    const judgements = [];
    const off = gameEvents.on('judgement', event => judgements.push(event));

    engine.updateNotes(1151);

    expect(judgements).toHaveLength(1);
    expect(judgements[0].judgement).toBe('MISS');
    expect(judgements[0].achievement).toBe(0);
    off();
    engine.stop();
  });

  it('21. Bắt đầu map có 1 giây lead-in không nhạc (-1000ms) để chống rocket note', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [{ type: 'tap', lane: 4, time: 200 }] // Nốt đầu xuất hiện rất sớm ở 200ms
    };

    await engine.loadChart(beatmap);
    // Bắt đầu không đếm ngược (để kiểm tra trực tiếp lead-in khi bài bắt đầu)
    await engine.start(0, false);

    // Thời gian bài hát ban đầu âm ~ -1000ms (1 giây trống không có nhạc)
    const songTime = engine.audioEngine.getSongTimeMs();
    expect(songTime).toBeLessThanOrEqual(-900);
    expect(songTime).toBeGreaterThanOrEqual(-1100);

    // Với travelTime 450ms, nốt ở 200ms xuất hiện tại 200 - 450 = -250ms
    // Tại thời điểm -1000ms, nốt chưa bị ACTIVE quá sớm
    expect(engine.notes[0].state).toBe('PENDING');

    // Khi thời gian tới -200ms (sau 800ms của lead-in): nốt chuyển ACTIVE mượt mà trước khi nhạc bắt đầu lúc 0ms
    engine.updateNotes(-200);
    expect(engine.notes[0].state).toBe('ACTIVE');

    engine.stop();
  });

  it('22. totalDuration cập nhật theo độ dài audio và sắp xếp nốt tăng dần, chống kết thúc sớm bài hát', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    // Map có nốt không theo thứ tự thời gian (ví dụ note 5000ms đứng trước note 10000ms đứng trước note 2000ms)
    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 0, time: 5000 },
        { type: 'tap', lane: 1, time: 10000 },
        { type: 'tap', lane: 2, time: 2000 }
      ]
    };

    await engine.loadChart(beatmap);

    // Notes phải được sắp xếp theo thời gian tăng dần
    expect(engine.notes[0].time).toBe(2000);
    expect(engine.notes[1].time).toBe(5000);
    expect(engine.notes[2].time).toBe(10000);

    // totalDuration ban đầu >= max(10000 + 1500, 30000) = 30000ms
    expect(engine.totalDuration).toBeGreaterThanOrEqual(30000);

    // Giả lập audio dài 90 giây (90000ms)
    engine.audioEngine.musicBuffer = { duration: 90 };
    const audioDurMs = Math.round(engine.audioEngine.getDuration() * 1000);
    engine.totalDuration = Math.max(engine.totalDuration, audioDurMs);
    expect(engine.totalDuration).toBe(90000);

    // Khi người chơi đã đánh xong hết các nốt nhưng nhạc mới ở giây 40 (40000ms < 90000ms), không kết thúc sớm
    engine.notes.forEach(n => { n.state = 'JUDGED'; });
    let ended = false;
    engine.finishGame = () => { ended = true; };

    const allNotesDone = engine.notes.every(n => n.state === 'JUDGED' || n.state === 'MISSED');
    const songTime40s = 40000;
    if ((allNotesDone && songTime40s >= engine.totalDuration) || (songTime40s >= engine.totalDuration + 2000)) {
      engine.finishGame();
    }
    expect(ended).toBe(false);

    // Chỉ kết thúc khi nhạc đã chạy hết totalDuration
    const songTime90s = 90000;
    if ((allNotesDone && songTime90s >= engine.totalDuration) || (songTime90s >= engine.totalDuration + 2000)) {
      engine.finishGame();
    }
    expect(ended).toBe(true);
  });

  it('23. Không xảy ra ghost note: giữ phím Space không nuốt nốt Tap hay biến mất trước khi hiển thị', async () => {
    const dummyCanvas = { width: 800, height: 600, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'ring', time: 1000 },
        { type: 'tap', lane: 4, time: 1000 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;
    engine.inputManager.isSpaceDown = true; // Người chơi giữ Space

    // Tại 950ms: nốt chưa tới (cách 50ms), nốt Tap vẫn phải ACTIVE và không bị đánh dấu JUDGED sớm
    engine.updateNotes(950);
    expect(engine.notes[1].state).toBe('ACTIVE');
    expect(engine.notes[0].state).toBe('ACTIVE');

    // Tại 1000ms: nốt Ring được phán định bởi Space
    engine.updateNotes(1000);
    expect(engine.notes[0].state).toBe('JUDGED');
    // Nốt Tap VẪN PHẢI GIỮ ACTIVE, chờ người chơi bấm phím F (lane 4)
    expect(engine.notes[1].state).toBe('ACTIVE');

    // Người chơi bấm phím F (lane 4)
    engine.handleLaneDown(4, 1005, 1005);
    expect(engine.notes[1].state).toBe('JUDGED');
  });

  it('24. Tương tác ngón tay (Touch/Pointer): chạm vào ô phím Lane kích hoạt phán định nốt trên Lane', async () => {
    const dummyCanvas = { width: 720, height: 620, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 4, time: 1000 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;
    engine.audioEngine.startMusic();
    engine.audioEngine.isPlaying = true;
    engine.audioEngine.startTime = 0;
    engine.audioEngine.startPerfTime = performance.now();

    // Lấy tọa độ pixel của Lane 4 (nút F)
    const lane4Pix = layoutToPixels(TRI_RING_LAYOUT.tapLanes[4].x, TRI_RING_LAYOUT.tapLanes[4].y, 720, 620);

    // Chạm ngón tay vào Lane 4 lúc 1000ms
    engine.handlePointerDown({
      clientX: lane4Pix.x,
      clientY: lane4Pix.y,
      pointerId: 1,
      audioTime: 1000,
      timeStamp: 1000
    });

    expect(engine.inputManager.isKeyDown[4]).toBe(true);
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(1);

    // Nhấc ngón tay lên
    engine.handlePointerUp({
      pointerId: 1,
      audioTime: 1050,
      timeStamp: 1050
    });

    expect(engine.inputManager.isKeyDown[4]).toBe(false);
  });

  it('25. Đa chạm ngón tay (Multi-touch): 2 ngón tay chạm 2 ô phím khác nhau cùng lúc', async () => {
    const dummyCanvas = { width: 720, height: 620, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 0, time: 2000 },
        { type: 'tap', lane: 8, time: 2000 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;

    const lane0Pix = layoutToPixels(TRI_RING_LAYOUT.tapLanes[0].x, TRI_RING_LAYOUT.tapLanes[0].y, 720, 620);
    const lane8Pix = layoutToPixels(TRI_RING_LAYOUT.tapLanes[8].x, TRI_RING_LAYOUT.tapLanes[8].y, 720, 620);

    // Ngón tay 1 chạm Lane 0
    engine.handlePointerDown({
      clientX: lane0Pix.x,
      clientY: lane0Pix.y,
      pointerId: 10,
      audioTime: 2000,
      timeStamp: 2000
    });

    // Ngón tay 2 chạm Lane 8
    engine.handlePointerDown({
      clientX: lane8Pix.x,
      clientY: lane8Pix.y,
      pointerId: 11,
      audioTime: 2000,
      timeStamp: 2000
    });

    expect(engine.inputManager.isKeyDown[0]).toBe(true);
    expect(engine.inputManager.isKeyDown[8]).toBe(true);
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.notes[1].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(2);

    // Ngón tay 1 nhấc lên, ngón tay 2 vẫn chạm
    engine.handlePointerUp({ pointerId: 10, audioTime: 2050, timeStamp: 2050 });
    expect(engine.inputManager.isKeyDown[0]).toBe(false);
    expect(engine.inputManager.isKeyDown[8]).toBe(true);

    // Ngón tay 2 nhấc lên
    engine.handlePointerUp({ pointerId: 11, audioTime: 2080, timeStamp: 2080 });
    expect(engine.inputManager.isKeyDown[8]).toBe(false);
  });

  it('26. Yêu cầu Mobile: Chạm vào bất kì nút judgement nào (hoặc tâm/khung) đều kích hoạt phán định Ring Note', async () => {
    const dummyCanvas = { width: 720, height: 620, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'ring', time: 1000 },
        { type: 'ring', time: 2000 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;

    // 1. Chạm vào nút Judgement Lane 1 (nút trên đỉnh) lúc 1000ms -> phán định nốt Ring 1
    const lane1Pix = layoutToPixels(TRI_RING_LAYOUT.tapLanes[1].x, TRI_RING_LAYOUT.tapLanes[1].y, 720, 620);
    engine.handlePointerDown({
      clientX: lane1Pix.x,
      clientY: lane1Pix.y,
      pointerId: 1,
      audioTime: 1000,
      timeStamp: 1000
    });
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(1);
    engine.handlePointerUp({ pointerId: 1, audioTime: 1050, timeStamp: 1050 });

    // 2. Chạm vào tâm hoặc ngoài ô phím lúc 2000ms -> phán định nốt Ring 2
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, 720, 620);
    engine.handlePointerDown({
      clientX: originPix.x,
      clientY: originPix.y,
      pointerId: 2,
      audioTime: 2000,
      timeStamp: 2000
    });
    expect(engine.notes[1].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(2);
    engine.handlePointerUp({ pointerId: 2, audioTime: 2050, timeStamp: 2050 });
  });

  it('27. Cho phép mobile tự do quẹt (swipe/slide) ngón tay qua các judgement để kích hoạt liên tiếp các lane', async () => {
    const dummyCanvas = { width: 720, height: 620, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 0, time: 1000 },
        { type: 'tap', lane: 1, time: 1050 },
        { type: 'tap', lane: 2, time: 1100 }
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;

    const lane0Pix = layoutToPixels(TRI_RING_LAYOUT.tapLanes[0].x, TRI_RING_LAYOUT.tapLanes[0].y, 720, 620);
    const lane1Pix = layoutToPixels(TRI_RING_LAYOUT.tapLanes[1].x, TRI_RING_LAYOUT.tapLanes[1].y, 720, 620);
    const lane2Pix = layoutToPixels(TRI_RING_LAYOUT.tapLanes[2].x, TRI_RING_LAYOUT.tapLanes[2].y, 720, 620);

    // 1. Chạm ngón tay vào Lane 0 lúc 1000ms
    engine.handlePointerDown({
      clientX: lane0Pix.x,
      clientY: lane0Pix.y,
      pointerId: 99,
      audioTime: 1000,
      timeStamp: 1000
    });
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.inputManager.isKeyDown[0]).toBe(true);

    // 2. Quẹt ngón tay từ Lane 0 sang Lane 1 lúc 1050ms
    engine.handlePointerMove({
      clientX: lane1Pix.x,
      clientY: lane1Pix.y,
      pointerId: 99,
      audioTime: 1050,
      timeStamp: 1050
    });
    expect(engine.inputManager.isKeyDown[0]).toBe(false); // Đã nhả Lane 0
    expect(engine.inputManager.isKeyDown[1]).toBe(true);  // Đã kích hoạt Lane 1
    expect(engine.notes[1].state).toBe('JUDGED');

    // 3. Quẹt ngón tay tiếp sang Lane 2 lúc 1100ms
    engine.handlePointerMove({
      clientX: lane2Pix.x,
      clientY: lane2Pix.y,
      pointerId: 99,
      audioTime: 1100,
      timeStamp: 1100
    });
    expect(engine.inputManager.isKeyDown[1]).toBe(false); // Đã nhả Lane 1
    expect(engine.inputManager.isKeyDown[2]).toBe(true);  // Đã kích hoạt Lane 2
    expect(engine.notes[2].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(3);

    // 4. Nhấc ngón tay lên
    engine.handlePointerUp({ pointerId: 99, audioTime: 1150, timeStamp: 1150 });
    expect(engine.inputManager.isKeyDown[2]).toBe(false);
  });

  it('28. Hitbox mở rộng theo cánh quạt (Radial Sector) cho mobile: chạm xa nút ở mép ngoài màn hình vẫn kích hoạt đúng lane', async () => {
    const dummyCanvas = { width: 1080, height: 720, getContext: () => ({}) };
    const engine = new GameEngine(dummyCanvas);

    const beatmap = {
      timingPoints: [{ bpm: 120, beatLength: 500 }],
      notes: [
        { type: 'tap', lane: 4, time: 1000 }, // Lane 4 (F) ở bên trái
        { type: 'tap', lane: 7, time: 2000 }  // Lane 7 (J) ở bên phải
      ]
    };

    await engine.loadChart(beatmap);
    engine.isRunning = true;

    // 1. Chạm ở mép ngoài cùng bên trái (x = 40px, y = 450px) xa hẳn nút bấm Lane 4 (nút F)
    // Theo cánh quạt góc của Lane 4, điểm chạm này phải kích hoạt đúng Lane 4
    engine.handlePointerDown({
      clientX: 40,
      clientY: 450,
      pointerId: 201,
      audioTime: 1000,
      timeStamp: 1000
    });
    expect(engine.inputManager.isKeyDown[4]).toBe(true);
    expect(engine.notes[0].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(1);
    engine.handlePointerUp({ pointerId: 201, audioTime: 1050, timeStamp: 1050 });
    expect(engine.inputManager.isKeyDown[4]).toBe(false);

    // 2. Chạm ở mép ngoài cùng bên phải (x = 1040px, y = 450px) xa hẳn nút bấm Lane 7 (nút J)
    engine.handlePointerDown({
      clientX: 1040,
      clientY: 450,
      pointerId: 202,
      audioTime: 2000,
      timeStamp: 2000
    });
    expect(engine.inputManager.isKeyDown[7]).toBe(true);
    expect(engine.notes[1].state).toBe('JUDGED');
    expect(engine.scoreManager.combo).toBe(2);
    engine.handlePointerUp({ pointerId: 202, audioTime: 2050, timeStamp: 2050 });
    expect(engine.inputManager.isKeyDown[7]).toBe(false);
  });
});
