import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { exportBeatmapFile, buildMaimaiText } from '../src/core/parser/exportService.js';
import { parseMaimai } from '../src/core/parser/maimaiParser.js';

describe('beatmap export service', () => {
  it('wraps stored maimai maidata in a zip package', async () => {
    const sourceText = '&title=Stored Song\n&inote_1=8,7,E\n';
    const result = await exportBeatmapFile({
      source: 'maimai',
      title: 'Stored Song',
      sourceText
    });
    const zip = await JSZip.loadAsync(result.blob);

    expect(result.filename).toBe('Stored Song.zip');
    expect(await zip.file('maidata.txt').async('text')).toBe(sourceText);
  });

  it('preserves every file in a stored maimai package', async () => {
    const sourceText = '&title=Packaged Song\n&inote_1=8,E\n';
    const zip = new JSZip();
    zip.file('charts/maidata.txt', sourceText);
    zip.file('movie/pv.mp4', 'video bytes');
    zip.file('jacket/cover.png', 'image bytes');
    const sourcePackageBlob = await zip.generateAsync({ type: 'blob' });

    const result = await exportBeatmapFile({
      source: 'maimai',
      title: 'Packaged Song',
      sourceFileName: 'original-package.zip',
      sourcePackageBlob
    });
    const output = await JSZip.loadAsync(result.blob);

    expect(result.filename).toBe('original-package.zip');
    expect(await output.file('charts/maidata.txt').async('text')).toBe(sourceText);
    expect(await output.file('movie/pv.mp4').async('text')).toBe('video bytes');
    expect(await output.file('jacket/cover.png').async('text')).toBe('image bytes');
  });

  it('generates maidata from all playable chart notes when source text is unavailable', () => {
    const entry = {
      source: 'maimai',
      title: 'Generated Song',
      artist: 'Mapper',
      difficulties: [{
        difficultyName: 'Basic',
        difficultyLevel: '3',
        beatmap: {
          metadata: { creator: 'Mapper', difficultyName: 'Basic' },
          notes: [
            { type: 'tap', time: 0, lane: 0 },
            { type: 'break', time: 500, lane: 2 },
            { type: 'hold', time: 1000, endTime: 1500, lane: 3 },
            { type: 'ring', time: 1500 },
            { type: 'ring', time: 2000, endTime: 2500, isHold: true }
          ]
        }
      }]
    };

    const parsed = parseMaimai(buildMaimaiText(entry));
    const notes = parsed.difficulties[0].beatmap.notes;

    expect(notes.map((note) => [note.type, note.time])).toEqual([
      ['tap', 0],
      ['break', 500],
      ['hold', 1000],
      ['ring', 1500],
      ['ring', 2000]
    ]);
    expect(notes[4].endTime).toBe(2500);
  });

  it('creates a playable osu package from a Triarhythm chart', async () => {
    const result = await exportBeatmapFile({
      source: 'osu',
      title: 'Generated Song',
      difficulties: [{
        difficultyName: 'Expert',
        beatmap: {
          metadata: { title: 'Generated Song', artist: 'Mapper', creator: 'Mapper' },
          assets: { audio: 'audio.ogg' },
          settings: { audioLeadIn: 100 },
          timingPoints: [{ time: 0, beatLength: 500, bpm: 120, meter: 4, uninherited: true }],
          notes: [
            { type: 'tap', time: 500, lane: 0 },
            { type: 'hold', time: 1000, endTime: 1600, lane: 8 },
            { type: 'ring', time: 2000 }
          ]
        }
      }],
      audioBlob: new Blob(['audio'], { type: 'audio/ogg' })
    });
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const osuPath = Object.keys(zip.files).find((path) => path.endsWith('.osu'));
    const osuText = await zip.file(osuPath).async('text');

    expect(result.filename).toBe('Generated Song.osz');
    expect(zip.file('audio.ogg')).toBeTruthy();
    expect(osuText).toContain('Mode: 3');
    expect(osuText).toContain('CircleSize:10');
    expect(osuText).toContain('[HitObjects]');
    expect(osuText).toContain(',128,0,');
  });

  it('preserves a stored osu package when exporting it as .osz', async () => {
    const zip = new JSZip();
    zip.file('original.osu', 'original chart');
    const sourcePackageBlob = await zip.generateAsync({ type: 'blob' });
    const result = await exportBeatmapFile({
      source: 'osu',
      title: 'Original Song',
      sourcePackageBlob
    });

    expect(result.filename).toBe('Original Song.osz');
    const output = await JSZip.loadAsync(result.blob);
    expect(await output.file('original.osu').async('text')).toBe('original chart');
  });
});
