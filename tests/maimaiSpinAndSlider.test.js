import { describe, it, expect, beforeEach } from 'vitest';
import { parseMaimai } from '../src/core/parser/maimaiParser.js';
import { GameEngine } from '../src/core/engine/gameEngine.js';
import { GameplayRenderer } from '../src/core/engine/gameplayRenderer.js';

describe('Maimai Slider & Spin Assist & Ring Speed Tests', () => {
  describe('1. Maimai Slider Conversion', () => {
    it('converts maimai slider to a normal tap note at start and NO ring note at slider end', () => {
      // BPM 120 -> 1 beat = 500ms
      // 1-5[2:1] starts at time 0 on Button 1 (Lane 2), duration = 2 beats = 1000ms
      const maidata = `
&title=Slider Test
&artist=Artist
&first=0
&lv_4=12
&inote_4=(120){2}1-5[2:1],,E
`;
      const res = parseMaimai(maidata);
      const notes = res.difficulties[0].beatmap.notes;

      // At start (time = 0):
      // Must be a normal tap note on Lane 2 (Button 1)
      const startTap = notes.find((n) => n.time === 0 && n.lane === 2);
      expect(startTap).toBeDefined();
      expect(startTap.type).toBe('tap');

      // MUST NOT have a ring note at time = 0
      const ringAtStart = notes.find((n) => n.time === 0 && n.type === 'ring');
      expect(ringAtStart).toBeUndefined();

      // At slider end (time = 1000):
      // MUST NOT have a ring note (sliders become normal tap/break only, ring notes only from touch)
      const ringAtEnd = notes.find((n) => n.time === 1000 && n.type === 'ring');
      expect(ringAtEnd).toBeUndefined();
    });

    it('preserves break property on the starting tap note for break slides and no ring note at end', () => {
      // 1b-5[2:1] has break flag 'b'
      const maidata = `
&title=Break Slider Test
&artist=Artist
&first=0
&lv_4=12
&inote_4=(120){2}1b-5[2:1],,E
`;
      const res = parseMaimai(maidata);
      const notes = res.difficulties[0].beatmap.notes;

      const startBreak = notes.find((n) => n.time === 0 && n.lane === 2);
      expect(startBreak).toBeDefined();
      expect(startBreak.type).toBe('break');

      const ringAtEnd = notes.find((n) => n.time === 1000 && n.type === 'ring');
      expect(ringAtEnd).toBeUndefined();
    });
  });

  describe('2. Ring Note Speed Setting', () => {
    it('computes distinct travel times for noteSpeed and ringNoteSpeed', () => {
      const canvas = { getContext: () => ({}) };
      const renderer = new GameplayRenderer(canvas);

      renderer.noteSpeed = 10.0;
      renderer.ringNoteSpeed = 5.0;

      const standardTravel = renderer.getTravelTime();
      const ringTravel = renderer.getRingTravelTime();

      // NS 10.0 = 450ms, NS 5.0 = 1200ms
      expect(standardTravel).toBe(450);
      expect(ringTravel).toBe(1200);
      expect(ringTravel).toBeGreaterThan(standardTravel);
    });

    it('falls back to noteSpeed if ringNoteSpeed is unset', () => {
      const canvas = { getContext: () => ({}) };
      const renderer = new GameplayRenderer(canvas);

      renderer.noteSpeed = 12.0;
      renderer.ringNoteSpeed = null;

      expect(renderer.getRingTravelTime()).toBe(renderer.getTravelTime(12.0));
    });
  });

  describe('3. Maimai Spin Assist on Middle Keys 6 & 7', () => {
    let engine;
    const dummyCanvas = {
      width: 800,
      height: 600,
      getContext: () => ({
        save: () => {},
        restore: () => {},
        clearRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        moveTo: () => {},
        lineTo: () => {},
        rect: () => {}
      })
    };

    beforeEach(() => {
      engine = new GameEngine(dummyCanvas);
    });

    it('in Maimai charts: Key 6 activates Lane 0 (nút 5) and Key 7 activates Lane 2 (nút 8)', async () => {
      const maimaiBeatmap = {
        metadata: { source: 'maimai', title: 'Spin Test' },
        timingPoints: [{ bpm: 120, beatLength: 500 }],
        notes: [
          { time: 1000, lane: 0, type: 'tap' }, // Note on Lane 0 (Key 5)
          { time: 2000, lane: 2, type: 'tap' }  // Note on Lane 2 (Key 8)
        ]
      };

      await engine.loadChart(maimaiBeatmap);
      expect(engine.isMaimaiChart).toBe(true);

      // Player presses Key 6 (Digit6) at time 1000ms
      // Middle key 6 triggers Lane 0 where the note is located
      engine.handleLaneDown(1, 1000, 1000, 'Digit6');

      const note0 = engine.notes.find((n) => n.lane === 0);
      expect(note0.state).toBe('JUDGED');

      // Player presses Key 7 (Digit7) at time 2000ms
      // Middle key 7 triggers Lane 2 where the note is located
      engine.handleLaneDown(1, 2000, 2000, 'Digit7');

      const note2 = engine.notes.find((n) => n.lane === 2);
      expect(note2.state).toBe('JUDGED');
    });

    it('in osu! charts: middle keys 6 & 7 trigger Lane 1 only (keeps osu! behaviour)', async () => {
      const osuBeatmap = {
        metadata: { source: 'osu', title: 'Osu 7K Track' },
        timingPoints: [{ bpm: 120, beatLength: 500 }],
        notes: [
          { time: 1000, lane: 0, type: 'tap' },
          { time: 1000, lane: 1, type: 'tap' } // Note on Lane 1
        ]
      };

      await engine.loadChart(osuBeatmap);
      expect(engine.isMaimaiChart).toBe(false);

      // In osu, pressing Key 6 on Lane 1 targets Lane 1, does NOT redirect to Lane 0
      engine.handleLaneDown(1, 1000, 1000, 'Digit6');

      const note1 = engine.notes.find((n) => n.lane === 1);
      const note0 = engine.notes.find((n) => n.lane === 0);

      expect(note1.state).toBe('JUDGED');
      expect(note0.state).toBe('PENDING'); // Lane 0 was not triggered
    });

    it('respects maimaiSpinAssist: false setting in Maimai charts', async () => {
      const maimaiBeatmap = {
        metadata: { source: 'maimai', title: 'Spin Disabled Test' },
        timingPoints: [{ bpm: 120, beatLength: 500 }],
        notes: [
          { time: 1000, lane: 0, type: 'tap' }
        ]
      };

      await engine.loadChart(maimaiBeatmap);
      engine.maimaiSpinAssist = false; // Player explicitly disabled spin assist

      engine.handleLaneDown(1, 1000, 1000, 'Digit6');

      const note0 = engine.notes.find((n) => n.lane === 0);
      expect(note0.state).toBe('PENDING'); // Did not trigger Lane 0
    });
  });

  describe('4. Ring Note Any-Key Holding Support', () => {
    let engine;
    const dummyCanvas = {
      width: 800,
      height: 600,
      getContext: () => ({
        save: () => {},
        restore: () => {},
        clearRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        fillRect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 0 })
      })
    };

    beforeEach(() => {
      engine = new GameEngine(dummyCanvas);
    });

    it('judges Ring tap notes when holding any key on keyboard (not just Space)', async () => {
      const beatmap = {
        metadata: { title: 'Ring Any Key Test' },
        timingPoints: [{ bpm: 120, beatLength: 500 }],
        notes: [
          { time: 500, type: 'ring' }
        ]
      };
      await engine.loadChart(beatmap);
      engine.isRunning = true;

      // Press down 'KeyF' (or any key)
      engine.inputManager.heldKeyCodes.add('KeyF');
      expect(engine.isRingHolding()).toBe(true);

      // Advance game loop into hit window
      engine.updateNotes(500);

      const ringNote = engine.notes.find((n) => n.type === 'ring');
      expect(ringNote.state).toBe('JUDGED');
      expect(engine.scoreManager.combo).toBe(1);
    });

    it('maintains Ring Hold notes when holding any key on keyboard', async () => {
      const beatmap = {
        metadata: { title: 'Ring Hold Any Key Test' },
        timingPoints: [{ bpm: 120, beatLength: 500 }],
        notes: [
          { time: 500, endTime: 1500, type: 'ring', isHold: true }
        ]
      };
      await engine.loadChart(beatmap);
      engine.isRunning = true;

      // Press any key (e.g. KeyJ)
      engine.inputManager.heldKeyCodes.add('KeyJ');
      expect(engine.isRingHolding()).toBe(true);

      // Advance through start of hold
      engine.updateNotes(500);
      const ringHold = engine.notes.find((n) => n.type === 'ring');
      expect(ringHold.headJudged).toBe(true);
      expect(ringHold.isHolding).toBe(true);

      // Continue holding to end
      engine.updateNotes(1500);
      expect(ringHold.tailJudged).toBe(true);
      expect(ringHold.state).toBe('JUDGED');
    });
  });
});
