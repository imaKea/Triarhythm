/**
 * AudioEngine - Quản lý âm thanh Web Audio API chính xác tới microsecond
 * Bù trừ độ trễ phần cứng (baseLatency / outputLatency) và user offset
 * Tối đa 24 voice đồng thời cho hitsound, không tạo thẻ <audio> mới
 * Tự động dự phòng nhạc thủ tục (Procedural Synth) nếu không có file mp3/ogg rời
 */

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.musicBuffer = null;
    this.musicSource = null;
    this.musicGain = null;
    this.hitsoundGain = null;

    // Quản lý thời gian và đồng bộ
    this.startTime = 0;           // audioCtx.currentTime khi nhạc bắt đầu phát
    this.startPerfTime = 0;       // performance.now() khi nhạc bắt đầu phát
    this.pausedAt = 0;            // Thời gian (giây) khi tạm dừng
    this.isPlaying = false;
    this.isPaused = false;

    // Bù trừ độ trễ
    this.userOffsetMs = 0;        // User audio offset (-200ms đến +200ms)

    // Voice pool cho hitsound (tối đa 24 voice đồng thời)
    this.maxVoices = 24;
    this.activeVoices = [];
    this.soundBank = new Map();   // name -> AudioBuffer

    // Master volume
    this.musicVolume = 0.85;
    this.hitsoundVolume = 0.95;

    this.isInitialized = false;
  }

  /**
   * Khởi tạo AudioContext khi có tương tác người dùng
   */
  async init() {
    if (!this.audioCtx) {
      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : (typeof globalThis !== 'undefined' ? (globalThis.AudioContext || globalThis.webkitAudioContext) : null);

      if (!AudioContextClass) {
        console.warn('[AudioEngine] Môi trường không hỗ trợ Web Audio API (chạy headless/test).');
        return;
      }

      this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });

      this.musicGain = this.audioCtx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.audioCtx.currentTime);
      this.musicGain.connect(this.audioCtx.destination);

      this.hitsoundGain = this.audioCtx.createGain();
      this.hitsoundGain.gain.setValueAtTime(this.hitsoundVolume, this.audioCtx.currentTime);
      this.hitsoundGain.connect(this.audioCtx.destination);

      // Tạo sẵn các hitsound thủ tục (procedural synthesis)
      this.generateDefaultProceduralSounds();

      // Nạp hitsound từ public nếu có
      this.preloadPublicHitsounds();
      this.isInitialized = true;
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  async preloadPublicHitsounds() {
    const loadFile = async (url, keys) => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const decoded = await this.decodeAudio(buf);
          for (const k of keys) {
            this.soundBank.set(k.toLowerCase(), decoded);
          }
        }
      } catch (e) {
        // Giữ âm thanh thủ tục dự phòng
      }
    };

    await Promise.all([
      loadFile('/soft-hitnormal.wav', ['soft-hitnormal.wav', 'normal']),
      loadFile('/soft-hitnormal.wav', ['ring', 'se_game_breakslide', 'soft-hitnormal.wav']),
      loadFile('/se_touchcenter.wav', ['ring-hold', 'se_game_scr_touch_center', 'se_touchcenter.wav'])
    ]);
  }

  async decodeAudio(arrayBuffer) {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {}
    }
    const copy = arrayBuffer.slice(0);
    return new Promise((resolve, reject) => {
      let settled = false;
      const onSuccess = (decoded) => {
        if (!settled) {
          settled = true;
          resolve(decoded);
        }
      };
      const onError = (err) => {
        if (!settled) {
          settled = true;
          reject(err || new Error('Không thể giải mã dữ liệu âm thanh.'));
        }
      };

      try {
        const res = this.audioCtx.decodeAudioData(copy, onSuccess, onError);
        if (res && typeof res.then === 'function') {
          res.then(onSuccess).catch(onError);
        }
      } catch (e) {
        onError(e);
      }
    });
  }

  getHardwareLatencyMs() {
    if (!this.audioCtx) return 0;
    const base = this.audioCtx.baseLatency || 0;
    const output = this.audioCtx.outputLatency || 0;
    return (base + output) * 1000;
  }

  getDuration() {
    return this.musicBuffer?.duration || 0;
  }

  getSongTimeMs() {
    if (!this.isPlaying) return this.pausedAt * 1000;
    if (!this.audioCtx) {
      // Môi trường test / headless không có Web Audio API
      const elapsedPerfMs = performance.now() - this.startPerfTime;
      return elapsedPerfMs + this.userOffsetMs;
    }

    const elapsedSec = this.audioCtx.currentTime - this.startTime;
    const hardwareLatencySec = (this.audioCtx.baseLatency || 0) + (this.audioCtx.outputLatency || 0);
    const audioTimeMs = (elapsedSec - hardwareLatencySec) * 1000 + this.userOffsetMs;
    return audioTimeMs;
  }

  perfToAudioTime(eventPerfTime) {
    if (!this.isPlaying) return this.getSongTimeMs();
    if (!this.audioCtx) {
      const elapsedPerfMs = eventPerfTime - this.startPerfTime;
      return elapsedPerfMs + this.userOffsetMs;
    }
    // Độ lệch âm thanh/bàn phím được hiệu chỉnh triệt để: đồng bộ chính xác với getSongTimeMs()
    const nowPerf = performance.now();
    const songNow = this.getSongTimeMs();
    return songNow + (eventPerfTime - nowPerf);
  }

  resyncTimeAnchor() {
    if (!this.isPlaying || !this.audioCtx) return;
    const hwLatencySec = (this.audioCtx.baseLatency || 0) + (this.audioCtx.outputLatency || 0);
    const currentAudioSec = (this.audioCtx.currentTime - this.startTime) - hwLatencySec;
    const expectedPerfMs = currentAudioSec * 1000;
    const actualPerfMs = performance.now() - this.startPerfTime;

    if (Math.abs(actualPerfMs - expectedPerfMs) > 10) {
      this.startPerfTime = performance.now() - currentAudioSec * 1000;
    }
  }

  /**
   * Nạp file nhạc từ ArrayBuffer, Blob hoặc URL
   */
  async loadMusic(source) {
    await this.init();
    if (!source) return;

    try {
      let arrayBuffer = null;
      if (typeof source === 'string') {
        const res = await fetch(source);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        arrayBuffer = await res.arrayBuffer();
      } else if (source instanceof Blob) {
        arrayBuffer = await source.arrayBuffer();
      } else if (source instanceof ArrayBuffer) {
        arrayBuffer = source;
      } else if (source instanceof Uint8Array) {
        arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
      } else if (source?.buffer instanceof ArrayBuffer) {
        arrayBuffer = source.buffer;
      }

      if (arrayBuffer) {
        this.musicBuffer = await this.decodeAudio(arrayBuffer);
        this.pausedAt = 0;
        return this.musicBuffer.duration;
      }
    } catch (err) {
      console.warn('[AudioEngine] Không thể nạp file nhạc rời, kích hoạt nhạc nền Synth tự động:', err.message);
      this.generateProceduralMusic();
    }
  }

  /**
   * Tự tạo nhạc nền Synth Cyber Arcade chất lượng cao khi chưa có file nhạc rời
   */
  generateProceduralMusic(bpm = 240, durationSec = 30) {
    if (!this.audioCtx) return;
    const sampleRate = this.audioCtx.sampleRate;
    const totalSamples = Math.floor(sampleRate * durationSec);
    const buffer = this.audioCtx.createBuffer(2, totalSamples, sampleRate);

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const beatLen = 60 / bpm;
    const melodyScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const beat = t / beatLen;
      const beatFrac = beat % 1.0;

      let kick = 0;
      if (beat % 2 < 1.0) {
        const kt = beatFrac * beatLen;
        const kickFreq = Math.max(45, 160 * Math.exp(-kt * 40));
        kick = Math.sin(2 * Math.PI * kickFreq * kt) * Math.exp(-kt * 20) * 0.45;
      }

      let snare = 0;
      if (beat % 2 >= 1.0) {
        const st = (beat % 1.0) * beatLen;
        const noise = (Math.random() * 2 - 1) * Math.exp(-st * 25);
        const tone = Math.sin(2 * Math.PI * 220 * st) * Math.exp(-st * 30);
        snare = (noise * 0.4 + tone * 0.3) * 0.35;
      }

      const hatFrac = (beat * 2) % 1.0;
      const ht = hatFrac * (beatLen / 2);
      const hihat = (Math.random() * 2 - 1) * Math.exp(-ht * 80) * 0.08;

      const bassFreq = (Math.floor(beat) % 4 === 3) ? 110 : 82.4;
      const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.18 * (0.8 + 0.2 * Math.cos(2 * Math.PI * 4 * t));

      const noteIdx = Math.floor(beat * 2) % melodyScale.length;
      const synthFreq = melodyScale[noteIdx];
      const stt = (beat * 2) % 1.0 * (beatLen / 2);
      const synth = Math.sin(2 * Math.PI * synthFreq * t) * Math.exp(-stt * 8) * 0.12;

      const mono = kick + snare + hihat + bass + synth;
      left[i] = Math.max(-1, Math.min(1, mono * 0.8));
      right[i] = Math.max(-1, Math.min(1, (mono + synth * 0.1) * 0.8));
    }

    this.musicBuffer = buffer;
  }

  async registerHitsound(name, arrayBuffer) {
    await this.init();
    try {
      const decoded = await this.decodeAudio(arrayBuffer);
      this.soundBank.set(name.toLowerCase(), decoded);
    } catch (err) {
      console.warn(`[AudioEngine] Không thể nạp sample hitsound ${name}:`, err.message);
    }
  }

  /**
   * Bắt đầu phát nhạc với hỗ trợ khoảng trống lead-in (leadInSec) ở đầu bài
   */
  startMusic(offsetSec = 0, leadInSec = 0) {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
        this.musicSource.disconnect();
      } catch (e) {}
      this.musicSource = null;
    }

    if (!this.musicBuffer && this.audioCtx) {
      this.generateProceduralMusic();
    }

    const duration = this.musicBuffer?.duration || 30;
    const safeOffset = Math.max(0, Math.min(offsetSec, Math.max(0, duration - 0.05)));

    this.resync(safeOffset, leadInSec);

    if (this.musicBuffer && this.audioCtx) {
      this.musicSource = this.audioCtx.createBufferSource();
      this.musicSource.buffer = this.musicBuffer;
      this.musicSource.connect(this.musicGain);

      // Nếu có khoảng trống leadInSec (tránh rocket note): lên lịch phát chuẩn xác sau leadInSec
      const scheduledStartTime = leadInSec > 0
        ? this.audioCtx.currentTime + leadInSec
        : 0;

      this.musicSource.start(scheduledStartTime, safeOffset);
    }

    this.isPlaying = true;
    this.isPaused = false;
  }

  resync(offsetSec = 0, leadInSec = 0) {
    const effectiveOffset = offsetSec - (leadInSec || 0);
    if (this.audioCtx) {
      this.startTime = this.audioCtx.currentTime - effectiveOffset;
    } else {
      this.startTime = -effectiveOffset;
    }
    this.startPerfTime = performance.now() - effectiveOffset * 1000;
    this.pausedAt = effectiveOffset;
  }

  pauseMusic() {
    if (!this.isPlaying) return;
    this.pausedAt = this.getSongTimeMs() / 1000;
    if (this.musicSource) {
      try {
        this.musicSource.stop();
        this.musicSource.disconnect();
      } catch (e) {}
      this.musicSource = null;
    }
    this.isPlaying = false;
    this.isPaused = true;
  }

  resumeMusic() {
    if (!this.isPaused) return;
    // Tiếp tục sau Pause: không thêm lead-in nữa
    const hardwareLatencySec = this.audioCtx
      ? (this.audioCtx.baseLatency || 0) + (this.audioCtx.outputLatency || 0)
      : 0;
    const audioOffset = this.pausedAt - (this.userOffsetMs / 1000) + hardwareLatencySec;
    this.startMusic(Math.max(0, audioOffset), Math.max(0, -audioOffset));
  }

  stopMusic() {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
        this.musicSource.disconnect();
      } catch (e) {}
      this.musicSource = null;
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
  }

  playHitsound(soundName = 'normal', volumeScale = 1.0) {
    if (!this.audioCtx) return;

    let buffer = this.soundBank.get(soundName.toLowerCase());
    if (!buffer) {
      buffer = this.soundBank.get('normal') || this.soundBank.get('soft-hitnormal.wav');
    }
    if (!buffer) return;

    const now = this.audioCtx.currentTime;
    this.activeVoices = this.activeVoices.filter(v => v.stopTime > now);

    if (this.activeVoices.length >= this.maxVoices) {
      const oldest = this.activeVoices.shift();
      try {
        oldest.source.stop();
        oldest.source.disconnect();
      } catch (e) {}
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;

    const voiceGain = this.audioCtx.createGain();
    const finalVolume = Math.max(0, Math.min(1.0, volumeScale));
    voiceGain.gain.setValueAtTime(finalVolume, now);

    source.connect(voiceGain);
    voiceGain.connect(this.hitsoundGain);

    source.start(now);

    this.activeVoices.push({
      source,
      stopTime: now + buffer.duration
    });
  }

  playKeyFeedback() {
    this.playHitsound('normal', 0.6);
  }

  /**
   * Phát âm thanh tick khi đếm ngược 3-2-1 hoặc GO (tổng hợp trực tiếp qua Web Audio)
   */
  playCountdownTick(isGo = false) {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      if (isGo) {
        // Âm GO: cao hơn (880Hz -> 1320Hz), ngân vang hơn
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
        gain.gain.setValueAtTime(0.45 * (this.hitsoundVolume ?? 1.0), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Âm 3, 2, 1: tick ngắn (660Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        gain.gain.setValueAtTime(0.38 * (this.hitsoundVolume ?? 1.0), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
      }

      osc.connect(gain);
      gain.connect(this.hitsoundGain || this.audioCtx.destination);
    } catch (_) {}
  }

  setVolumes(musicVol, hitVol) {
    this.musicVolume = Math.max(0, Math.min(1, musicVol));
    this.hitsoundVolume = Math.max(0, Math.min(1, hitVol));
    if (this.musicGain && this.audioCtx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.audioCtx.currentTime);
    }
    if (this.hitsoundGain && this.audioCtx) {
      this.hitsoundGain.gain.setValueAtTime(this.hitsoundVolume, this.audioCtx.currentTime);
    }
  }

  setUserOffset(offsetMs) {
    this.userOffsetMs = Math.max(-200, Math.min(200, offsetMs));
  }

  generateDefaultProceduralSounds() {
    const sampleRate = this.audioCtx.sampleRate;

    // 1. Normal / Tap Hitsound: Tiếng tambourine / clapper maimai giòn tan, dứt khoát
    const normalLen = Math.floor(sampleRate * 0.055); // 55ms
    const normalBuf = this.audioCtx.createBuffer(1, normalLen, sampleRate);
    const normalData = normalBuf.getChannelData(0);
    for (let i = 0; i < normalLen; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 85);
      const toneHigh = Math.sin(2 * Math.PI * 2600 * t);
      const toneMid = Math.sin(2 * Math.PI * 1350 * t);
      const clickNoise = (Math.random() * 2 - 1) * Math.exp(-t * 220);
      normalData[i] = (clickNoise * 0.45 + toneHigh * 0.35 + toneMid * 0.25) * decay;
    }
    this.soundBank.set('normal', normalBuf);
    this.soundBank.set('soft-hitnormal.wav', normalBuf);

    // 2. Break Hitsound: Tiếng nổ pháo hoa rền vang có tiếng bass dậm và chuông vỡ lấp lánh chuẩn maimai
    const breakLen = Math.floor(sampleRate * 0.38); // 380ms
    const breakBuf = this.audioCtx.createBuffer(1, breakLen, sampleRate);
    const breakData = breakBuf.getChannelData(0);
    for (let i = 0; i < breakLen; i++) {
      const t = i / sampleRate;
      // Cú đập bass dậm lúc bắt đầu (110Hz giảm dần)
      const bassSweep = Math.sin(2 * Math.PI * Math.max(45, 120 * Math.exp(-t * 25)) * t) * Math.exp(-t * 15);
      // Chùm chuông lấp lánh (sparkling bell harmonics)
      const bell1 = Math.sin(2 * Math.PI * 1760 * t);
      const bell2 = Math.sin(2 * Math.PI * 2640 * t);
      const bell3 = Math.sin(2 * Math.PI * 3520 * t);
      const bellChime = (bell1 * 0.35 + bell2 * 0.35 + bell3 * 0.3) * Math.exp(-t * 12);
      // Tiếng xé cymbal / pháo hoa
      const sizzle = (Math.random() * 2 - 1) * Math.exp(-t * 20);
      breakData[i] = Math.max(-1, Math.min(1, bassSweep * 0.4 + bellChime * 0.45 + sizzle * 0.25));
    }
    this.soundBank.set('break', breakBuf);

    // 3. Slide Start Hitsound: Tiếng whoosh quét trượt
    const sStartLen = Math.floor(sampleRate * 0.14);
    const sStartBuf = this.audioCtx.createBuffer(1, sStartLen, sampleRate);
    const sStartData = sStartBuf.getChannelData(0);
    for (let i = 0; i < sStartLen; i++) {
      const t = i / sampleRate;
      const freq = 520 + 900 * Math.pow(t / 0.14, 1.5);
      const env = Math.sin((t / 0.14) * Math.PI);
      const tone = Math.sin(2 * Math.PI * freq * t);
      const breath = (Math.random() * 2 - 1) * 0.2;
      sStartData[i] = (tone + breath) * env * 0.55;
    }
    this.soundBank.set('slide-start', sStartBuf);

    // 4. Slide End Hitsound: Tiếng chuông reo kết thúc chặng trượt 'ding!'
    const sEndLen = Math.floor(sampleRate * 0.28);
    const sEndBuf = this.audioCtx.createBuffer(1, sEndLen, sampleRate);
    const sEndData = sEndBuf.getChannelData(0);
    for (let i = 0; i < sEndLen; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 14);
      const chime1 = Math.sin(2 * Math.PI * 1567.98 * t); // G6
      const chime2 = Math.sin(2 * Math.PI * 2093.00 * t); // C7
      const chime3 = Math.sin(2 * Math.PI * 3135.96 * t); // G7
      sEndData[i] = (chime1 * 0.4 + chime2 * 0.4 + chime3 * 0.2) * decay * 0.65;
    }
    this.soundBank.set('slide-end', sEndBuf);

    // 5. Procedural Ring Hitsound (SE_GAME_BREAKSLIDE fallback)
    const ringLen = Math.floor(sampleRate * 0.22);
    const ringBuf = this.audioCtx.createBuffer(1, ringLen, sampleRate);
    const ringData = ringBuf.getChannelData(0);
    for (let i = 0; i < ringLen; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 22);
      const sweep = Math.sin(2 * Math.PI * (1800 - 900 * (t / 0.22)) * t);
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 110);
      ringData[i] = (sweep * 0.6 + crack * 0.4) * decay;
    }
    this.soundBank.set('ring', ringBuf);
    this.soundBank.set('se_game_breakslide', ringBuf);

    // 6. Procedural Ring Hold Hitsound (SE_GAME_SCR_TOUCH_CENTER fallback)
    const holdLen = Math.floor(sampleRate * 0.35);
    const holdBuf = this.audioCtx.createBuffer(1, holdLen, sampleRate);
    const holdData = holdBuf.getChannelData(0);
    for (let i = 0; i < holdLen; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 12);
      const chime1 = Math.sin(2 * Math.PI * 1318.51 * t); // E6
      const chime2 = Math.sin(2 * Math.PI * 1975.53 * t); // B6
      const chime3 = Math.sin(2 * Math.PI * 2637.02 * t); // E7
      holdData[i] = (chime1 * 0.4 + chime2 * 0.35 + chime3 * 0.25) * decay;
    }
    this.soundBank.set('ring-hold', holdBuf);
    this.soundBank.set('se_game_scr_touch_center', holdBuf);
  }
}

export const audioEngine = new AudioEngine();
