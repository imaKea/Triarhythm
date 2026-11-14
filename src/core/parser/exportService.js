import JSZip from 'jszip';

const MAIMAI_LANE = {
  0: '8',
  2: '1',
  3: '7',
  4: '6',
  5: '5',
  6: '2',
  7: '3',
  8: '4'
};

const MAIMAI_DIFFICULTIES = {
  basic: 1,
  advanced: 2,
  expert: 3,
  master: 4,
  're:master': 5,
  remaster: 5,
  utage: 6
};

function getSource(entry) {
  return entry?.source || entry?.beatmap?.metadata?.source || '';
}

function getCharts(entry) {
  const charts = (entry?.difficulties || [])
    .map((difficulty) => ({
      ...difficulty,
      beatmap: difficulty.beatmap || difficulty
    }))
    .filter((difficulty) => Array.isArray(difficulty.beatmap?.notes));

  if (charts.length) return charts;
  if (Array.isArray(entry?.beatmap?.notes)) {
    return [{
      difficultyName: entry.difficultyName || entry.beatmap.metadata?.difficultyName || 'Normal',
      difficultyLevel: entry.difficultyLevel || entry.beatmap.metadata?.difficultyLevel || '5',
      beatmap: entry.beatmap
    }];
  }
  throw new Error('Không tìm thấy chart hợp lệ để xuất.');
}

function safeFilename(value, fallback) {
  return String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim() || fallback;
}

function archivePath(value, fallback) {
  const parts = String(value || fallback).replace(/\\/g, '/').split('/');
  const safeParts = parts.filter((part) => part && part !== '.' && part !== '..');
  return safeParts.join('/') || fallback;
}

function formatNumber(value, decimals = 3) {
  return Number(Number(value || 0).toFixed(decimals)).toString();
}

function getMaimaiLane(note) {
  const lane = Number(note.lane);
  const button = MAIMAI_LANE[lane];
  if (!button) {
    throw new Error(`Lane ${note.lane} không thể biểu diễn bằng chart maimai.`);
  }
  return button;
}

function maimaiToken(note) {
  const time = Math.max(0, Number(note.time) || 0);
  const endTime = Number(note.endTime);
  const isHold = Number.isFinite(endTime) && endTime > time;

  if (note.type === 'ring') {
    return note.isHold && isHold
      ? `Ch[${formatNumber((endTime - time) / 1000)}]`
      : 'C';
  }

  const lane = getMaimaiLane(note);
  if (note.type === 'tap' || note.type === 'break') {
    return `${lane}${note.type === 'break' ? 'b' : ''}`;
  }
  if (note.type === 'hold' || note.type === 'tapHold' || note.type === 'breakHold') {
    if (!isHold) return `${lane}${note.type === 'breakHold' || note.isBreakHold ? 'b' : ''}`;
    const isBreak = note.type === 'breakHold' || Boolean(note.isBreakHold);
    return `${lane}${isBreak ? 'b' : ''}h[${formatNumber((endTime - time) / 1000)}]`;
  }

  throw new Error(`Loại note "${note.type}" chưa hỗ trợ xuất sang maimai.`);
}

function difficultyIndex(name, used) {
  const knownIndex = MAIMAI_DIFFICULTIES[String(name || '').toLowerCase()];
  if (knownIndex && !used.has(knownIndex)) return knownIndex;
  for (let index = 1; index <= 6; index += 1) {
    if (!used.has(index)) return index;
  }
  throw new Error('maidata.txt chỉ hỗ trợ tối đa 6 độ khó trong bản xuất này.');
}

export function buildMaimaiText(entry) {
  const charts = getCharts(entry);
  const usedIndexes = new Set();
  const lines = [
    `&title=${String(entry.title || charts[0].beatmap.metadata?.title || 'Untitled').replace(/[\r\n&]/g, ' ')}`,
    `&artist=${String(entry.artist || charts[0].beatmap.metadata?.artist || 'Unknown Artist').replace(/[\r\n&]/g, ' ')}`,
    '&first=0'
  ];

  charts.forEach((chart) => {
    const name = chart.difficultyName || chart.beatmap.metadata?.difficultyName || 'Normal';
    const index = difficultyIndex(name, usedIndexes);
    usedIndexes.add(index);
    const noteGroups = new Map();
    for (const note of chart.beatmap.notes) {
      const time = Math.max(0, Math.round(Number(note.time) || 0));
      const group = noteGroups.get(time) || [];
      group.push(maimaiToken(note));
      noteGroups.set(time, group);
    }

    const times = [...noteGroups.keys()].sort((a, b) => a - b);
    let previousTime = 0;
    let inote = '';
    for (const time of times) {
      const gap = time - previousTime;
      if (gap > 0) inote += `(${formatNumber(60000 / gap, 5)}){4},`;
      inote += noteGroups.get(time).join('/');
      previousTime = time;
    }
    inote += 'E';

    const mapper = chart.beatmap.metadata?.creator || entry.creator || 'Triarhythm';
    const level = chart.difficultyLevel || chart.beatmap.metadata?.difficultyLevel || chart.beatmap.metadata?.stars || '5';
    lines.push(
      `&des_${index}=${String(mapper).replace(/[\r\n&]/g, ' ')}`,
      `&lv_${index}=${String(level).replace(/[\r\n&]/g, ' ')}`,
      `&inote_${index}=${inote}`
    );
  });

  return `${lines.join('\n')}\n`;
}

