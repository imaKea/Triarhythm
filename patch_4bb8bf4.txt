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
import { TRI_RING_LAYOUT, layoutToPixels, getLayoutMetrics, getTapLane } from '../../config/layout.config.js';
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
    this.totalDuration = 0;

    // Trạng thái vòng lặp
    this.animFrameId = null;
    this.isRunning = false;
    this.isPaused = false;
    this.lastFramePerfTime = 0;
    this.resyncIntervalMs = 1500;
    this.lastResyncTime = 0;

    // Đếm ngược 3-2-1 khi bắt đầu hoặc tiếp tục (P3 osu! lazer style)
    this.resumeCountdown = 0;
    this.isCountdown = false;
    this.countdownType = null; // 'START' | 'RESUME'
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

    // Thiết lập input callbacks
    this.inputManager.onLaneDown = this.handleLaneDown.bind(this);
    this.inputManager.onLaneUp = this.handleLaneUp.bind(this);
    this.inputManager.onSpaceDown = this.handleSpaceDown.bind(this);
    this.inputManager.onTypingKey = this.handleTypingKey.bind(this);
    this.inputManager.onPause = this.togglePause.bind(this);

    // Chế độ tự động chơi (Autoplay) để test
    this.isAutoplay = false;

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
    const isMaimai = beatmap.metadata?.source === 'maimai' || beatmap.source === 'maimai';

    // Maimai giữ 100% nốt theo chuẩn chart gốc; osu mania áp dụng bộ lọc 2 ngón tay
    const rawNotes = isMaimai ? (beatmap.notes || []) : this.enforceTwoFingerConstraint(beatmap.notes || [], beatLength);
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

    this.notes = processed;
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

    await this.audioEngine.init();
    this.inputManager.attach();

    // Lắng nghe di chuyển và nhấn chuột/pointer trên Canvas để theo dõi Slide Note
    if (this.canvas) {
      this.boundPointerMove = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.inputManager.pointerPos = {
          x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
          y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
      };
      this.boundPointerDown = (e) => {
        this.inputManager.isPointerDown = true;
        this.boundPointerMove(e);
        this.checkSlideGrab(this.inputManager.pointerPos);
      };
      this.boundPointerUp = () => {
        this.inputManager.isPointerDown = false;
        // Thả chuột -> nhả grab của các slide
        for (const note of this.notes) {
          if (note.type === 'slide') {
            note.isGrabbed = false;
          }
        }
      };
      if (this.canvas.addEventListener) {
        this.canvas.addEventListener('pointermove', this.boundPointerMove);
        this.canvas.addEventListener('pointerdown', this.boundPointerDown);
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', this.boundPointerUp);
      }
    }

    const useCountdown = withCountdown && (this.enableStartCountdown !== false);

    if (useCountdown) {
      this.isRunning = true;
      this.isPaused = false;
      this.isCountdown = true;
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
      this.animFrameId = requestAnimationFrame(this.loop.bind(this));
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
  }

  /**
   * Hủy đếm ngược an toàn (ví dụ khi Pause hoặc Stop giữa chừng)
   */
  cancelCountdown() {
    this.isCountdown = false;
    this.resumeCountdown = 0;
    this.lastCountdownStep = -1;
    this.countdownType = null;
    this.hasStartedAudio = false;
  }

  updateNotes(songTime) {
    const travelTime = this.renderer.getTravelTime();
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, this.canvas.width, this.canvas.height);

    for (const note of this.notes) {
      if (note.state === 'JUDGED' || note.state === 'MISSED') continue;

      if (note.state === 'PENDING' && songTime >= note.time - travelTime) {
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
            this.audioEngine.playHitsound('normal', 0.9);
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
              this.audioEngine.playHitsound('normal', 0.9);
            }
          }
        } else if (note.type === 'ring' || note.type === 'slide') {
          const isHoldRing = Boolean(note.isHold && note.endTime && note.endTime > note.time);
          if (!isHoldRing) {
            // Người chơi giữ phím SPACE: tự động phán định nốt Ring hoàn hảo khi nốt tới tâm receptor
            if (this.inputManager?.isSpaceDown && songTime >= note.time && Math.abs(songTime - note.time) <= 50) {
              this.judgeRingNote(note, note.time, originPix);
              continue;
            }

            // Nốt Ring tự động MISS nếu quá hạn missWindow mà người chơi không nhấn SPACE
            if (songTime > note.time + missWindow) {
              note.state = 'MISSED';
              this.scoreManager.registerJudgement('MISS', 'ring', missWindow);
              this.renderer.addJudgementPopup('MISS', missWindow, originPix.x, originPix.y - 30);
            }
          } else {
            // Xử lý nốt Hold Ring (Spacebar hold với hiệu ứng viền cầu vồng như Rhythm Typer)
            if (!note.headJudged) {
              // Bắt đầu bấm hoặc giữ Space khi nốt tới
              if (this.inputManager?.isSpaceDown && songTime >= note.time - 50) {
                note.headJudged = true;
                note.isHolding = true;
                const deltaMs = Math.round(songTime - note.time);
                const judgement = getJudgement(deltaMs);
                this.scoreManager.registerJudgement(judgement, 'ring', deltaMs);
                this.renderer.addJudgementPopup(judgement, deltaMs, originPix.x, originPix.y - 30);
                this.audioEngine.playHitsound('ring-hold', 1.0);
                this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 120, 0.45, 4, true);
              } else if (songTime > note.time + missWindow) {
                note.state = 'MISSED';
                this.scoreManager.registerJudgement('MISS', 'ring', missWindow);
                this.renderer.addJudgementPopup('MISS', missWindow, originPix.x, originPix.y - 30);
              }
            }

            if (note.isHolding) {
              if (this.inputManager?.isSpaceDown) {
                // Đang giữ Space: phát hiệu ứng hào quang & hạt lấp lánh xanh lá
                if (Math.random() < 0.35) {
                  this.particleSystem.spawnBurst(originPix.x, originPix.y, '#00e676', 2, 70, true);
                }

                // Giữ thành công tới hết nốt Hold Ring (kết thúc không phát lại sound effect)
                if (songTime >= note.endTime - 80) {
                  note.tailJudged = true;
                  note.isHolding = false;
                  note.state = 'JUDGED';
                  const res = this.scoreManager.registerJudgement('PERFECT', 'ring', 0);
                  this.renderer.addJudgementPopup('PERFECT', 0, originPix.x, originPix.y - 30);
                  this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 150, 0.5, 5, true);
                  this.particleSystem.spawnBurst(originPix.x, originPix.y, '#ffffff', 25, 200, true);
                  gameEvents.emit('judgement', {
                    note,
                    judgement: 'PERFECT',
                    deltaMs: 0,
                    combo: res.combo,
                    achievement: res.achievement
                  });
                }
              } else {
                // Nhả phím Space sớm
                if (songTime < note.endTime - 120) {
                  note.isHolding = false;
                  note.state = 'MISSED';
                  this.scoreManager.registerJudgement('MISS', 'ring', 150);
                  this.renderer.addJudgementPopup('MISS', 150, originPix.x, originPix.y - 30);
                }
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
    const judgement = getJudgement(deltaMs);

    const res = this.scoreManager.registerJudgement(judgement, 'ring', deltaMs);

    const targetOrigin = originPix || layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, this.canvas.width, this.canvas.height);
    this.renderer.addJudgementPopup(judgement, deltaMs, targetOrigin.x, targetOrigin.y - 30);

    if (judgement !== 'MISS') {
      this.audioEngine.playHitsound('ring', 1.0);
      this.particleSystem.spawnRipple(targetOrigin.x, targetOrigin.y, '#00e5ff', 120, 0.45, 4, true);
      this.particleSystem.spawnBurst(targetOrigin.x, targetOrigin.y, '#ffffff', 25, 180, true);
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
        this.scoreManager.registerJudgement('MISS', 'ring', 150);
      }
    }

    if (targetNote.isHold && targetNote.endTime && targetNote.endTime > targetNote.time) {
      if (!targetNote.headJudged) {
        targetNote.headJudged = true;
        targetNote.isHolding = true;
        const deltaMs = Math.round(audioTime - targetNote.time);
        const judgement = getJudgement(deltaMs);
        this.scoreManager.registerJudgement(judgement, 'ring', deltaMs);
        this.renderer.addJudgementPopup(judgement, deltaMs, originPix.x, originPix.y - 30);
        this.audioEngine.playHitsound('ring-hold', 1.0);
        this.particleSystem.spawnRipple(originPix.x, originPix.y, '#00e676', 120, 0.45, 4, true);
      }
    } else {
      this.judgeRingNote(targetNote, audioTime, originPix);
    }
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

  handleLaneDown(lane, audioTime, perfTime) {
    if (this.isPaused || this.resumeCountdown > 0) return;

    const maxWindow = JUDGEMENT_CONFIG.windows.good || 150;

    // Tìm note ứng viên trong lane này (chưa bị phán định đầu nốt)
    const candidates = this.notes.filter(n =>
      Number(n.lane) === Number(lane) &&
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
        this.holdingNotes.set(lane, note);
        this.triggerJudgement(note, judgement, deltaMs, false);
      }
    }
  }

  handleLaneUp(lane, audioTime, perfTime) {
    const holdNote = this.holdingNotes.get(lane);
    if (!holdNote) return;

    if (audioTime < holdNote.endTime - 150) {
      holdNote.isHolding = false;
      holdNote.isHoldingDropped = true;
      holdNote.state = 'MISSED';
      this.holdingNotes.delete(lane);

      this.scoreManager.registerJudgement('MISS', 'hold', 150);
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

    const res = this.scoreManager.registerJudgement(judgement, note.type, deltaMs);

    const targetLane = getTapLane(note.lane);
    if (targetLane) {
      const pix = layoutToPixels(targetLane.x, targetLane.y, this.canvas.width, this.canvas.height);
      this.renderer.addJudgementPopup(judgement, deltaMs, pix.x, pix.y);

      if (judgement !== 'MISS') {
        if (note.type === 'break') {
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

  togglePause() {
    if (!this.isRunning) return;

    if (this.isCountdown) {
      // Hủy countdown an toàn khi bấm Esc lúc đang đếm ngược
      this.cancelCountdown();
      this.isPaused = true;
      gameEvents.emit('pause');
      return;
    }

    if (this.isPaused) {
      this.isPaused = false;
      this.isCountdown = true;
      this.countdownType = 'RESUME';
      this.resumeCountdown = 3.4;
      this.lastCountdownStep = -1;
      gameEvents.emit('countdownStart', { type: 'RESUME' });
    } else {
      this.isPaused = true;
      this.audioEngine.pauseMusic();
      gameEvents.emit('pause');
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
    return this.notes.filter(n =>
      (n.state === 'ACTIVE' || (n.state === 'PENDING' && songTime >= n.time - travelTime)) ||
      (n.state === 'MISSED' && (songTime - (n.time - travelTime)) / travelTime <= 1.12)
    );
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
    this.cancelCountdown();
    this.isRunning = false;
    this.isPaused = false;
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animFrameId);
      }
      this.animFrameId = null;
    }
    if (this.canvas && this.boundPointerMove) {
      if (this.canvas.removeEventListener) {
        this.canvas.removeEventListener('pointermove', this.boundPointerMove);
        this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerup', this.boundPointerUp);
      }
    }
    this.audioEngine.stopMusic();
    this.inputManager.detach();
    this.holdingNotes.clear();
  }
}
