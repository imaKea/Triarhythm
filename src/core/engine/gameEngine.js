/**
 * GameEngine - Bộ điều khiển trung tâm của game nhịp điệu Triarhythm
 * Tách biệt hoàn toàn khỏi React state, chạy trên vòng lặp requestAnimationFrame
 * Quản lý vòng đời note, phán định Tap/Hold/Break, bù trừ độ trễ và đếm ngược Pause
 */

import { audioEngine } from './audioEngine.js';
import { InputManager } from './inputManager.js';
import { GameplayRenderer } from './gameplayRenderer.js';
import { ScoreManager } from './scoreManager.js';
import { ParticleSystem } from './particleSystem.js';
import { gameEvents } from './eventBus.js';
import { getJudgement, JUDGEMENT_CONFIG } from '../../config/judgement.config.js';
import { TRI_RING_LAYOUT, layoutToPixels, getLayoutMetrics, getTapLane, normalizeAngle } from '../../config/layout.config.js';
import { SlideManager } from './slideManager.js';
import { SLIDE_CONFIG, calculateSlideTiming } from '../../config/slide.config.js';

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.audioEngine = audioEngine;
    this.inputManager = new InputManager(audioEngine);
    this.renderer = new GameplayRenderer(canvas);
    this.scoreManager = new ScoreManager();
    this.particleSystem = new ParticleSystem(400);

    // Dữ liệu bài hát hiện tại
    this.beatmap = null;
    this.notes = [];
    this.chartNotes = [];
    this.totalDuration = 0;

    // Trạng thái vòng lặp
    this.animFrameId = null;
    this.isRunning = false;
    this.lifecycleVersion = 0;
    this.isPaused = false;
    this.lastFramePerfTime = 0;
    this.resyncIntervalMs = 1500;
    this.lastResyncTime = 0;

    // Đếm ngược 3-2-1 khi bắt đầu hoặc tiếp tục (P3 osu! lazer style)
    this.resumeCountdown = 0;
    this.isCountdown = false;
    this.countdownType = null; // 'START' | 'RESUME'
    this.pausedCountdownType = null;
    this.countdownStartOffset = 0;
    this.lastCountdownStep = -1;
    this.enableStartCountdown = true;
    this.onCountdownEnd = null;

    // Khoảng trống 1 giây không nhạc ở đầu map để chống "rocket note"
    this.leadInSec = 1.0;
    this.hasStartedAudio = false;
    this.onMusicStart = null;

    // Trạng thái giữ Hold của 9 lane
    this.holdingNotes = new Map(); // lane -> note
    this.hasBackgroundVideo = false;

    // Quản lý đa chạm ngón tay (Multi-touch) trên Mobile & Pointer
    this.activeTouchPointers = new Map(); // pointerId -> { lane, px, py, startTime }

    // Thiết lập input callbacks
    this.inputManager.onLaneDown = this.handleLaneDown.bind(this);
    this.inputManager.onLaneUp = this.handleLaneUp.bind(this);
    this.inputManager.onSpaceDown = this.handleSpaceDown.bind(this);
    this.inputManager.onSpaceUp = this.handleSpaceUp.bind(this);
    this.inputManager.onTypingKey = this.handleTypingKey.bind(this);
    this.inputManager.onPause = this.togglePause.bind(this);

    // Bind loop một lần duy nhất để tránh tạo function mới mỗi frame (perf optimization)
    this.boundLoop = this.loop.bind(this);

    // Chế độ tự động chơi (Autoplay) để test
    this.isAutoplay = false;
    this.isMaimaiChart = false;
    this.maimaiSpinAssist = true;

    // Trạng thái skip đoạn nghỉ (Break / Intro)
    this.canSkip = false;
    this.hasPassedIntro = false;
    this.onSyncVideo = null;
  }

  /**
   * Kiểm tra xem thời điểm hiện tại có đang trong đoạn trống (Break / Intro) ở ĐẦU MAP để có thể nhấn SPACE Skip hay không
   * Yêu cầu: Chỉ bỏ qua đoạn nghỉ đầu map thôi, mấy khúc sau không cho nữa.
   */
  canSkipBreak(audioTime) {
    if (!this.notes || this.notes.length === 0 || !this.isRunning || this.isPaused) return false;
    if (this.hasPassedIntro) return false;

    // Tìm nốt đầu tiên của map
    const firstNote = this.notes[0];
    if (!firstNote || firstNote.state !== 'PENDING') {
      this.hasPassedIntro = true;
      return false;
    }

    const nextNote = this.notes.find(n => n.state === 'PENDING' && n.time > audioTime);
    // Nếu nốt kế tiếp không phải nốt đầu tiên, bài hát đã bắt đầu -> vĩnh viễn không cho skip nữa
    if (!nextNote || nextNote !== firstNote) {
      this.hasPassedIntro = true;
      return false;
    }

    // Khoảng cách tới nốt đầu tiên phải >= 2500ms
    const timeUntilFirst = firstNote.time - audioTime;
    return timeUntilFirst >= 2500;
  }

  /**
   * Bỏ qua đoạn nghỉ / intro đầu map: Tua nhanh nhạc và thời gian tới ngay trước nốt đầu tiên
   */
  skipBreak(currentAudioTime = null) {
    const audioTime = currentAudioTime ?? this.audioEngine.getSongTimeMs();
    if (!this.canSkipBreak(audioTime)) return false;

    const firstNote = this.notes[0];
    if (!firstNote) return false;

    const travelTime = this.renderer?.getTravelTime ? this.renderer.getTravelTime() : 1500;
    // Nhảy tới trước nốt đầu tiên khoảng 1500ms - 1800ms để nốt xuất hiện và bay vào mượt mà
    const leadTime = Math.max(1500, travelTime + 300);
    const targetTime = Math.max(0, firstNote.time - leadTime);

    this.hasPassedIntro = true;
    this.canSkip = false;

    this.audioEngine.startMusic(targetTime / 1000);
    this.audioEngine.resync(targetTime / 1000);

    if (this.onSyncVideo) {
      try {
        this.onSyncVideo(targetTime / 1000);
      } catch (e) {}
    }

    gameEvents.emit('skipBreak', { fromTime: audioTime, toTime: targetTime });
    gameEvents.emit('canSkipBreak', { canSkip: false });
    return true;
  }

  setAutoplay(enabled) {
    this.isAutoplay = Boolean(enabled);
  }

  /**
   * Khống chế tối đa 2 nốt bấm cùng lúc & tối đa 2 ngón tay đồng thời (2-Finger Ergonomics chuẩn maimai)
   * Yêu cầu: Nốt Ring (Spacebar ngón cái) KHÔNG tính là 1 nốt trong giới hạn 2 nốt bấm (vẫn cho phép 2 nốt phím theo sau)
   */
  enforceTwoFingerConstraint(rawNotes) {
    if (!rawNotes || rawNotes.length === 0) return [];

    const sorted = [...rawNotes].sort((a, b) => a.time - b.time);
    const byTime = new Map();
    for (const n of sorted) {
      const key = Math.round(n.time);
      if (!byTime.has(key)) byTime.set(key, []);
      byTime.get(key).push(n);
    }

    const result = [];
    let activeButtonHolds = [];
    let activeRingHolds = [];

    for (const [t, chord] of byTime.entries()) {
      // Dọn dẹp các hold đã kết thúc
      activeButtonHolds = activeButtonHolds.filter(a => (a.endTime || 0) > t + 20);
      activeRingHolds = activeRingHolds.filter(a => (a.endTime || 0) > t + 20);

      const ringNotes = chord.filter(n => n.type === 'ring' || n.type === 'slide');
      const buttonNotes = chord.filter(n => n.type !== 'ring' && n.type !== 'slide');

      // Giữ tối đa 1 nốt Ring (Spacebar ngón cái)
      if (ringNotes.length > 0) {
        const ring = ringNotes[0];
        result.push(ring);
        if (ring.isHold && ring.endTime) {
          activeRingHolds.push({ endTime: ring.endTime });
        }
      }

      // Giữ tối đa 2 nốt bấm bàn phím (Nốt Ring KHÔNG tính vào giới hạn 2 nốt này)
      const maxFingers = 2;
      const availableFingers = Math.max(0, maxFingers - activeButtonHolds.length);
      const countToKeep = Math.min(buttonNotes.length, maxFingers, availableFingers);
      const keptButtons = buttonNotes.slice(0, countToKeep);

      for (const note of keptButtons) {
        result.push(note);
        if (note.type === 'hold' && note.endTime) {
          activeButtonHolds.push({ endTime: note.endTime });
        }
      }
    }

    return result.sort((a, b) => a.time - b.time);
  }

  /**
   * Nạp beatmap và nguồn âm thanh riêng biệt cho bài hát
   * @param {Object} beatmap Dữ liệu beatmap JSON v2
   * @param {Blob | ArrayBuffer | string | null} audioSource Nguồn nhạc của bài
   * @param {Object | null} customHitsounds Danh sách hitsounds riêng của map
   */
  async loadChart(beatmap, audioSource = null, customHitsounds = null) {
    this.beatmap = beatmap;

    const beatLength = beatmap.timingPoints?.[0]?.beatLength || (60000 / (beatmap.timingPoints?.[0]?.bpm || 140));
    const isMaimai = Boolean(
      beatmap.metadata?.source === 'maimai' ||
      beatmap.source === 'maimai' ||
      beatmap.format === 'maimai' ||
      beatmap.rawMaidata !== undefined
    );
    this.isMaimaiChart = isMaimai;

    // Maimai giữ 100% nốt theo chuẩn chart gốc; osu mania áp dụng bộ lọc 2 ngón tay
    const isOsu = Boolean(
      beatmap.rawOsu ||
      beatmap.source === 'osu' ||
      beatmap.metadata?.source === 'osu' ||
      beatmap.keys ||
      (beatmap.metadata?.difficultyName && /^\d+k$/i.test(beatmap.metadata.difficultyName))
    );
    const rawNotes = (isMaimai || !isOsu) ? (beatmap.notes || []) : this.enforceTwoFingerConstraint(beatmap.notes || [], beatLength);
    // Sắp xếp các nốt theo trình tự thời gian tăng dần
    const sanitizedNotes = [...rawNotes].sort((a, b) => (a.time || 0) - (b.time || 0));

    // Nhận diện các cặp nốt đồng thời (cách nhau <= 1ms) để đổi màu "Each" vàng
    const processed = sanitizedNotes.map((n, idx) => {
      const isEach = sanitizedNotes.some((other, oIdx) => oIdx !== idx && Math.abs(other.time - n.time) <= 1);
      const timing = n.type === 'slide' ? calculateSlideTiming(n, beatLength) : null;

      if (n.type === 'typing') {
        return {
          ...n,
          id: idx,
          isEach: false,
          timing: null,
          state: 'PENDING',
          chars: (n.chars || []).map((c, cIdx) => ({
            ...c,
            id: `${idx}-${cIdx}`,
            state: 'PENDING',
            judgement: null,
            deltaMs: 0
          }))
        };
      }

      return {
        ...n,
        id: idx,
        isEach,
        timing,
        state: 'PENDING',
        isHolding: false,
        isHoldingDropped: false,
        resumeHoldThroughPause: false,
        headJudged: false,
        tailJudged: false,
        onTrackDurationMs: 0,
        lastSampleTime: null,
        hasReachedEnd: false,
        startRippleSpawned: false,
        startSamplePlayed: false,
        isFinished: false
      };
    });

    this.chartNotes = processed;
    this.notes = this.cloneChartNotes();
    this.scoreManager.initChart(this.notes);

    // Tính tổng thời lượng bài dựa trên nốt kết thúc muộn nhất
    if (this.notes.length > 0) {
      const maxNoteEndTime = this.notes.reduce((max, n) => Math.max(max, n.endTime || n.time || 0), 0);
      this.totalDuration = Math.max(maxNoteEndTime + 1500, 30000);
    } else {
      this.totalDuration = 30000;
    }

    if (beatmap.settings?.noteSpeed) {
      this.renderer.noteSpeed = beatmap.settings.noteSpeed;
    }

    await this.audioEngine.init();

    // 1. Nạp custom hitsounds nếu gói map có kèm
    if (customHitsounds && typeof customHitsounds === 'object') {
      for (const [name, blob] of Object.entries(customHitsounds)) {
        try {
          if (blob instanceof Blob) {
            const buf = await blob.arrayBuffer();
            await this.audioEngine.registerHitsound(name, buf);
          }
        } catch (e) {
          console.warn(`[GameEngine] Không thể nạp hitsound ${name}:`, e.message);
        }
      }
    }

    // 2. Nạp âm thanh chính xác của bài
    if (audioSource) {
      try {
        await this.audioEngine.loadMusic(audioSource);
      } catch (e) {
        console.warn('[GameEngine] Không thể giải mã audioSource, dùng synth fallback:', e.message);
        const bpm = beatmap.timingPoints?.[0]?.bpm || 140;
        this.audioEngine.generateProceduralMusic(bpm, this.totalDuration / 1000);
      }
    } else if (beatmap.metadata?.id === 'osu-4219453' || beatmap.metadata?.title?.includes('Beyond The')) {
      // Chỉ bài mẫu Beyond The Aexis mới dùng /audio.ogg
      try {
        const res = await fetch('/audio.ogg');
        if (res.ok) {
          const buf = await res.arrayBuffer();
          await this.audioEngine.loadMusic(buf);
        } else {
          const bpm = beatmap.timingPoints?.[0]?.bpm || 240;
          this.audioEngine.generateProceduralMusic(bpm, this.totalDuration / 1000);
        }
      } catch (e) {
        const bpm = beatmap.timingPoints?.[0]?.bpm || 240;
        this.audioEngine.generateProceduralMusic(bpm, this.totalDuration / 1000);
      }
    } else {
      // Map khác khi không kèm file audio: tự động sinh nhạc Synth theo đúng BPM của map đó
      const bpm = beatmap.timingPoints?.[0]?.bpm || 140;
      this.audioEngine.generateProceduralMusic(bpm, this.totalDuration / 1000);
    }

    // Cập nhật tổng thời lượng theo độ dài thực tế của file âm thanh nếu dài hơn
    const audioDurMs = Math.round((this.audioEngine.getDuration() || 0) * 1000);
    if (audioDurMs > 0) {
      this.totalDuration = Math.max(this.totalDuration, audioDurMs);
    }
  }

  /**
   * Bắt đầu chơi bài hát
   */
  async start(startOffsetSec = 0, withCountdown = true) {
    // Chống start đôi khi nhấn phím hoặc click nhiều lần
    if (this.isRunning && (this.isCountdown || !this.isPaused)) return;

    const lifecycleVersion = ++this.lifecycleVersion;
    await this.audioEngine.init();
    if (lifecycleVersion !== this.lifecycleVersion) return;
    this.inputManager.attach();

    // Lắng nghe tương tác ngón tay (Touch / Pointer) trên Canvas cho Mobile & Desktop
    if (this.canvas) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      this.boundPointerMove = this.handlePointerMove.bind(this);
      this.boundPointerUp = this.handlePointerUp.bind(this);
      this.boundPointerCancel = this.handlePointerUp.bind(this);
      this.boundContextMenu = (e) => e.preventDefault();

      if (this.canvas.addEventListener) {
        this.canvas.addEventListener('pointerdown', this.boundPointerDown, { passive: false });
        this.canvas.addEventListener('pointermove', this.boundPointerMove, { passive: false });
        this.canvas.addEventListener('pointerup', this.boundPointerUp, { passive: false });
        this.canvas.addEventListener('pointercancel', this.boundPointerCancel, { passive: false });
        this.canvas.addEventListener('contextmenu', this.boundContextMenu);
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', this.boundPointerUp);
        window.addEventListener('pointercancel', this.boundPointerCancel);
      }
    }

    const useCountdown = withCountdown && (this.enableStartCountdown !== false);
    this.pausedCountdownType = null;

    if (useCountdown) {
      this.isRunning = true;
      this.isPaused = false;
      this.isCountdown = true;
      this.hasStartedAudio = false;
      this.countdownType = 'START';
      this.countdownStartOffset = startOffsetSec;
      this.resumeCountdown = 3.4; // 3.0s (3, 2, 1) + 0.4s ("GO!")
      this.lastCountdownStep = -1;

      this.lastFramePerfTime = performance.now();
      gameEvents.emit('countdownStart', { type: 'START' });
      this.loop();
    } else {
      this.isRunning = true;
      this.isPaused = false;
      this.isCountdown = false;
      this.resumeCountdown = 0;
      this.hasStartedAudio = false;

      // Áp dụng 1 giây trống không có nhạc ở đầu map
      this.audioEngine.startMusic(startOffsetSec, this.leadInSec);

      this.lastFramePerfTime = performance.now();
      this.lastResyncTime = performance.now();

      this.loop();
      gameEvents.emit('gameStart', { beatmap: this.beatmap });
    }
  }

  /**
   * Vòng lặp chính requestAnimationFrame
   */
  loop() {
    if (!this.isRunning) return;

    const nowPerf = performance.now();
    const dt = Math.min(0.1, (nowPerf - this.lastFramePerfTime) / 1000);
    this.lastFramePerfTime = nowPerf;

    if (!this.isPaused && this.resumeCountdown <= 0) {
      const songTime = this.audioEngine.getSongTimeMs();

      // Đồng bộ thời điểm nhạc bắt đầu phát thực tế (sau 1 giây trống lead-in)
      if (!this.hasStartedAudio && songTime >= (this.countdownStartOffset || 0) * 1000) {
        this.hasStartedAudio = true;
        if (this.onMusicStart) {
          this.onMusicStart(this.countdownStartOffset || 0);
        }
        gameEvents.emit('musicStart', { offsetSec: this.countdownStartOffset || 0 });
      }

      if (nowPerf - this.lastResyncTime > this.resyncIntervalMs) {
        this.audioEngine.resyncTimeAnchor();
        this.lastResyncTime = nowPerf;
      }

      this.updateNotes(songTime);
      this.particleSystem.update(dt);
      this.renderer.update(dt);

      const travelTime = this.renderer.getTravelTime();
      const activeTypingSection = this.notes.find(
        n => n.type === 'typing' &&
        songTime >= (n.time - travelTime) &&
        songTime <= (n.endTime + 300) &&
        n.state !== 'JUDGED'
      );

      const newCanSkip = this.canSkipBreak(songTime);
      if (newCanSkip !== this.canSkip) {
        this.canSkip = newCanSkip;
        gameEvents.emit('canSkipBreak', { canSkip: this.canSkip });
      }

      const gameState = {
        songTime,
        totalDuration: this.totalDuration,
        canSkip: Boolean(this.canSkip),
        combo: this.scoreManager.combo,
        comboPunch: Math.min(1.0, this.scoreManager.combo / 50),
        achievement: this.scoreManager.achievement,
        rank: this.scoreManager.rank,
        rankColor: this.scoreManager.getRankColor(),
        ur: this.scoreManager.ur,
        activeLanes: this.inputManager.isKeyDown,
        holdingLanes: this.getHoldingLanesArray(),
        activeNotes: this.getActiveNotes(songTime),
        pointer: {
          pos: this.inputManager.pointerPos,
          isDown: this.inputManager.isPointerDown
        },
        hasBackgroundVideo: Boolean(this.hasBackgroundVideo),
        isAutoplay: Boolean(this.isAutoplay),
        isTypingActive: Boolean(activeTypingSection),
        activeTypingSection: activeTypingSection || null
      };

      this.renderer.render(gameState, this.particleSystem);

      // Optimization: short-circuit on length first, then simple counter-based check instead of .every()
      const allNotesDone = this.notes.length === 0 || this.notes.every(n => n.state === 'JUDGED' || n.state === 'MISSED');
      if ((allNotesDone && songTime >= this.totalDuration) || (songTime >= this.totalDuration + 2000)) {
        this.finishGame();
        return;
      }
    } else if (this.isCountdown && this.resumeCountdown > 0) {
      this.resumeCountdown -= dt;

      // Xác định nhịp:
      // 3: (2.4, 3.4]
      // 2: (1.4, 2.4]
      // 1: (0.4, 1.4]
      // 0: [0, 0.4] ("GO!")
      let currentStep;
      if (this.resumeCountdown > 2.4) currentStep = 3;
      else if (this.resumeCountdown > 1.4) currentStep = 2;
      else if (this.resumeCountdown > 0.4) currentStep = 1;
      else currentStep = 0;

      if (currentStep !== this.lastCountdownStep) {
        this.lastCountdownStep = currentStep;
        this.audioEngine.playCountdownTick(currentStep === 0);
        gameEvents.emit('countdownTick', { step: currentStep });
      }

      this.renderCountdown();

      if (this.resumeCountdown <= 0) {
        this.finishCountdown();
      }
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(this.boundLoop);
    }
  }

  /**
   * Kết thúc đếm ngược và bắt đầu phát nhạc / đồng bộ video chính xác
   */
  finishCountdown() {
    this.isCountdown = false;
    this.resumeCountdown = 0;
    this.lastCountdownStep = -1;

    if (this.countdownType === 'START') {
      this.hasStartedAudio = false;
      // Áp dụng 1 giây trống không có nhạc ở đầu map sau countdown
      this.audioEngine.startMusic(this.countdownStartOffset, this.leadInSec);
      this.lastResyncTime = performance.now();
      if (this.onCountdownEnd) {
        this.onCountdownEnd(this.countdownStartOffset);
      }
      gameEvents.emit('countdownEnd');
      gameEvents.emit('gameStart', { beatmap: this.beatmap });
    } else if (this.countdownType === 'RESUME') {
      this.audioEngine.resumeMusic();
      this.lastResyncTime = performance.now();
      if (this.onCountdownEnd) {
        this.onCountdownEnd(this.audioEngine.pausedAt);
      }
      gameEvents.emit('countdownEnd');
      gameEvents.emit('resume');
    }
    this.countdownType = null;
    this.pausedCountdownType = null;
  }

  cloneChartNotes() {
    return this.chartNotes.map(note => ({
      ...note,
      state: 'PENDING',
      isHolding: false,
      isHoldingDropped: false,
      headJudged: false,
      tailJudged: false,
      onTrackDurationMs: 0,
      lastSampleTime: null,
      hasReachedEnd: false,
      startRippleSpawned: false,
      startSamplePlayed: false,
      isFinished: false,
      chars: note.chars?.map(char => ({
        ...char,
        state: 'PENDING',
        judgement: null,
        deltaMs: 0
      }))
    }));
  }

  resetRun() {
    this.audioEngine.stopMusic();
    this.notes = this.cloneChartNotes();
    this.scoreManager.initChart(this.notes);
    this.holdingNotes.clear();
    this.activeTouchPointers.clear();
    this.inputManager.reset();
    this.particleSystem.clear();
    this.hasStartedAudio = false;
    this.hasPassedIntro = false;
    this.canSkip = false;
    this.isCountdown = false;
    this.countdownType = null;
    this.pausedCountdownType = null;
    this.resumeCountdown = 0;
  }

  /**
   * Hủy đếm ngược an toàn (ví dụ khi Pause hoặc Stop giữa chừng)
   */
  cancelCountdown() {
    this.isCountdown = false;
    this.resumeCountdown = 0;
    this.lastCountdownStep = -1;
    this.countdownType = null;
  }

  /**
   * Kiểm tra người chơi có đang giữ phím Space hoặc bất kỳ nút nào trên bàn phím (hoặc chạm cảm ứng) cho nốt Ring
   */
  isRingHolding() {
    if (!this.inputManager) return false;
    return Boolean(
      this.inputManager.isAnyKeyDown ||
      this.inputManager.isSpaceDown ||
      (this.inputManager.heldKeyCodes && this.inputManager.heldKeyCodes.size > 0) ||
      (this.inputManager.activeHeldCodes && this.inputManager.activeHeldCodes.size > 0) ||
      (this.inputManager.isKeyDown && this.inputManager.isKeyDown.some(Boolean)) ||
      this.inputManager.isPointerDown
    );
  }

  updateNotes(songTime) {
    const travelTime = this.renderer.getTravelTime();
    const ringTravelTime = this.renderer.getRingTravelTime ? this.renderer.getRingTravelTime() : travelTime;
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, this.canvas.width, this.canvas.height);

    for (const note of this.notes) {
      if (note.state === 'JUDGED' || note.state === 'MISSED') continue;

      const noteTravelTime = (note.type === 'ring' || note.type === 'slide') ? ringTravelTime : travelTime;
      if (note.state === 'PENDING' && songTime >= note.time - noteTravelTime) {
        note.state = 'ACTIVE';
      }

      // CHẾ ĐỘ AUTOPLAY TỰ ĐỘNG CHƠI CHÍNH XÁC 100%
      if (this.isAutoplay) {
        if (note.type === 'tap' || note.type === 'break') {
          if (songTime >= note.time) {
            this.triggerJudgement(note, 'CRITICAL_PERFECT', 0);
          }
        } else if (note.type === 'hold') {
          if (songTime >= note.time && !note.headJudged) {
            note.headJudged = true;
            note.isHolding = true;
            this.holdingNotes.set(note.lane, note);
            this.triggerJudgement(note, 'CRITICAL_PERFECT', 0, false);
          }
          if (note.isHolding && songTime >= note.endTime - 20) {
            note.tailJudged = true;
            note.isHolding = false;
            note.state = 'JUDGED';
            this.holdingNotes.delete(note.lane);
            const targetLane = getTapLane(note.lane);
            if (targetLane) {
              const pix = layoutToPixels(targetLane.x, targetLane.y, this.canvas.width, this.canvas.height);
              this.particleSystem.spawnRipple(pix.x, pix.y, '#ffd54f', 60, 0.35, 2.5, false);
              this.particleSystem.spawnBurst(pix.x, pix.y, '#ffea00', 18, 140);
            }
            this.audioEngine.playHitsound(note.isBreakHold ? 'break' : 'normal', 0.9);
          }
        } else if (note.type === 'ring' || note.type === 'slide') {
          const isHoldRing = Boolean(note.isHold && note.endTime && note.endTime > note.time);
          if (!isHoldRing) {
            if (songTime >= note.time) {
              note.state = 'JUDGED';
              const res = this.scoreManager.registerJudgement('CRITICAL_PERFECT', 'ring', 0);
              this.renderer.addJudgementPopup('CRITICAL_PERFECT', 0, originPix.x, originPix.y - 30);
              this.audioEngine.playHitsound('ring', 1.0);
              this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e5ff', 120, 0.45, 4, true);
              this.particleSystem.spawnBurst(originPix.x, originPix.y, '#ffffff', 25, 180, true);
              gameEvents.emit('judgement', {
                note,
                judgement: 'CRITICAL_PERFECT',
                deltaMs: 0,
                combo: res.combo,
                achievement: res.achievement
              });
            }
          } else {
            // Autoplay cho nốt Hold Ring (Âm thanh SE_GAME_SCR_TOUCH_CENTER)
            if (songTime >= note.time && !note.headJudged) {
              note.headJudged = true;
              note.isHolding = true;
              this.audioEngine.playHitsound('ring-hold', 1.0);
              this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 120, 0.45, 4, true);
              this.renderer.addJudgementPopup('CRITICAL_PERFECT', 0, originPix.x, originPix.y - 30);
            }
            if (note.isHolding) {
              if (Math.random() < 0.3) {
                this.particleSystem.spawnBurst(originPix.x, originPix.y, '#00e676', 2, 60, true);
              }
              if (songTime >= note.endTime - 40) {
                note.tailJudged = true;
                note.isHolding = false;
                note.state = 'JUDGED';
                const res = this.scoreManager.registerJudgement('CRITICAL_PERFECT', 'ring', 0);
                this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 140, 0.5, 4, true);
                gameEvents.emit('judgement', {
                  note,
                  judgement: 'CRITICAL_PERFECT',
                  deltaMs: 0,
                  combo: res.combo,
                  achievement: res.achievement
                });
              }
            }
          }
        } else if (note.type === 'typing') {
          if (note.chars && Array.isArray(note.chars)) {
            const hitPos = this.renderer.getTypingHitLinePos(this.canvas.width, this.canvas.height);
            for (const charObj of note.chars) {
              if (charObj.state === 'PENDING' && songTime >= charObj.time) {
                charObj.state = 'JUDGED';
                charObj.judgement = 'CRITICAL_PERFECT';
                charObj.deltaMs = 0;
                this.scoreManager.registerJudgement('CRITICAL_PERFECT', 'typing', 0);
                this.renderer.addJudgementPopup('CRITICAL_PERFECT', 0, hitPos.x, hitPos.y);
                this.audioEngine.playHitsound('normal', 1.0);
              }
            }
            if (note.chars.every(c => c.state !== 'PENDING')) {
              note.state = 'JUDGED';
            }
          }
        }
        continue;
      }

      // CHẾ ĐỘ NGƯỜI CHƠI BÌNH THƯỜNG
      const missWindow = JUDGEMENT_CONFIG.windows.good || 150;
      if (note.state === 'ACTIVE') {
        if (note.type === 'tap' || note.type === 'break') {
          if (songTime > note.time + missWindow) {
            this.triggerJudgement(note, 'MISS', missWindow);
          }
        } else if (note.type === 'hold') {
          if (!note.headJudged && songTime > note.time + missWindow) {
            this.triggerJudgement(note, 'MISS', missWindow);
          }

          if (note.isHolding) {
            const targetLane = getTapLane(note.lane);
            if (targetLane && Math.random() < 0.4) {
              const pix = layoutToPixels(targetLane.x, targetLane.y, this.canvas.width, this.canvas.height);
              this.particleSystem.spawnBurst(pix.x, pix.y, '#ffd54f', 2, 40);
            }

            if (songTime >= note.endTime - 100) {
              note.tailJudged = true;
              note.isHolding = false;
              note.state = 'JUDGED';
              this.holdingNotes.delete(note.lane);

              const targetLane = getTapLane(note.lane);
              if (targetLane) {
                const pix = layoutToPixels(targetLane.x, targetLane.y, this.canvas.width, this.canvas.height);
                this.particleSystem.spawnRipple(pix.x, pix.y, '#ffd54f', 60, 0.35, 2.5, false);
                this.particleSystem.spawnBurst(pix.x, pix.y, '#ffea00', 18, 140);
              }
              this.audioEngine.playHitsound(note.isBreakHold ? 'break' : 'normal', 0.9);
            }
          }
        } else if (note.type === 'ring' || note.type === 'slide') {
          const isHoldRing = Boolean(note.isHold && note.endTime && note.endTime > note.time);
          if (!isHoldRing) {
            // Người chơi giữ phím SPACE hoặc bất kỳ phím nào: tự động phán định nốt Ring hoàn hảo khi nốt tới tâm receptor
            if (this.isRingHolding() && songTime >= note.time && Math.abs(songTime - note.time) <= 50) {
              this.judgeRingNote(note, note.time, originPix);
              continue;
            }

            // Nốt Ring tự động MISS nếu quá hạn missWindow mà người chơi không nhấn SPACE / bất kỳ phím nào
            if (songTime > note.time + missWindow) {
              note.state = 'MISSED';
              const res = this.scoreManager.registerJudgement('MISS', 'ring', missWindow);
              this.renderer.addJudgementPopup('MISS', missWindow, originPix.x, originPix.y - 30);
              this.emitJudgement(note, 'MISS', missWindow, res);
            }
          } else {
            // Xử lý nốt Hold Ring (Giữ phím Space hoặc bất kỳ nút nào trên bàn phím với hiệu ứng viền cầu vồng như Rhythm Typer)
            if (!note.headJudged) {
              // Bắt đầu bấm hoặc giữ Space / bất kỳ phím nào khi nốt tới
              if (this.isRingHolding() && songTime >= note.time - 50 && songTime <= note.time + missWindow) {
                note.headJudged = true;
                note.isHolding = true;
                note.holdStartDeltaMs = Math.round(songTime - note.time);
                this.audioEngine.playHitsound('ring-hold', 1.0);
                this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 120, 0.45, 4, true);
              } else if (songTime > note.time + missWindow) {
                note.state = 'MISSED';
                const res = this.scoreManager.registerJudgement('MISS', 'ring', missWindow);
                this.renderer.addJudgementPopup('MISS', missWindow, originPix.x, originPix.y - 30);
                this.emitJudgement(note, 'MISS', missWindow, res);
              }
            }

            if (note.isHolding) {
              if (this.isRingHolding() || note.resumeHoldThroughPause) {
                // Đang giữ Space hoặc bất kỳ phím nào: phát hiệu ứng hào quang & hạt lấp lánh xanh lá
                if (Math.random() < 0.35) {
                  this.particleSystem.spawnBurst(originPix.x, originPix.y, '#00e676', 2, 70, true);
                }

                // Chỉ hoàn tất và chấm điểm sau khi giữ đủ toàn bộ thời lượng
                if (songTime >= note.endTime) {
                  this.finishRingHold(note, true);
                }
              } else {
                // Nhả phím sớm
                this.finishRingHold(note, false);
              }
            }
          }
        } else if (note.type === 'typing') {
          if (note.chars && Array.isArray(note.chars)) {
            const hitPos = this.renderer.getTypingHitLinePos(this.canvas.width, this.canvas.height);
            for (const charObj of note.chars) {
              if (charObj.state === 'PENDING' && songTime > charObj.time + 150) {
                charObj.state = 'MISSED';
                charObj.judgement = 'MISS';
                charObj.deltaMs = 150;
                this.scoreManager.registerJudgement('MISS', 'typing', 150);
                this.renderer.addJudgementPopup('MISS', 150, hitPos.x, hitPos.y);
              }
            }
            if (note.chars.every(c => c.state !== 'PENDING')) {
              note.state = 'JUDGED';
            }
          }
        }
      }
    }
  }

  /**
   * Phán định nốt Ring (dùng chung cho cả nhấn Space trực tiếp và giữ Space liên tục)
   */
  judgeRingNote(note, audioTime, originPix = null) {
    if (!note || note.state === 'JUDGED') return;

    note.state = 'JUDGED';
    const deltaMs = Math.round(audioTime - note.time);
    const judgement = 'CRITICAL_PERFECT';

    const res = this.scoreManager.registerJudgement(judgement, 'ring', deltaMs);

    const targetOrigin = originPix || layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, this.canvas.width, this.canvas.height);
    this.renderer.addJudgementPopup(judgement, deltaMs, targetOrigin.x, targetOrigin.y - 30);

    if (judgement !== 'MISS') {
      this.audioEngine.playHitsound('ring', 1.0);
      this.particleSystem.spawnRipple(targetOrigin.x, targetOrigin.y, '#00e5ff', 120, 0.45, 4, true);
      this.particleSystem.spawnBurst(targetOrigin.x, targetOrigin.y, '#ffffff', 25, 180, true);
    }

    this.emitJudgement(note, judgement, deltaMs, res);
  }

  emitJudgement(note, judgement, deltaMs, result) {
    gameEvents.emit('judgement', {
      note,
      judgement,
      deltaMs,
      combo: result.combo,
      achievement: result.achievement
    });
  }

  /**
   * Xử lý nhấn phím SPACE để đánh nốt Ring (kích thước bằng cả outline)
   */
  handleSpaceDown(audioTime, perfTime) {
    if (this.isPaused || this.resumeCountdown > 0) return;

    // Yêu cầu: Nhấn SPACE để skip đoạn không có note gì hết (chỉ ở đầu map)
    if (this.canSkipBreak(audioTime)) {
      this.skipBreak(audioTime);
      return;
    }

    const maxWindow = JUDGEMENT_CONFIG.windows.good || 150;

    // Tìm nốt ring đang trong cửa sổ phán định
    const candidates = this.notes.filter(n =>
      (n.type === 'ring' || n.type === 'slide') &&
      n.state !== 'JUDGED' &&
      n.state !== 'MISSED' &&
      !n.headJudged &&
      Math.abs(audioTime - n.time) <= maxWindow
    );

    if (candidates.length === 0) {
      this.audioEngine.playKeyFeedback();
      return;
    }

    // Sắp xếp ưu tiên nốt gần audioTime nhất (tránh notelock)
    candidates.sort((a, b) => Math.abs(audioTime - a.time) - Math.abs(audioTime - b.time));
    const targetNote = candidates[0];
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, this.canvas.width, this.canvas.height);

    // Tự động bỏ qua các nốt ring cũ hơn nếu người chơi đã đánh nốt mới hơn
    for (const older of candidates) {
      if (older !== targetNote && older.time < targetNote.time) {
        older.state = 'MISSED';
        const res = this.scoreManager.registerJudgement('MISS', 'ring', 150);
        this.emitJudgement(older, 'MISS', 150, res);
      }
    }

    if (targetNote.isHold && targetNote.endTime && targetNote.endTime > targetNote.time) {
      if (!targetNote.headJudged) {
        targetNote.headJudged = true;
        targetNote.isHolding = true;
        targetNote.holdStartDeltaMs = Math.round(audioTime - targetNote.time);
        this.audioEngine.playHitsound('ring-hold', 1.0);
        this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 120, 0.45, 4, true);
      }
    } else {
      this.judgeRingNote(targetNote, audioTime, originPix);
    }
  }

  handleSpaceUp(audioTime) {
    if (this.isPaused || this.resumeCountdown > 0) return;
    for (const note of this.notes) {
      if (note.resumeHoldThroughPause) note.resumeHoldThroughPause = false;
    }
    this.resolveRingHoldRelease(audioTime);
  }

  /**
   * Xử lý gõ phím ký tự trong Typing Section (GĐ5 - Rhythm Typer)
   * Trả về true nếu sự kiện phím được tiêu thụ cho Typing Section
   */
  handleTypingKey(key, audioTime) {
    if (this.isPaused || this.resumeCountdown > 0) return false;
    const travelTime = this.renderer.getTravelTime();

    // Tìm note typing đang trong khoảng hoạt động [time - travelTime, endTime + 300]
    const typingNote = this.notes.find(
      n => n.type === 'typing' &&
      audioTime >= (n.time - travelTime) &&
      audioTime <= (n.endTime + 300) &&
      n.state !== 'JUDGED'
    );

    if (!typingNote) return false;

    // Tìm ký tự PENDING đầu tiên
    const pendingChar = typingNote.chars?.find(c => c.state === 'PENDING');
    if (!pendingChar) return false;

    // Chỉ chặn hoặc xử lý khi đã tới gần ký tự cần gõ (cách tối đa 300ms)
    if (audioTime < pendingChar.time - 300) {
      return false;
    }

    const deltaMs = audioTime - pendingChar.time;
    const goodWindow = JUDGEMENT_CONFIG.windows.good; // 150ms

    const hitPos = this.renderer.getTypingHitLinePos(this.canvas.width, this.canvas.height);

    if (Math.abs(deltaMs) <= goodWindow) {
      if (key.toLowerCase() === pendingChar.char.toLowerCase()) {
        const judgement = getJudgement(deltaMs);
        pendingChar.state = 'JUDGED';
        pendingChar.judgement = judgement;
        pendingChar.deltaMs = deltaMs;

        const res = this.scoreManager.registerJudgement(judgement, 'typing', deltaMs);
        this.audioEngine.playHitsound('normal', 1.0);
        this.renderer.addJudgementPopup(judgement, deltaMs, hitPos.x, hitPos.y);

        if (this.particleSystem) {
          this.particleSystem.spawnBurst(hitPos.x, hitPos.y, '#00e5ff', 14, 90);
          this.particleSystem.spawnRipple(hitPos.x, hitPos.y, '#00e5ff', 40, 0.3, 2.5, false);
        }

        gameEvents.emit('judgement', {
          note: typingNote,
          char: pendingChar,
          judgement,
          deltaMs,
          combo: res.combo,
          achievement: res.achievement
        });

        if (typingNote.chars.every(c => c.state !== 'PENDING')) {
          typingNote.state = 'JUDGED';
        }

        return true;
      } else {
        // Sai ký tự trong khoảng GOOD: break combo nhưng không mất chip (chuẩn SPEC)
        this.scoreManager.breakCombo();
        this.renderer.addJudgementPopup('MISS', deltaMs, hitPos.x, hitPos.y, 'WRONG');
        this.audioEngine.playKeyFeedback();
        return true;
      }
    }

    return true; // Phím được tiêu thụ trong khoảng typing section
  }

  getNearestCandidate(laneId, audioTime, maxWindow) {
    const list = this.notes.filter(n =>
      Number(n.lane) === Number(laneId) &&
      n.state !== 'JUDGED' &&
      n.state !== 'MISSED' &&
      !n.headJudged &&
      Math.abs(audioTime - n.time) <= maxWindow
    );
    if (list.length === 0) return null;
    list.sort((a, b) => Math.abs(audioTime - a.time) - Math.abs(audioTime - b.time));
    return list[0];
  }

  handleLaneDown(lane, audioTime, perfTime, code = null, key = null) {
    if (this.isPaused || this.resumeCountdown > 0) return;

    let targetLane = lane;
    const maxWindow = JUDGEMENT_CONFIG.windows.good || 150;

    // Hỗ trợ xoay Maimai (Spin Assist):
    // Khi chơi chart import từ Maimai, phím 6 và 7 ở giữa thay đổi thành có thể kích hoạt
    // phím 5 (Lane 0) và phím 8 (Lane 2) để thuận tiện cho pattern spin của Maimai.
    // Nếu là chart osu! thì giữ nguyên hoạt động bình thường.
    if (this.isMaimaiChart && this.maimaiSpinAssist !== false && Number(lane) === 1) {
      const cand0 = this.getNearestCandidate(0, audioTime, maxWindow);
      const cand2 = this.getNearestCandidate(2, audioTime, maxWindow);

      const firstLane1Key = this.inputManager?.keybinds?.[1]?.[0];
      const secondLane1Key = this.inputManager?.keybinds?.[1]?.[1];

      const isKey6 = code === 'Digit6' || code === 'Numpad6' || code === 'Key6' || key === '6' || (firstLane1Key && code === firstLane1Key);
      const isKey7 = code === 'Digit7' || code === 'Numpad7' || code === 'Key7' || key === '7' || (secondLane1Key && code === secondLane1Key);

      if (isKey6) {
        // Nút 6 kích hoạt nút 5 (Lane 0); nếu Lane 0 không có nốt nhưng Lane 2 có nốt thì hỗ trợ Lane 2
        targetLane = (cand0 || !cand2) ? 0 : 2;
      } else if (isKey7) {
        // Nút 7 kích hoạt nút 8 (Lane 2); nếu Lane 2 không có nốt nhưng Lane 0 có nốt thì hỗ trợ Lane 0
        targetLane = (cand2 || !cand0) ? 2 : 0;
      } else {
        // Touch cảm ứng / click chuột trên Lane 1: ưu tiên Lane 1 nếu có nốt, nếu không hỗ trợ Lane 0 hoặc Lane 2
        const cand1 = this.getNearestCandidate(1, audioTime, maxWindow);
        if (cand1) {
          targetLane = 1;
        } else if (cand0 && cand2) {
          targetLane = Math.abs(audioTime - cand0.time) <= Math.abs(audioTime - cand2.time) ? 0 : 2;
        } else if (cand0) {
          targetLane = 0;
        } else if (cand2) {
          targetLane = 2;
        } else {
          targetLane = 1;
        }
      }

      // Visual feedback trên cả Lane 1 lẫn targetLane
      if (this.renderer?.activeLanes) {
        this.renderer.activeLanes[1] = true;
        this.renderer.activeLanes[targetLane] = true;
      }
      if (this.inputManager?.isKeyDown) {
        this.inputManager.isKeyDown[1] = true;
        this.inputManager.isKeyDown[targetLane] = true;
      }
    }

    // Tìm note ứng viên trong targetLane này (chưa bị phán định đầu nốt)
    const candidates = this.notes.filter(n =>
      Number(n.lane) === Number(targetLane) &&
      n.state !== 'JUDGED' &&
      n.state !== 'MISSED' &&
      !n.headJudged &&
      Math.abs(audioTime - n.time) <= maxWindow
    );

    if (candidates.length === 0) {
      this.audioEngine.playKeyFeedback();
      return;
    }

    // Sắp xếp ưu tiên nốt có khoảng cách thời gian gần nhất tới audioTime (chống notelock)
    candidates.sort((a, b) => Math.abs(audioTime - a.time) - Math.abs(audioTime - b.time));
    const note = candidates[0];

    // Dọn các nốt cũ hơn còn sót trong cùng lane nếu người chơi đã đánh nốt mới hơn
    for (const older of candidates) {
      if (older !== note && older.time < note.time) {
        this.triggerJudgement(older, 'MISS', 150);
      }
    }

    const deltaMs = audioTime - note.time;
    const judgement = getJudgement(deltaMs);

    if (judgement !== 'MISS') {
      if (note.type === 'tap' || note.type === 'break') {
        this.triggerJudgement(note, judgement, deltaMs);
      } else if (note.type === 'hold') {
        note.headJudged = true;
        note.isHolding = true;
        this.holdingNotes.set(targetLane, note);
        this.triggerJudgement(note, judgement, deltaMs, false);
      }
    }
  }

  handleLaneUp(lane, audioTime, perfTime, code = null, isStillHeld = false) {
    this.checkHoldRelease(lane, audioTime);

    if (this.isMaimaiChart && this.maimaiSpinAssist !== false && Number(lane) === 1) {
      const isKey6 = code === 'Digit6' || code === 'Numpad6' || code === 'Key6';
      const isKey7 = code === 'Digit7' || code === 'Numpad7' || code === 'Key7';
      if (isKey6) {
        this.checkHoldRelease(0, audioTime);
      } else if (isKey7) {
        this.checkHoldRelease(2, audioTime);
      } else {
        this.checkHoldRelease(0, audioTime);
        this.checkHoldRelease(2, audioTime);
      }
    }
    this.resolveRingHoldRelease(audioTime);
  }

  finishRingHold(note, completed) {
    if (!note || !note.isHolding || note.state === 'JUDGED' || note.state === 'MISSED') return;

    note.isHolding = false;
    note.state = completed ? 'JUDGED' : 'MISSED';
    note.tailJudged = completed;
    note.resumeHoldThroughPause = false;

    const judgement = completed ? 'CRITICAL_PERFECT' : 'MISS';
    const deltaMs = completed ? note.holdStartDeltaMs || 0 : 150;
    const result = this.scoreManager.registerJudgement(judgement, 'ring', deltaMs);
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, this.canvas.width, this.canvas.height);
    this.renderer.addJudgementPopup(judgement, deltaMs, originPix.x, originPix.y - 30);

    if (completed) {
      this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 150, 0.5, 5, true);
      this.particleSystem.spawnBurst(originPix.x, originPix.y, '#ffffff', 25, 200, true);
    }

    this.emitJudgement(note, judgement, deltaMs, result);
  }

  resolveRingHoldRelease(audioTime) {
    if (this.isPaused || this.resumeCountdown > 0 || this.isRingHolding()) return;

    const releaseTime = Number.isFinite(audioTime) ? audioTime : this.audioEngine.getSongTimeMs();
    for (const note of this.notes) {
      if (note.type !== 'ring' || !note.isHold || !note.isHolding) continue;
      this.finishRingHold(note, releaseTime >= note.endTime);
    }
  }

  checkHoldRelease(lane, audioTime) {
    const holdNote = this.holdingNotes.get(lane);
    if (!holdNote) return;

    if (audioTime < holdNote.endTime - 150) {
      holdNote.isHolding = false;
      holdNote.isHoldingDropped = true;
      holdNote.state = 'MISSED';
      this.holdingNotes.delete(lane);

      this.scoreManager.registerJudgement('MISS', holdNote.isBreakHold ? 'break' : 'hold', 150);
      const targetLane = getTapLane(lane);
      if (targetLane) {
        const pix = layoutToPixels(targetLane.x, targetLane.y, this.canvas.width, this.canvas.height);
        this.renderer.addJudgementPopup('MISS', 150, pix.x, pix.y);
      }
      gameEvents.emit('holdDrop', { note: holdNote });
    }
  }

  triggerJudgement(note, judgement, deltaMs, finishNote = true) {
    if (finishNote) {
      note.state = judgement === 'MISS' ? 'MISSED' : 'JUDGED';
    }

    const scoreType = note.isBreakHold ? 'break' : note.type;
    const res = this.scoreManager.registerJudgement(judgement, scoreType, deltaMs);

    const targetLane = getTapLane(note.lane);
    if (targetLane) {
      const pix = layoutToPixels(targetLane.x, targetLane.y, this.canvas.width, this.canvas.height);
      this.renderer.addJudgementPopup(judgement, deltaMs, pix.x, pix.y);

      if (judgement !== 'MISS') {
        if (scoreType === 'break') {
          // Sóng kích nổ kép màu cam đỏ rực rỡ + pháo hoa ngôi sao maimai Break
          this.particleSystem.spawnRipple(pix.x, pix.y, '#ff3d00', 85, 0.45, 4.0, true);
          this.particleSystem.spawnRipple(pix.x, pix.y, '#ffea00', 55, 0.32, 2.5, false);
          this.particleSystem.spawnBurst(pix.x, pix.y, '#ffea00', 28, 200, true);
          this.audioEngine.playHitsound('break', 1.0);
        } else {
          // Tap / Hold hitsound & shockwave ripples theo cấp phán định chuẩn maimai DX
          if (judgement === 'CRITICAL_PERFECT') {
            this.particleSystem.spawnRipple(pix.x, pix.y, '#ffd54f', 65, 0.38, 3.0, true);
            this.particleSystem.spawnBurst(pix.x, pix.y, '#ffffff', 18, 160);
          } else if (judgement === 'PERFECT') {
            this.particleSystem.spawnRipple(pix.x, pix.y, '#ff4081', 52, 0.32, 2.5, false);
            this.particleSystem.spawnBurst(pix.x, pix.y, '#ff4081', 14, 140);
          } else if (judgement === 'GREAT') {
            this.particleSystem.spawnRipple(pix.x, pix.y, '#00e676', 42, 0.28, 2.0, false);
            this.particleSystem.spawnBurst(pix.x, pix.y, '#00e676', 8, 110);
          } else if (judgement === 'GOOD') {
            this.particleSystem.spawnRipple(pix.x, pix.y, '#ff9100', 35, 0.24, 1.5, false);
            this.particleSystem.spawnBurst(pix.x, pix.y, '#ff9100', 6, 90);
          }
          this.audioEngine.playHitsound('normal', 1.0);
        }
      }
    }

    gameEvents.emit('judgement', {
      note,
      judgement,
      deltaMs,
      combo: res.combo,
      achievement: res.achievement
    });
  }

  /**
   * Xác định Lane gần nhất theo tọa độ pixel canvas với Hitbox mở rộng cho mobile chuẩn AstroDX / Maimai:
   * 1. Ưu tiên điểm chạm trực tiếp vào nút hoặc gần nút.
   * 2. Mở rộng vùng cảm ứng theo cánh quạt (Radial Sector) từ vòng trong kéo dài ra tới tận mép màn hình.
   * 3. Vùng tâm (Center Touch / Ring zone) bán kính < 0.38 * scale không nhận lane để kích hoạt nốt Ring.
   */
  getLaneAtPos(px, py, width, height) {
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, width, height);
    const { scale } = getLayoutMetrics(width, height);
    const laneRadiusPx = TRI_RING_LAYOUT.tapDimensions.radius * scale;

    // 1. Kiểm tra trực tiếp khoảng cách tới từng nút bấm (ưu tiên trúng nút trực tiếp)
    let closestDirectLane = -1;
    let minDirectDist = Infinity;
    for (let i = 0; i < TRI_RING_LAYOUT.tapLanes.length; i++) {
      const laneDef = TRI_RING_LAYOUT.tapLanes[i];
      const lanePix = layoutToPixels(laneDef.x, laneDef.y, width, height);
      const dist = Math.hypot(px - lanePix.x, py - lanePix.y);
      if (dist < minDirectDist) {
        minDirectDist = dist;
        closestDirectLane = i;
      }
    }

    // Nếu bấm rất gần tâm nút (<= laneRadiusPx * 2.2 hoặc <= 75px), kích hoạt ngay lane đó
    if (closestDirectLane !== -1 && minDirectDist <= Math.max(laneRadiusPx * 2.2, 75)) {
      return closestDirectLane;
    }

    // 2. Phân vùng cánh quạt (Radial Sector Hitbox) chuẩn AstroDX / Maimai Mobile
    const dx = px - originPix.x;
    const dy = py - originPix.y;
    const distFromOrigin = Math.hypot(dx, dy);

    // Vùng tâm (Center Touch / Ring zone): bán kính nhỏ hơn 0.38 * scale
    // Không nhận diện là lane để nhường cho nốt Ring / Center Touch
    const innerRingRadius = 0.38 * scale;
    if (distFromOrigin < innerRingRadius) {
      return null;
    }

    // Bất kỳ điểm chạm nào từ innerRingRadius trở ra ngoài (kéo dài tới tận mép màn hình/canvas)
    // đều được ánh xạ vào sector cánh quạt của lane tương ứng
    const touchAngle = Math.atan2(dy, dx);

    let bestLane = -1;
    let minAngleDiff = Infinity;

    for (let i = 0; i < TRI_RING_LAYOUT.tapLanes.length; i++) {
      const laneDef = TRI_RING_LAYOUT.tapLanes[i];
      const sector = TRI_RING_LAYOUT.sectors ? TRI_RING_LAYOUT.sectors[i] : null;
      let laneAngle;
      if (sector && sector.centerAngle !== undefined) {
        laneAngle = sector.centerAngle;
      } else {
        const lanePix = layoutToPixels(laneDef.x, laneDef.y, width, height);
        laneAngle = Math.atan2(lanePix.y - originPix.y, lanePix.x - originPix.x);
      }

      const diff = Math.abs(normalizeAngle ? normalizeAngle(touchAngle - laneAngle) : (touchAngle - laneAngle));

      if (diff < minAngleDiff) {
        minAngleDiff = diff;
        bestLane = i;
      }
    }

    return bestLane !== -1 ? bestLane : null;
  }

  /**
   * Xử lý tương tác ngón tay (Touch / Pointer) trên mobile & màn hình cảm ứng:
   * 1. Hỗ trợ đa chạm (Multi-touch): nhiều ngón tay bấm / giữ nốt đồng thời.
   * 2. Bấm trúng ô Tap: phán định nốt trên Lane tương ứng.
   * 3. Yêu cầu: "note ring chỉ cần bấm vào judgement bất kì cũng có thể kích hoạt"
   */
  handlePointerDown(e) {
    if (!this.canvas || !this.isRunning || this.isPaused) return;
    if (e.cancelable && e.preventDefault) {
      e.preventDefault();
    }

    try {
      if (this.canvas.setPointerCapture && e.pointerId !== undefined) {
        this.canvas.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    const rect = this.canvas.getBoundingClientRect
      ? this.canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: this.canvas.width || 720, height: this.canvas.height || 620 };
    const width = this.canvas.width || 720;
    const height = this.canvas.height || 620;
    const scaleX = rect.width > 0 ? (width / rect.width) : 1;
    const scaleY = rect.height > 0 ? (height / rect.height) : 1;

    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    this.inputManager.pointerPos = { x: px, y: py };
    this.inputManager.isPointerDown = true;

    const perfTime = e.timeStamp || performance.now();
    const audioTime = e.audioTime !== undefined
      ? e.audioTime
      : (this.audioEngine ? this.audioEngine.perfToAudioTime(perfTime) : performance.now());

    // 1. Chạm để skip intro nếu đang ở đoạn nghỉ đầu bài
    if (this.canSkipBreak(audioTime)) {
      this.skipBreak(audioTime);
      return;
    }

    // 2. Tìm ô Lane theo vị trí chạm
    const assignedLane = this.getLaneAtPos(px, py, width, height);
    const isTapOnLane = assignedLane !== null;

    const pId = e.pointerId !== undefined ? e.pointerId : 1;
    this.activeTouchPointers.set(pId, {
      lane: assignedLane,
      px,
      py,
      startTime: audioTime
    });

    // 3. Phán định nốt trên Lane nếu chạm vào nút tương ứng
    if (assignedLane !== null) {
      this.inputManager.isKeyDown[assignedLane] = true;
      this.handleLaneDown(assignedLane, audioTime, perfTime);
    }

    // 4. Yêu cầu: "note ring chỉ cần bấm vào judgement bất kì cũng có thể kích hoạt"
    const maxWindow = JUDGEMENT_CONFIG.windows.good || 150;
    const hasRingInWindow = this.notes.some(n =>
      (n.type === 'ring' || n.type === 'slide') &&
      n.state !== 'JUDGED' &&
      n.state !== 'MISSED' &&
      !n.headJudged &&
      Math.abs(audioTime - n.time) <= maxWindow
    );

    // Bấm vào bất kì nút judgement nào (0..8) hoặc chạm vào khung/tâm đều kích hoạt phán định nốt Ring
    if (hasRingInWindow || assignedLane === null) {
      this.inputManager.isSpaceDown = true;
      this.handleSpaceDown(audioTime, perfTime);
    } else {
      this.inputManager.isSpaceDown = true;
    }

    // 5. Hiệu ứng sóng nước tương tác ngón tay
    this.particleSystem.spawnRipple(
      px,
      py,
      isTapOnLane ? '#ff85a2' : '#ffffff',
      isTapOnLane ? 55 : 40,
      0.25,
      2.0
    );

    gameEvents.emit('touchFeedback', { lane: assignedLane, px, py });
  }

  handlePointerMove(e) {
    if (!this.canvas || !this.isRunning || this.isPaused) return;
    const rect = this.canvas.getBoundingClientRect
      ? this.canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: this.canvas.width || 720, height: this.canvas.height || 620 };
    const width = this.canvas.width || 720;
    const height = this.canvas.height || 620;
    const scaleX = rect.width > 0 ? (width / rect.width) : 1;
    const scaleY = rect.height > 0 ? (height / rect.height) : 1;

    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    this.inputManager.pointerPos = { x: px, y: py };

    const pId = e.pointerId !== undefined ? e.pointerId : 1;
    const ptr = this.activeTouchPointers.get(pId);
    if (!ptr) return;

    ptr.px = px;
    ptr.py = py;

    const perfTime = e.timeStamp || performance.now();
    const audioTime = e.audioTime !== undefined
      ? e.audioTime
      : (this.audioEngine ? this.audioEngine.perfToAudioTime(perfTime) : performance.now());

    // Yêu cầu: cho phép mobile tự do "quẹt" được trên các judgement
    const newLane = this.getLaneAtPos(px, py, width, height);
    const prevLane = ptr.lane;

    if (newLane !== prevLane) {
      // 1. Nếu ngón tay trượt ra khỏi lane trước đó -> nhả lane cũ nếu không còn ngón tay nào khác giữ
      if (prevLane !== null) {
        ptr.lane = null;
        const stillHeld = Array.from(this.activeTouchPointers.values()).some(p => p.lane === prevLane);
        if (!stillHeld) {
          this.inputManager.isKeyDown[prevLane] = false;
          this.handleLaneUp(prevLane, audioTime, perfTime);
        }
      }

      // 2. Nếu ngón tay quẹt trúng lane mới -> kích hoạt phán định lane mới
      if (newLane !== null) {
        ptr.lane = newLane;
        this.inputManager.isKeyDown[newLane] = true;
        this.handleLaneDown(newLane, audioTime, perfTime);

        // Kiểm tra xem có Ring note trong cửa sổ phán định khi quẹt qua judgement không
        const maxWindow = JUDGEMENT_CONFIG.windows.good || 150;
        const hasRingInWindow = this.notes.some(n =>
          (n.type === 'ring' || n.type === 'slide') &&
          n.state !== 'JUDGED' &&
          n.state !== 'MISSED' &&
          !n.headJudged &&
          Math.abs(audioTime - n.time) <= maxWindow
        );
        if (hasRingInWindow) {
          this.inputManager.isSpaceDown = true;
          this.handleSpaceDown(audioTime, perfTime);
        }

        // Hiệu ứng sóng nước tương tác khi quẹt trúng nút
        this.particleSystem.spawnRipple(px, py, '#ff85a2', 55, 0.25, 2.0);
        gameEvents.emit('touchFeedback', { lane: newLane, px, py });
      }
    }
  }

  handlePointerUp(e) {
    if (!this.canvas) return;
    try {
      if (this.canvas.releasePointerCapture && e.pointerId !== undefined) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    const pId = e.pointerId !== undefined ? e.pointerId : 1;
    const ptr = this.activeTouchPointers.get(pId);
    const perfTime = e.timeStamp || performance.now();
    const audioTime = e.audioTime !== undefined
      ? e.audioTime
      : (this.audioEngine ? this.audioEngine.perfToAudioTime(perfTime) : performance.now());

    if (ptr && ptr.lane !== null) {
      const lane = ptr.lane;
      this.activeTouchPointers.delete(pId);

      // Kiểm tra xem còn ngón tay nào khác cũng đang giữ trên lane này không
      const stillHasFingerOnLane = Array.from(this.activeTouchPointers.values()).some(p => p.lane === lane);
      if (!stillHasFingerOnLane) {
        this.inputManager.isKeyDown[lane] = false;
        this.handleLaneUp(lane, audioTime, perfTime);
      }
    } else {
      this.activeTouchPointers.delete(pId);
    }

    if (this.activeTouchPointers.size === 0) {
      this.inputManager.isPointerDown = false;
      this.inputManager.isSpaceDown = false;
      if (!this.isPaused && this.resumeCountdown <= 0) {
        for (const note of this.notes) {
          if (note.resumeHoldThroughPause) note.resumeHoldThroughPause = false;
        }
      }
    }
    this.resolveRingHoldRelease(audioTime);
  }

  togglePause() {
    if (!this.isRunning) return;

    if (this.isCountdown) {
      this.pausedCountdownType = this.countdownType;
      this.cancelCountdown();
      this.isPaused = true;
      this.inputManager.reset();
      this.activeTouchPointers.clear();
      gameEvents.emit('pause');
      return;
    }

    if (this.isPaused) {
      this.isPaused = false;
      this.isCountdown = true;
      this.countdownType = this.pausedCountdownType || 'RESUME';
      this.resumeCountdown = 3.4;
      this.lastCountdownStep = -1;
      for (const note of this.notes) {
        if ((note.type === 'ring' || note.type === 'slide') && note.isHolding) {
          note.resumeHoldThroughPause = true;
        }
      }
      gameEvents.emit('countdownStart', { type: this.countdownType });
    } else {
      this.isPaused = true;
      this.audioEngine.pauseMusic();
      this.inputManager.reset();
      this.activeTouchPointers.clear();
      this.pausedCountdownType = null;
      gameEvents.emit('pause');
    }
  }

  handleVisibilityChange(isHidden) {
    if (isHidden && this.isRunning && !this.isPaused) {
      this.togglePause();
    }
  }

  renderCountdown() {
    const { ctx, canvas } = this.renderer;
    if (!ctx || !ctx.fillRect || !canvas) return;
    const width = canvas.width || 800;
    const height = canvas.height || 600;

    // 1. Dựng nền sân đấu tĩnh ở thời điểm đóng băng để người chơi nhìn thấy nốt sắp tới
    const frozenTime = this.countdownType === 'START'
      ? (this.countdownStartOffset || 0) * 1000
      : (this.audioEngine.pausedAt || 0) * 1000;

    const gameState = {
      songTime: frozenTime,
      totalDuration: this.totalDuration,
      canSkip: false,
      combo: this.scoreManager.combo,
      comboPunch: 0,
      achievement: this.scoreManager.achievement,
      rank: this.scoreManager.rank,
      rankColor: this.scoreManager.getRankColor(),
      ur: this.scoreManager.ur,
      activeLanes: this.inputManager.isKeyDown,
      holdingLanes: this.getHoldingLanesArray(),
      activeNotes: this.getActiveNotes(frozenTime),
      pointer: {
        pos: this.inputManager.pointerPos,
        isDown: this.inputManager.isPointerDown
      },
      hasBackgroundVideo: Boolean(this.hasBackgroundVideo),
      isAutoplay: Boolean(this.isAutoplay),
      isTypingActive: false,
      activeTypingSection: null
    };

    if (ctx.clearRect) {
      try {
        this.renderer.render(gameState, this.particleSystem);
      } catch (_) {}
    }

    // 2. Lớp phủ vignette mờ nhẹ
    ctx.save();
    ctx.fillStyle = 'rgba(9, 9, 18, 0.45)';
    ctx.fillRect(0, 0, width, height);

    // 3. Tọa độ tâm tam giác
    const originPix = layoutToPixels(
      TRI_RING_LAYOUT.origin.x,
      TRI_RING_LAYOUT.origin.y,
      width,
      height
    );

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let text = '';
    let scale = 1.0;
    let alpha = 1.0;
    let color = '#ff66ab';
    let subtext = 'READY';

    if (this.resumeCountdown > 2.4) {
      text = '3';
      const stepProg = (this.resumeCountdown - 2.4) / 1.0;
      scale = 1.0 + Math.pow(stepProg, 1.8) * 0.45;
      alpha = Math.min(1.0, stepProg * 2.2);
    } else if (this.resumeCountdown > 1.4) {
      text = '2';
      const stepProg = (this.resumeCountdown - 1.4) / 1.0;
      scale = 1.0 + Math.pow(stepProg, 1.8) * 0.45;
      alpha = Math.min(1.0, stepProg * 2.2);
    } else if (this.resumeCountdown > 0.4) {
      text = '1';
      const stepProg = (this.resumeCountdown - 0.4) / 1.0;
      scale = 1.0 + Math.pow(stepProg, 1.8) * 0.45;
      alpha = Math.min(1.0, stepProg * 2.2);
    } else {
      text = 'GO!';
      color = '#ffdd57';
      subtext = '';
      const goProg = this.resumeCountdown / 0.4;
      scale = 1.0 + Math.pow(goProg, 1.4) * 0.35;
      alpha = Math.min(1.0, goProg * 3.0);
    }

    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = `900 ${Math.round(88 * scale)}px 'Torus', 'Nunito', 'Be Vietnam Pro', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 32;
    ctx.fillText(text, originPix.x, originPix.y);

    if (subtext) {
      ctx.font = `bold 12px 'Torus', 'Nunito', sans-serif`;
      ctx.fillStyle = 'rgba(255, 102, 171, 0.85)';
      ctx.shadowBlur = 10;
      ctx.fillText(subtext, originPix.x, originPix.y + 62);
    }

    ctx.restore();
  }

  getActiveNotes(songTime) {
    const travelTime = this.renderer.getTravelTime();
    const ringTravelTime = this.renderer.getRingTravelTime ? this.renderer.getRingTravelTime() : travelTime;
    const maxTravelTime = Math.max(travelTime, ringTravelTime);
    const spawnTime = songTime + maxTravelTime;
    const active = [];
    const notes = this.notes;
    const len = notes.length;

    for (let i = 0; i < len; i++) {
      const n = notes[i];
      // Note quá xa trong tương lai (chưa tới lúc spawn)
      if (n.time > spawnTime + 100) {
        // Nếu chart đã được sort theo time, có thể break sớm sau vùng spawn
        continue;
      }
      const noteTravelTime = (n.type === 'ring' || n.type === 'slide') ? ringTravelTime : travelTime;
      if (n.state === 'ACTIVE' || (n.state === 'PENDING' && songTime >= n.time - noteTravelTime)) {
        active.push(n);
      } else if (n.state === 'MISSED' && (songTime - (n.time - noteTravelTime)) / noteTravelTime <= 1.12) {
        active.push(n);
      }
    }
    return active;
  }

  getHoldingLanesArray() {
    const res = new Array(9).fill(false);
    for (const [lane, note] of this.holdingNotes.entries()) {
      if (note.isHolding) res[lane] = true;
    }
    return res;
  }

  finishGame() {
    this.stop();
    const summary = this.scoreManager.getSummary();
    gameEvents.emit('songEnd', { summary, beatmap: this.beatmap });
  }

  stop() {
    this.lifecycleVersion++;
    this.cancelCountdown();
    this.isRunning = false;
    this.isPaused = false;
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animFrameId);
      }
      this.animFrameId = null;
    }
    if (this.canvas && this.boundPointerDown) {
      if (this.canvas.removeEventListener) {
        this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.canvas.removeEventListener('pointermove', this.boundPointerMove);
        this.canvas.removeEventListener('pointerup', this.boundPointerUp);
        this.canvas.removeEventListener('pointercancel', this.boundPointerCancel);
        this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerup', this.boundPointerUp);
        window.removeEventListener('pointercancel', this.boundPointerCancel);
      }
    }
    this.activeTouchPointers.clear();
    this.audioEngine.stopMusic();
    this.inputManager.detach();
    this.inputManager.reset();
    this.holdingNotes.clear();
  }
}
