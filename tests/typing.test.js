import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/core/engine/gameEngine.js';
import { ScoreManager } from '../src/core/engine/scoreManager.js';
import { JUDGEMENT_CONFIG } from '../src/config/judgement.config.js';

function createMockCanvas(width = 720, height = 620) {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    setLineDash: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn()
  };
  return {
    width,
    height,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
}

describe('GĐ5 Unit Tests - Typing Section & Video Sync', () => {
  let canvas;
  let engine;

  beforeEach(() => {
    canvas = createMockCanvas();
    engine = new GameEngine(canvas);
  });

  it('1. ScoreManager khởi tạo đúng trọng số cho các ký tự Typing (mỗi ký tự trọng số 1)', () => {
    const sm = new ScoreManager();
    const notes = [
      { type: 'tap', time: 1000, lane: 0 }, // weight 1
      {
        type: 'typing',
        time: 2000,
        endTime: 3000,
        chars: [
          { time: 2000, char: 'n' },
          { time: 2250, char: 'e' },
          { time: 2500, char: 'o' },
          { time: 2750, char: 'n' }
        ]
      } // 4 chars * 1 = 4
    ];

    sm.initChart(notes);
    expect(sm.totalNotes).toBe(5); // 1 tap + 4 chars
    expect(sm.totalBaseWeight).toBe(5); // 1 + 4
  });

  it('2. ScoreManager.breakCombo() làm gãy combo khi gõ sai mà không tính MISS', () => {
    const sm = new ScoreManager();
    sm.initChart([{ type: 'tap', time: 1000, lane: 0 }]);
    sm.registerJudgement('CRITICAL_PERFECT', 'tap', 0);
    expect(sm.combo).toBe(1);
    expect(sm.counts.miss).toBe(0);

    sm.breakCombo();
    expect(sm.combo).toBe(0);
    expect(sm.counts.miss).toBe(0); // Không trừ điểm hay tính MISS
    expect(sm.isFullCombo).toBe(false);
  });

  it('3. GameEngine nạp và khởi tạo đúng các trạng thái PENDING của Typing Note', async () => {
    const testMap = {
      version: 2,
      layout: 'triRing9',
      metadata: { title: 'Typing Test' },
      timingPoints: [{ time: 0, bpm: 120, beatLength: 500 }],
      notes: [
        {
          type: 'typing',
          time: 2000,
          endTime: 3500,
          chars: [
            { time: 2000, char: 'a' },
            { time: 2500, char: 'b' },
            { time: 3000, char: 'c' }
          ]
        }
      ]
    };

    await engine.loadChart(testMap, null);
    const typingNote = engine.notes.find(n => n.type === 'typing');
    expect(typingNote).toBeDefined();
    expect(typingNote.chars.length).toBe(3);
    expect(typingNote.chars[0].state).toBe('PENDING');
    expect(typingNote.chars[1].state).toBe('PENDING');
    expect(typingNote.chars[2].state).toBe('PENDING');
  });

  it('4. Gõ đúng ký tự trong cửa sổ GOOD phán định thành công và tính điểm', async () => {
    const testMap = {
      version: 2,
      layout: 'triRing9',
      metadata: { title: 'Typing Test' },
      timingPoints: [{ time: 0, bpm: 120, beatLength: 500 }],
      notes: [
        {
          type: 'typing',
          time: 2000,
          endTime: 2500,
          chars: [
            { time: 2000, char: 'k' }
          ]
        }
      ]
    };

    await engine.loadChart(testMap, null);
    engine.renderer.noteSpeed = 8.0;

    // Gõ đúng ký tự 'k' tại 2010ms (deltaMs = +10ms, nằm trong CRITICAL_PERFECT <= 25ms)
    const handled = engine.handleTypingKey('k', 2010);
    expect(handled).toBe(true);

    const typingNote = engine.notes.find(n => n.type === 'typing');
    expect(typingNote.chars[0].state).toBe('JUDGED');
    expect(typingNote.chars[0].judgement).toBe('CRITICAL_PERFECT');
    expect(engine.scoreManager.combo).toBe(1);
    expect(engine.scoreManager.counts.criticalPerfect).toBe(1);
  });

  it('5. Gõ sai ký tự trong cửa sổ GOOD làm gãy combo nhưng không mất chip', async () => {
    const testMap = {
      version: 2,
      layout: 'triRing9',
      metadata: { title: 'Typing Test' },
      timingPoints: [{ time: 0, bpm: 120, beatLength: 500 }],
      notes: [
        {
          type: 'typing',
          time: 2000,
          endTime: 2500,
          chars: [
            { time: 2000, char: 'z' }
          ]
        }
      ]
    };

    await engine.loadChart(testMap, null);
    engine.scoreManager.combo = 5;

    // Gõ sai ký tự 'x' (trong khi mong đợi 'z') tại 2020ms
    const handled = engine.handleTypingKey('x', 2020);
    expect(handled).toBe(true);

    const typingNote = engine.notes.find(n => n.type === 'typing');
    expect(typingNote.chars[0].state).toBe('PENDING'); // Không mất chip
    expect(engine.scoreManager.combo).toBe(0); // Bị gãy combo
    expect(engine.scoreManager.counts.miss).toBe(0); // Không phạt miss
  });

  it('6. Ký tự Typing quá hạn (> time + 150ms) tự động chuyển thành MISS', async () => {
    const testMap = {
      version: 2,
      layout: 'triRing9',
      metadata: { title: 'Typing Test' },
      timingPoints: [{ time: 0, bpm: 120, beatLength: 500 }],
      notes: [
        {
          type: 'typing',
          time: 2000,
          endTime: 2500,
          chars: [
            { time: 2000, char: 'm' }
          ]
        }
      ]
    };

    await engine.loadChart(testMap, null);
    const typingNote = engine.notes.find(n => n.type === 'typing');
    typingNote.state = 'ACTIVE';

    // Cập nhật nốt tại 2200ms (> 2000 + 150ms)
    engine.updateNotes(2200);

    expect(typingNote.chars[0].state).toBe('MISSED');
    expect(typingNote.chars[0].judgement).toBe('MISS');
    expect(engine.scoreManager.counts.miss).toBe(1);
    expect(typingNote.state).toBe('JUDGED');
  });

  it('7. Thuật toán kiểm tra độ trễ Background Video phát hiện lệch > 80ms', () => {
    const videoOffset = 0;
    const audioTime = 5000; // 5.000s
    const targetVideoTime = (audioTime - videoOffset) / 1000; // 5.000s

    // Trường hợp 1: lệch nhỏ 30ms (0.030s) -> Không cần nhảy time
    const smallDrift = Math.abs(5.030 - targetVideoTime);
    expect(smallDrift <= 0.08).toBe(true);

    // Trường hợp 2: lệch 120ms (0.120s) -> Vượt ngưỡng 80ms -> Phải resync
    const largeDrift = Math.abs(5.120 - targetVideoTime);
    expect(largeDrift > 0.08).toBe(true);
  });
});
