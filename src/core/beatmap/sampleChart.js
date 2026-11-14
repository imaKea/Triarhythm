/**
 * Beatmap mẫu chuẩn (Demo / Tutorial Chart)
 * Đạt chuẩn Version 2, tuân thủ tất cả ràng buộc schema và gameplay.
 */

export const SAMPLE_BEATMAP = {
  version: 2,
  layout: 'triRing9',
  metadata: {
    id: 'sample-beyond-tutorial',
    title: 'Neon Odyssey',
    artist: 'Triarhythm Studio',
    creator: 'Antigravity',
    creatorUid: 'sys-antigravity',
    difficultyName: 'Standard',
    stars: 3.5,
    previewTime: 4000,
    source: 'manual',
    tags: ['tutorial', 'neon', 'cyber', 'demo']
  },
  assets: {
    audio: 'audio.ogg',
    background: 'bg.jpg',
    video: null,
    videoOffset: 0,
    hitsounds: {
      normal: 'soft-hitnormal.wav'
    }
  },
  settings: {
    noteSpeed: 8.0,
    audioLeadIn: 500
  },
  timingPoints: [
    {
      time: 0,
      bpm: 240,
      beatLength: 250,
      meter: 4,
      uninherited: true,
      volume: 90,
      sampleSet: 'soft'
    }
  ],
  notes: [
    // 1. Chuỗi Tap khởi động trên các cạnh
    { type: 'tap', time: 1000, lane: 0 },
    { type: 'tap', time: 1250, lane: 1 },
    { type: 'tap', time: 1500, lane: 2 },
    { type: 'tap', time: 2000, lane: 3 },
    { type: 'tap', time: 2250, lane: 4 },
    { type: 'tap', time: 2500, lane: 5 },

    // 2. Hold note trên lane 7
    { type: 'hold', time: 3000, endTime: 4000, lane: 7 },

    // 3. Break note điểm thưởng trên lane 8
    { type: 'break', time: 4500, lane: 8 },

    // 4. Note Ring to bằng cả outline từ tâm nở ra (bấm phím SPACE)
    {
      type: 'ring',
      time: 5500
    },

    // 5. Typing Section (gõ "neon" theo nhịp)
    // Cách slide trước ít nhất 300ms (slide 5500 + wait 250 + glide 2*500 = 6750ms -> 8000ms là an toàn)
    {
      type: 'typing',
      time: 8000,
      endTime: 9500,
      chars: [
        { time: 8000, char: 'n' },
        { time: 8500, char: 'e' },
        { time: 9000, char: 'o' },
        { time: 9500, char: 'n' }
      ]
    },

    // 6. Kết bài với cặp nốt cùng lúc
    { type: 'tap', time: 11000, lane: 0 },
    { type: 'tap', time: 11000, lane: 2 }
  ]
};

export default SAMPLE_BEATMAP;