function osuMetadataLine(value) {
  return String(value || '').replace(/[,\r\n]/g, ' ');
}

function writeOsuChart(beatmap, difficultyName, audioFilename) {
  const metadata = beatmap.metadata || {};
  const timingPoints = Array.isArray(beatmap.timingPoints) && beatmap.timingPoints.length
    ? beatmap.timingPoints
    : [{ time: 0, beatLength: 500, bpm: 120, meter: 4, uninherited: true }];
  const timingLines = timingPoints.map((point) => {
    const beatLength = Number(point.beatLength) > 0
      ? Number(point.beatLength)
      : 60000 / (Number(point.bpm) || 120);
    const sampleSet = point.sampleSet === 'soft' ? 2 : point.sampleSet === 'drum' ? 3 : 1;
    return [
      Math.round(Number(point.time) || 0),
      formatNumber(beatLength, 6),
      Number(point.meter) || 4,
      sampleSet,
      Number(point.sampleIndex) || 0,
      Number(point.volume) || 100,
      point.uninherited === false ? 0 : 1,
      Number(point.effects) || 0
    ].join(',');
  });

  const hitObjects = beatmap.notes.map((note) => {
    const isRing = note.type === 'ring';
    const lane = isRing ? 9 : Math.max(0, Math.min(8, Number(note.lane) || 0));
    const x = Math.min(511, Math.floor(((lane + 0.5) / 10) * 512));
    const time = Math.max(0, Math.round(Number(note.time) || 0));
    const endTime = Number(note.endTime);
    const isHold = Number.isFinite(endTime) && endTime > time;
    const type = isHold || note.type === 'tapHold' || note.type === 'breakHold' ? 128 : 1;
    const hitSound = note.type === 'break' || note.type === 'breakHold' || note.isBreakHold ? 2 : 0;
    return isHold
      ? `${x},192,${time},${type},${hitSound},${Math.round(endTime)}:0:0:0:`
      : `${x},192,${time},${type},${hitSound},0:0:0:0:`;
  }).sort((a, b) => Number(a.split(',')[2]) - Number(b.split(',')[2]));

  const background = beatmap.assets?.background;
  const video = beatmap.assets?.video;
  const events = [
    ...(background ? [`0,0,"${archivePath(background, 'bg.jpg')}",0,0`] : []),
    ...(video ? [`Video,${Math.round(Number(beatmap.assets.videoOffset) || 0)},"${archivePath(video, 'video.mp4')}"`] : [])
  ];
  return [
    'osu file format v14',
    '',
    '[General]',
    `AudioFilename: ${audioFilename}`,
    `AudioLeadIn: ${Math.max(0, Math.round(Number(beatmap.settings?.audioLeadIn) || 0))}`,
    `PreviewTime: ${Math.max(0, Math.round(Number(metadata.previewTime) || 0))}`,
    'Mode: 3',
    '',
    '[Metadata]',
    `Title:${osuMetadataLine(metadata.title)}`,
    `TitleUnicode:${osuMetadataLine(metadata.title)}`,
    `Artist:${osuMetadataLine(metadata.artist)}`,
    `ArtistUnicode:${osuMetadataLine(metadata.artist)}`,
    `Creator:${osuMetadataLine(metadata.creator) || 'Triarhythm'}`,
    `Version:${osuMetadataLine(difficultyName) || 'Normal'}`,
    `BeatmapID:${metadata.beatmapId || 0}`,
    `BeatmapSetID:${metadata.beatmapSetId || -1}`,
    '',
    '[Difficulty]',
    'HPDrainRate:5',
    'CircleSize:10',
    'OverallDifficulty:8',
    'ApproachRate:5',
    'SliderMultiplier:1.4',
    'SliderTickRate:1',
    '',
    '[Events]',
    ...events,
    '',
    '[TimingPoints]',
    ...timingLines,
    '',
    '[HitObjects]',
    ...hitObjects,
    ''
  ].join('\n');
}

