import { describe, it, expect } from 'vitest';
import { ScoreManager } from '../src/core/engine/scoreManager.js';

function playAll(manager, notes, judgement, noteType) {
  for (const note of notes) {
    manager.registerJudgement(judgement, noteType || note.type || 'tap', 0);
  }
}

describe('ScoreManager - điểm arcade & summary', () => {
  it('All Critical Perfect không có Break đạt 100% => 1.000.000 điểm', () => {
    const manager = new ScoreManager();
    const notes = [
      { type: 'tap', time: 0, lane: 0 },
      { type: 'tap', time: 500, lane: 1 },
      { type: 'hold', time: 1000, endTime: 1500, lane: 2 }
    ];
    manager.initChart(notes);
    playAll(manager, notes, 'CRITICAL_PERFECT');

    const summary = manager.getSummary();
    expect(summary.achievement).toBe(100);
    expect(summary.score).toBe(1000000);
    expect(summary.rank).toBe('SSS');
    expect(summary.flags.isAP).toBe(true);
    expect(summary.flags.isFC).toBe(true);
  });

  it('Break Critical Perfect cộng bonus tối đa 1% => 1.010.000 điểm', () => {
    const manager = new ScoreManager();
    const notes = [
      { type: 'tap', time: 0, lane: 0 },
      { type: 'break', time: 500, lane: 1 }
    ];
    manager.initChart(notes);
    playAll(manager, notes, 'CRITICAL_PERFECT');

    const summary = manager.getSummary();
    expect(summary.achievement).toBeCloseTo(101, 4);
    expect(summary.score).toBe(1010000);
  });

  it('Miss toàn bộ => 0% và 0 điểm', () => {
    const manager = new ScoreManager();
    const notes = [{ type: 'tap', time: 0, lane: 0 }];
    manager.initChart(notes);
    playAll(manager, notes, 'MISS');

    const summary = manager.getSummary();
    expect(summary.achievement).toBe(0);
    expect(summary.score).toBe(0);
    expect(summary.maxCombo).toBe(0);
    expect(summary.flags.isAP).toBe(false);
    expect(summary.flags.isFC).toBe(false);
  });

  it('score luôn bằng achievement * 10000 (làm tròn)', () => {
    const manager = new ScoreManager();
    const notes = [
      { type: 'tap', time: 0, lane: 0 },
      { type: 'tap', time: 500, lane: 1 },
      { type: 'tap', time: 1000, lane: 2 },
      { type: 'tap', time: 1500, lane: 3 }
    ];
    manager.initChart(notes);
    manager.registerJudgement('CRITICAL_PERFECT', 'tap', 0);
    manager.registerJudgement('PERFECT', 'tap', 12);
    manager.registerJudgement('GREAT', 'tap', 45);
    manager.registerJudgement('GOOD', 'tap', 90);

    const summary = manager.getSummary();
    expect(summary.score).toBe(Math.round(summary.achievement * 10000));
    expect(manager.getScoreValue()).toBe(summary.score);
  });

  it('reset đưa điểm và summary về 0', () => {
    const manager = new ScoreManager();
    manager.initChart([{ type: 'tap', time: 0, lane: 0 }]);
    manager.registerJudgement('CRITICAL_PERFECT', 'tap', 0);
    expect(manager.getSummary().score).toBe(1000000);

    manager.reset();
    const summary = manager.getSummary();
    expect(summary.score).toBe(0);
    expect(summary.achievement).toBe(0);
    expect(summary.maxCombo).toBe(0);
  });
});
