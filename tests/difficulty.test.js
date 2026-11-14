import { describe, expect, it } from 'vitest';
import { resolveDifficultyBeatmap } from '../src/core/beatmap/difficulty.js';

describe('resolveDifficultyBeatmap', () => {
  it('uses the selected difficulty chart instead of the song-level chart', () => {
    const selectedChart = { notes: [{ type: 'tap', time: 100, lane: 0 }] };
    const song = {
      beatmap: { notes: [{ type: 'tap', time: 100, lane: 0 }, { type: 'tap', time: 200, lane: 1 }] },
      difficulties: [
        { difficultyName: 'Easy', beatmap: { notes: [{ type: 'tap', time: 50, lane: 2 }] } },
        { difficultyName: 'Hard', beatmap: selectedChart }
      ]
    };

    expect(resolveDifficultyBeatmap(song, song.difficulties[1])).toBe(selectedChart);
  });

  it('supports difficulty entries that are beatmaps themselves', () => {
    const selectedChart = { metadata: { difficultyName: 'Hard' }, notes: [{ type: 'tap', time: 50, lane: 2 }] };
    const song = { beatmap: { notes: [] }, difficulties: [selectedChart] };

    expect(resolveDifficultyBeatmap(song, selectedChart)).toBe(selectedChart);
  });

  it('does not fall back to the song-level chart when a multi-difficulty entry is invalid', () => {
    const song = {
      beatmap: { notes: [{ type: 'tap', time: 100, lane: 0 }] },
      difficulties: [{ difficultyName: 'Easy' }, { difficultyName: 'Hard' }]
    };

    expect(resolveDifficultyBeatmap(song, song.difficulties[1])).toBeNull();
  });

  it('uses the song-level chart for a single-difficulty map', () => {
    const chart = { notes: [{ type: 'tap', time: 100, lane: 0 }] };
    const song = { beatmap: chart, difficulties: [{ difficultyName: 'Normal' }] };

    expect(resolveDifficultyBeatmap(song, song.difficulties[0])).toBe(chart);
  });
});