function addBlob(zip, path, blob) {
  if (blob && typeof blob.arrayBuffer === 'function') zip.file(path, blob);
}

async function buildOsuPackage(entry) {
  if (entry.sourcePackageBlob) return entry.sourcePackageBlob;

  const zip = new JSZip();
  const charts = getCharts(entry);
  const firstBeatmap = charts[0].beatmap;
  const originalOsu = typeof entry.sourceText === 'string'
    && /\.osu$/i.test(entry.sourceFileName || '');

  if (originalOsu) {
    zip.file(archivePath(entry.sourceFileName, 'map.osu'), entry.sourceText);
    const audioPath = archivePath(firstBeatmap.assets?.audio, 'audio.ogg');
    const backgroundPath = archivePath(firstBeatmap.assets?.background, 'bg.jpg');
    const videoPath = archivePath(firstBeatmap.assets?.video, 'video.mp4');
    addBlob(zip, audioPath, entry.audioBlob);
    addBlob(zip, backgroundPath, entry.backgroundBlob);
    addBlob(zip, videoPath, entry.videoBlob);
    for (const [name, blob] of Object.entries(entry.hitsounds || {})) {
      addBlob(zip, archivePath(name, 'hitsound.wav'), blob);
    }
  } else {
    const audioFilename = archivePath(firstBeatmap.assets?.audio, 'audio.ogg').split('/').pop();
    for (const chart of charts) {
      const beatmap = chart.beatmap;
      const difficultyName = chart.difficultyName || beatmap.metadata?.difficultyName || 'Normal';
      const filename = `${safeFilename(entry.title || beatmap.metadata?.title, 'triarhythm')}-${safeFilename(difficultyName, 'Normal')}.osu`;
      zip.file(filename, writeOsuChart(beatmap, difficultyName, audioFilename));
    }
    addBlob(zip, audioFilename, entry.audioBlob);
    if (firstBeatmap.assets?.background) {
      addBlob(zip, archivePath(firstBeatmap.assets.background, 'bg.jpg'), entry.backgroundBlob);
    }
    if (firstBeatmap.assets?.video) {
      addBlob(zip, archivePath(firstBeatmap.assets.video, 'video.mp4'), entry.videoBlob);
    }
    for (const [name, blob] of Object.entries(entry.hitsounds || {})) {
      addBlob(zip, archivePath(name, 'hitsound.wav'), blob);
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

function exportFilename(entry, extension) {
  return `${safeFilename(entry.title || entry.beatmap?.metadata?.title, 'triarhythm-map')}.${extension}`;
}

function maimaiPackageFilename(entry) {
  const sourceFilename = String(entry.sourceFileName || '').split(/[\\/]/).pop();
  const stem = /\.(osz|zip)$/i.test(sourceFilename)
    ? sourceFilename.replace(/\.(osz|zip)$/i, '')
    : entry.title;
  return `${safeFilename(stem || entry.title, 'triarhythm-map')}.zip`;
}

async function buildMaimaiPackage(entry) {
  if (entry.sourcePackageBlob) return entry.sourcePackageBlob;

  const zip = new JSZip();
  zip.file('maidata.txt', typeof entry.sourceText === 'string'
    ? entry.sourceText
    : buildMaimaiText(entry));
  const firstBeatmap = entry.beatmap || entry.difficulties?.[0]?.beatmap || {};
  addBlob(zip, archivePath(firstBeatmap.assets?.audio, 'track.mp3'), entry.audioBlob);
  addBlob(zip, archivePath(firstBeatmap.assets?.background, 'bg.jpg'), entry.backgroundBlob);
  addBlob(zip, archivePath(firstBeatmap.assets?.video, 'pv.mp4'), entry.videoBlob);
  for (const [name, blob] of Object.entries(entry.hitsounds || {})) {
    addBlob(zip, archivePath(name, 'hitsound.wav'), blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function exportBeatmapFile(entry) {
  const source = getSource(entry);
  if (source === 'maimai') {
    return {
      filename: maimaiPackageFilename(entry),
      blob: await buildMaimaiPackage(entry)
    };
  }
  if (source === 'osu') {
    const blob = await buildOsuPackage(entry);
    return {
      filename: exportFilename(entry, 'osz'),
      blob
    };
  }
  throw new Error('Không xác định được nguồn map để chọn định dạng xuất.');
}
