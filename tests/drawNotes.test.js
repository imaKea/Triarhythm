import { describe, expect, it } from 'vitest';
import { drawNotes } from '../src/core/engine/renderers/drawNotes.js';

function createContext() {
  const strokes = [];
  const fills = [];
  return {
    strokes,
    fills,
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    quadraticCurveTo() {},
    closePath() {},
    stroke() {
      strokes.push(this.strokeStyle);
    },
    fill() {
      fills.push(this.fillStyle);
    }
  };
}

describe('Ring hold note colors', () => {
  const note = { type: 'ring', isHold: true, time: 1000, endTime: 2000 };

  it('draws the approaching hold ring in green', () => {
    const ctx = createContext();

    drawNotes({ ctx, noteRadiusScale: 1 }, [note], 500, 1000, 1, 800, 600);

    expect(ctx.strokes).toContain('#00e676');
    expect(ctx.strokes).toContain('rgba(0, 230, 118, 0.35)');
    expect(ctx.strokes).not.toContain('#8fd0f5');
  });

  it('draws the hold body and tail in green while held', () => {
    const ctx = createContext();

    drawNotes({ ctx, noteRadiusScale: 1 }, [note], 1500, 1000, 1, 800, 600);

    expect(ctx.strokes).toContain('#00e676');
    expect(ctx.fills).toContain('rgba(0, 230, 118, 0.25)');
  });
});
