import React, { useRef, useEffect, useState } from 'react';
import { GameEngine, gameEvents, audioEngine } from '../core/engine/index.js';
import { SAMPLE_BEATMAP } from '../core/beatmap/sampleChart.js';
import { parseOsu } from '../core/parser/index.js';
import { buildScoreRecord, persistScoreResult } from '../core/storage/scoreService.js';
import { calculateStars, calculatePP } from '../core/pp/ppCalculator.js';
import { normalizeMaimaiCategory, calculateMaimaiRating } from '../core/beatmap/maimaiDifficulty.js';
import { Button, StarRating, DifficultyBadge, RankBadge, playHover, playClick, playBack } from '../ui/index.js';
import AstroResultScreen from './AstroResultScreen.jsx';

export default function GameplayView({
  initialChart = null,
  settings = null,
  currentUser = null,
  onBackToSelect = null,
  onOpenSettings = null,
  onUploadFiles = null
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const videoObjectUrlRef = useRef(null);
  const engineRef = useRef(null);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Tự động mở rộng canvas phủ trọn vẹn màn hình thiết bị (loại bỏ vùng chết ở 2 bên mép trên mobile)
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width) || window.innerWidth || 960;
      const h = Math.round(rect.height) || window.innerHeight || 640;
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('orientationchange', updateCanvasSize);
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('orientationchange', updateCanvasSize);
    };
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [showRotateHint, setShowRotateHint] = useState(true);

  // Check mobile portrait orientation
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth < 820;
      setIsPortrait(portrait);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Live HUD States
  const [liveScore, setLiveScore] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100.0);
  const [liveCombo, setLiveCombo] = useState(0);

  // Key Overlay State: lane 0..8 + ring
  const [keyPressCounts, setKeyPressCounts] = useState({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, ring: 0
  });
  const [activePressedLanes, setActivePressedLanes] = useState(new Set());

  // Pause Menu Keyboard Index: 0: Continue, 1: Retry, 2: Back
  const [pauseMenuIndex, setPauseMenuIndex] = useState(0);

  // Metadata
  const [activeChartName, setActiveChartName] = useState('Beyond The Æxis');
  const [activeArtist, setActiveArtist] = useState('');
  const [activeDiffName, setActiveDiffName] = useState('');
  const [activeStars, setActiveStars] = useState(5.0);
  const [coverUrl, setCoverUrl] = useState(null);

  const [noteSpeed, setNoteSpeed] = useState(settings?.noteSpeed ?? 10.0);
  const [ringNoteSpeed, setRingNoteSpeed] = useState(settings?.ringNoteSpeed ?? settings?.noteSpeed ?? 10.0);
  const [userOffset, setUserOffset] = useState(settings?.userOffset ?? 0);
  const [musicVol, setMusicVol] = useState(settings?.musicVol ?? 85);
  const [hitVol, setHitVol] = useState(settings?.hitVol ?? 95);

  // Video Background & Dim
  const [videoSrc, setVideoSrc] = useState(null);
  const [showVideo, setShowVideo] = useState(settings?.showVideo !== false);
  const [backgroundDim, setBackgroundDim] = useState(settings?.backgroundDim ?? 0.75);

  // Autoplay
  const [isAutoplay, setIsAutoplay] = useState(settings?.isAutoplay ?? false);

  // Initialize GameEngine
  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    engine.renderer.noteSpeed = settings?.noteSpeed ?? 10.0;
    engine.renderer.ringNoteSpeed = settings?.ringNoteSpeed ?? settings?.noteSpeed ?? 10.0;
    engine.maimaiSpinAssist = settings?.maimaiSpinAssist !== false;

    if (settings?.customKeybinds) {
      engine.inputManager.setKeybinds(settings.customKeybinds);
      engine.renderer.customKeybinds = settings.customKeybinds;
    }

    engine.onSyncVideo = (sec) => {
      if (videoRef.current) {
        try { videoRef.current.currentTime = sec; } catch (e) {}
      }
    };

    engine.onCountdownEnd = () => {
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = 0;
          videoRef.current.pause();
        } catch (_) {}
      }
    };

    engine.onMusicStart = (sec) => {
      if (videoRef.current && showVideo) {
        try {
          videoRef.current.currentTime = sec || 0;
          videoRef.current.play().catch(() => {});
        } catch (_) {}
      }
    };

    const offPause = gameEvents.on('pause', () => {
      setIsPaused(true);
      setPauseMenuIndex(0);
    });
    const handleVisibilityChange = () => {
      engine.handleVisibilityChange(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const offSkip = gameEvents.on('canSkipBreak', ({ canSkip }) => setCanSkip(Boolean(canSkip)));

    const offTouch = gameEvents.on('touchFeedback', ({ lane }) => {
      const targetKey = lane !== null && lane !== undefined ? String(lane) : 'ring';
      setActivePressedLanes((prev) => new Set([...prev, targetKey]));
      setKeyPressCounts((prev) => ({
        ...prev,
        [targetKey]: (prev[targetKey] || 0) + 1
      }));
      setTimeout(() => {
        setActivePressedLanes((prev) => {
          const next = new Set(prev);
          next.delete(targetKey);
          return next;
        });
      }, 140);
    });

    const offJudgement = gameEvents.on('judgement', (data) => {
      if (data?.combo !== undefined) setLiveCombo(data.combo);
      if (data?.achievement !== undefined) {
        setLiveAccuracy(data.achievement);
        setLiveScore(Math.round(data.achievement * 10000));
      }
    });

    const offEnd = gameEvents.on('songEnd', async ({ summary }) => {
      setIsPlaying(false);

      try {
        const beatmap = engine.beatmap || initialChart?.beatmap || initialChart || {};
        const stars = calculateStars(beatmap);
        if (engine.isAutoplay) {
          setGameResult({ ...summary, stars, pp: 0 });
          return;
        }

        const missCount = summary?.counts?.miss || 0;
        const noteCount = beatmap?.notes?.length || 0;
        const pp = calculatePP({
          stars,
          achievement: summary?.achievement || 0,
          missCount,
          noteCount
        });

        const record = buildScoreRecord({
          summary,
          user: currentUserRef.current,
          chart: {
            beatmap,
            id: initialChart?.id,
            title: initialChart?.title,
            difficultyName: initialChart?.difficultyName
          },
          isAutoplay: false,
          stars,
          pp
        });

        setGameResult({ ...summary, score: record.score, stars, pp });

        const persisted = await persistScoreResult(record);
        setGameResult((prev) => (prev ? {
          ...prev,
          sync: {
            ...persisted.mysql,
            localSaved: persisted.localId !== null && persisted.localId !== undefined
          }
        } : prev));
      } catch (err) {
        console.warn('Lỗi lưu điểm số:', err);
        setGameResult((prev) => (prev ? {
          ...prev,
          sync: { synced: false, localSaved: false, reason: err.message }
        } : prev));
      }
    });

    // Load Chart
    const setupChart = async () => {
      let chartToLoad = initialChart;
      if (!chartToLoad) {
        chartToLoad = SAMPLE_BEATMAP;
      }

      let parsedBeatmap = chartToLoad.beatmap || chartToLoad;
      if (chartToLoad.rawOsu) {
        const res = parseOsu(chartToLoad.rawOsu, { preset: 'twoFingers' });
        parsedBeatmap = res.beatmap;
      }

      // Xác định chính xác nguồn gốc bản đồ (maimai vs osu)
      const isOsu = Boolean(
        chartToLoad.source === 'osu' ||
        chartToLoad.rawOsu ||
        chartToLoad.keys ||
        parsedBeatmap.source === 'osu' ||
        parsedBeatmap.metadata?.source === 'osu'
      );
      parsedBeatmap.source = isOsu ? 'osu' : 'maimai';
      if (!parsedBeatmap.metadata) parsedBeatmap.metadata = {};
      parsedBeatmap.metadata.source = isOsu ? 'osu' : 'maimai';

      const meta = chartToLoad.metadata || parsedBeatmap.metadata || {};
      const title = chartToLoad.title || meta.title || 'Beyond The Æxis';
      const artist = chartToLoad.artist || meta.artist || '';
      const diff = chartToLoad.difficultyName || meta.difficultyName || 'Normal';
      const stars = parseFloat(chartToLoad.stars || meta.stars || chartToLoad.difficultyLevel || 5.0);

      setActiveChartName(title);
      setActiveArtist(artist);
      setActiveDiffName(diff);
      setActiveStars(stars);
      setCoverUrl(chartToLoad.backgroundSource || chartToLoad.serverAssets?.coverUrl || chartToLoad.coverUrl || null);

      let audioBlob = chartToLoad.audioBlob || chartToLoad.audioSource || chartToLoad.serverAssets?.audioUrl || null;
      let hitsounds = chartToLoad.hitsounds || null;
      let vidBlob = chartToLoad.videoBlob || chartToLoad.videoSource || chartToLoad.serverAssets?.videoUrl || parsedBeatmap.assets?.video || null;

      if (vidBlob) {
        if (videoObjectUrlRef.current) {
          URL.revokeObjectURL(videoObjectUrlRef.current);
          videoObjectUrlRef.current = null;
        }
        const vidUrl = typeof vidBlob === 'string' ? vidBlob : URL.createObjectURL(vidBlob);
        if (typeof vidBlob !== 'string') videoObjectUrlRef.current = vidUrl;
        setVideoSrc(vidUrl);
      } else {
        if (videoObjectUrlRef.current) {
          URL.revokeObjectURL(videoObjectUrlRef.current);
          videoObjectUrlRef.current = null;
        }
        setVideoSrc(null);
      }

      await engine.loadChart(parsedBeatmap, audioBlob, hitsounds);
      if (cancelled) return;
      engine.isMaimaiChart = !isOsu;
      engine.maimaiSpinAssist = settings?.maimaiSpinAssist !== false;
      engine.renderer.backgroundDim = backgroundDim;
      engine.enableStartCountdown = (settings?.enableStartCountdown ?? settings?.countdownBeforeStart) !== false;

      // Tự động khởi động trận đấu kèm đếm ngược 3-2-1
      setIsPlaying(true);
      setIsPaused(false);
      setGameResult(null);
      setLiveScore(0);
      setLiveAccuracy(100.0);
      setLiveCombo(0);
      if (progressBarRef.current) progressBarRef.current.style.width = '0%';

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.pause();
      }

      await engine.start(0, engine.enableStartCountdown);
    };

    setupChart();

    return () => {
      cancelled = true;
      offPause();
      offSkip();
      offTouch();
      offJudgement();
      offEnd();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
        videoObjectUrlRef.current = null;
      }
      engine.stop();
    };
  }, [initialChart]);

  // Sync settings updates to Engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.renderer.noteSpeed = noteSpeed;
      engineRef.current.renderer.ringNoteSpeed = settings?.ringNoteSpeed ?? ringNoteSpeed ?? noteSpeed;
      engineRef.current.maimaiSpinAssist = settings?.maimaiSpinAssist !== false;
      engineRef.current.renderer.backgroundDim = backgroundDim;
      engineRef.current.renderer.showURBar = settings?.showURBar !== false;
      engineRef.current.hasBackgroundVideo = Boolean(videoSrc && showVideo);
      engineRef.current.setAutoplay(isAutoplay);

      if (settings?.customKeybinds) {
        engineRef.current.inputManager.setKeybinds(settings.customKeybinds);
        engineRef.current.renderer.customKeybinds = settings.customKeybinds;
      }
      audioEngine.setUserOffset(userOffset);
      audioEngine.setVolumes(musicVol / 100, hitVol / 100);
    }
  }, [noteSpeed, userOffset, musicVol, hitVol, backgroundDim, videoSrc, showVideo, isAutoplay, settings]);

  // Track live song progress directly to DOM bar (avoid 60fps React re-renders)
  const progressBarRef = useRef(null);

  useEffect(() => {
    let animId;
    const updateProgress = () => {
      if (isPlaying && !isPaused && engineRef.current) {
        const currentMs = engineRef.current.audioEngine.getSongTimeMs();
        const totalMs = engineRef.current.beatmap?.totalDuration || (engineRef.current.beatmap?.notes?.slice(-1)[0]?.time || 1);
        if (totalMs > 0 && progressBarRef.current) {
          const ratio = Math.min(1, Math.max(0, currentMs / totalMs));
          progressBarRef.current.style.width = `${ratio * 100}%`;
        }
      }
      animId = requestAnimationFrame(updateProgress);
    };
    animId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isPaused]);

  // Key overlay event tracking
  useEffect(() => {
    const keybinds = settings?.customKeybinds || {
      0: ['Digit4', 'Digit5'],
      1: ['Digit6', 'Digit7'],
      2: ['Digit8', 'Digit9'],
      3: ['KeyR'],
      4: ['KeyF'],
      5: ['KeyV'],
      6: ['KeyI'],
      7: ['KeyJ'],
      8: ['KeyN'],
      ring: ['Space', 'KeyB', 'Enter']
    };

    const handleKeyDown = (e) => {
      if (!isPlaying || isPaused) return;
      for (const [lane, keys] of Object.entries(keybinds)) {
        if (keys.includes(e.code)) {
          setActivePressedLanes((prev) => new Set([...prev, lane]));
          setKeyPressCounts((prev) => ({
            ...prev,
            [lane]: (prev[lane] || 0) + 1
          }));
        }
      }
    };

    const handleKeyUp = (e) => {
      for (const [lane, keys] of Object.entries(keybinds)) {
        if (keys.includes(e.code)) {
          setActivePressedLanes((prev) => {
            const next = new Set(prev);
            next.delete(lane);
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, isPaused, settings?.customKeybinds]);

  // Pause menu keyboard navigation (↑, ↓, Enter, Esc)
  useEffect(() => {
    if (!isPaused) return;

    const handlePauseKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        playHover();
        setPauseMenuIndex((prev) => (prev + 1) % 4);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playHover();
        setPauseMenuIndex((prev) => (prev - 1 + 4) % 4);
      } else if (e.key === 'Enter' || e.key === 'Space') {
        e.preventDefault();
        playClick();
        if (pauseMenuIndex === 0) handlePauseToggle();
        else if (pauseMenuIndex === 1) handleRetry();
        else if (pauseMenuIndex === 2) {
          if (onOpenSettings) onOpenSettings();
        } else if (pauseMenuIndex === 3) handleBack();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handlePauseToggle();
      }
    };

    window.addEventListener('keydown', handlePauseKey);
    return () => window.removeEventListener('keydown', handlePauseKey);
  }, [isPaused, pauseMenuIndex]);

  const handleStartGame = async () => {
    if (!engineRef.current) return;
    setGameResult(null);
    setIsPaused(false);
    setIsPlaying(true);
    setLiveScore(0);
    setLiveAccuracy(100.0);
    setLiveCombo(0);
    if (progressBarRef.current) progressBarRef.current.style.width = '0%';

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }

    const withCountdown = (settings?.enableStartCountdown ?? settings?.countdownBeforeStart) !== false;
    await engineRef.current.start(0, withCountdown);
  };

  const handlePauseToggle = () => {
    if (!engineRef.current) return;
    engineRef.current.togglePause();
    setIsPaused(engineRef.current.isPaused);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleRetry = async () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    engineRef.current.resetRun();
    const initialAutoplay = settings?.isAutoplay ?? false;
    engineRef.current.setAutoplay(initialAutoplay);
    setIsAutoplay(initialAutoplay);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
    await handleStartGame();
  };

  const handleReplay = async () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    engineRef.current.resetRun();
    engineRef.current.setAutoplay(true);
    setIsAutoplay(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
    await handleStartGame();
  };

  const handleBack = () => {
    if (engineRef.current) engineRef.current.stop();
    if (videoRef.current) videoRef.current.pause();
    if (onBackToSelect) onBackToSelect();
  };

  // Format 7-8 digit score (e.g. 00,845,210)
  const formattedScore = String(liveScore).padStart(8, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Lanes definition for Key Overlay
  const keyOverlayLanes = [
    { key: '0', label: '4·5' },
    { key: '1', label: '6·7' },
    { key: '2', label: '8·9' },
    { key: '3', label: 'R' },
    { key: '4', label: 'F' },
    { key: '5', label: 'V' },
    { key: '6', label: 'I' },
    { key: '7', label: 'J' },
    { key: '8', label: 'N' },
    { key: 'ring', label: 'SPC' }
  ];

  return (
    <div className="fixed inset-0 z-40 bg-[#090912] flex flex-col select-none overflow-hidden osu-screen-transition">
      {/* 1. TOP PROGRESS BAR (Thin 3px line across entire top) */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.08] z-30 pointer-events-none">
        <div
          ref={progressBarRef}
          className="h-full bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] shadow-[0_0_8px_#ff4d80]"
          style={{ width: '0%' }}
        />
      </div>

      {/* 2. TOP HUD: Left Song Info + Right Score & Accuracy */}
      <div className="h-12 sm:h-14 px-2.5 sm:px-5 flex items-center justify-between z-20 shrink-0 bg-gradient-to-b from-[#090912]/95 to-transparent">
        {/* Left: Back + Pause + Settings + Fullscreen + Map Info */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            icon="←"
            className="shrink-0 px-2 sm:px-3 text-xs"
          >
            <span className="hidden sm:inline">Back</span>
          </Button>

          {/* Pause / Resume Button for Mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePauseToggle}
            icon={isPaused ? '▶' : '⏸'}
            className="shrink-0 px-2 sm:px-3 text-xs"
            title="Pause / Resume"
          >
            <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isPlaying && !isPaused) handlePauseToggle();
              if (onOpenSettings) onOpenSettings();
            }}
            icon="⚙"
            className="shrink-0 px-2 sm:px-3 text-xs"
          >
            <span className="hidden sm:inline">Settings</span>
          </Button>

          {/* Fullscreen Button for Mobile */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#ffaec9] hover:text-white flex items-center justify-center text-xs shrink-0 cursor-pointer transition-colors"
            title="Fullscreen"
          >
            ⛶
          </button>

          <div className="h-5 w-px bg-white/10 mx-0.5 sm:mx-1 shrink-0" />

          {/* Map Info with Thumbnail */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 shadow-sm flex items-center justify-center">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#ff4d80] text-sm font-bold">🐰</span>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-white font-torus font-black text-xs sm:text-sm truncate max-w-[110px] xs:max-w-[160px] sm:max-w-[280px]">
                  {activeChartName}
                </span>
                <DifficultyBadge
                  category={normalizeMaimaiCategory(activeDiffName)}
                  level={initialChart?.difficultyLevel || calculateMaimaiRating(engineRef.current?.beatmap || initialChart?.beatmap || initialChart).levelString}
                  osuStars={activeStars}
                  showOsuStars={Boolean(initialChart?.source === 'osu' || initialChart?.keys || initialChart?.rawOsu || initialChart?.metadata?.source === 'osu')}
                  size="sm"
                />
                {isAutoplay && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-[#ffdd57]/20 text-[#ffdd57] text-[9px] sm:text-[10px] font-black animate-pulse shrink-0">
                    AUTO
                  </span>
                )}
              </div>
              {activeArtist && (
                <span className="text-[10px] sm:text-[11px] text-[#7c849c] truncate max-w-[110px] xs:max-w-[160px] sm:max-w-[280px]">
                  {activeArtist}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: 7-8 Digit Score + Accuracy with Circular Ring */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="flex flex-col items-end">
            <span className="font-mono font-black text-lg sm:text-2xl text-white tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {formattedScore}
            </span>
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono font-bold text-[#b8c0d4]">
              <span>{liveAccuracy.toFixed(2)}%</span>
            </div>
          </div>

          {/* Circular Accuracy Progress Ring */}
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="13"
                className="stroke-white/[0.1] fill-none sm:hidden"
                strokeWidth="2.5"
              />
              <circle
                cx="16"
                cy="16"
                r="13"
                className="stroke-[#ff4d80] fill-none transition-all duration-100 sm:hidden"
                strokeWidth="2.5"
                strokeDasharray="81.68"
                strokeDashoffset={81.68 - (81.68 * liveAccuracy) / 100}
                strokeLinecap="round"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-white/[0.1] fill-none hidden sm:block"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-[#ff4d80] fill-none transition-all duration-100 hidden sm:block"
                strokeWidth="3"
                strokeDasharray="100.5"
                strokeDashoffset={100.5 - (100.5 * liveAccuracy) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-[#ff4d80]">
              ★
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN CANVAS GAMEPLAY AREA */}
      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden w-full h-full p-0">
        {/* Rotate Phone Hint for Mobile Portrait */}
        {isPortrait && showRotateHint && (
          <div
            onClick={() => setShowRotateHint(false)}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-[#ff85a2]/95 text-white text-[11px] font-bold shadow-[0_4px_20px_rgba(255,133,162,0.6)] flex items-center gap-2 backdrop-blur-md animate-pulse cursor-pointer border border-white/30"
            title="Tap to close"
          >
            <span>📱</span>
            <span>Rotate to landscape for optimal 2-hand play 🐰 🎀</span>
            <span className="text-[10px] opacity-75">✕</span>
          </div>
        )}

        {/* Background Video if available */}
        {videoSrc && showVideo && (
          <video
            ref={videoRef}
            src={videoSrc}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ opacity: 1 - backgroundDim, zIndex: 0 }}
            muted
            playsInline
            preload="auto"
          />
        )}

        {/* Canvas bao phủ tối đa diện tích màn hình thiết bị */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={720}
          className="block cursor-pointer relative z-10 w-full h-full touch-none select-none"
          style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
        />

        {/* 4. BOTTOM-LEFT HUD: Large Combo Counter */}
        {liveCombo > 0 && (
          <div className="absolute bottom-4 left-4 sm:bottom-10 sm:left-8 z-20 pointer-events-none flex flex-col items-start animate-fadeIn">
            <div className="font-torus font-black text-3xl sm:text-5xl text-white tracking-wider drop-shadow-[0_4px_16px_rgba(255,77,128,0.5)]">
              {liveCombo}x
            </div>
            <div className="text-[10px] sm:text-[11px] font-black tracking-widest text-[#ff4d80] uppercase -mt-0.5 ml-0.5">
              COMBO
            </div>
          </div>
        )}

        {/* 5. RIGHT KEY OVERLAY (osu! style key press counter - ẩn trên mobile để không che các nút bên phải) */}
        {settings?.showKeyOverlay !== false && isPlaying && (
          <div className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col gap-1.5 p-2 rounded-2xl bg-[#111122]/70 backdrop-blur-md border border-white/[0.06]">
            {keyOverlayLanes.map((lane) => {
              const isPressed = activePressedLanes.has(lane.key);
              const count = keyPressCounts[lane.key] || 0;
              return (
                <div
                  key={lane.key}
                  className={`w-12 h-6.5 rounded-lg flex items-center justify-between px-2 text-[10px] font-mono font-bold transition-all ${
                    isPressed
                      ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_0_12px_#ff4d80] scale-105'
                      : 'bg-white/[0.04] text-[#7c849c]'
                  }`}
                >
                  <span>{lane.label}</span>
                  <span className={isPressed ? 'text-white' : 'text-[#b8c0d4]'}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* 6. SKIP BUTTON */}
        {canSkip && isPlaying && !isPaused && (
          <button
            onClick={() => {
              if (engineRef.current) engineRef.current.skipBreak();
            }}
            className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 z-20 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-[#111122]/90 hover:bg-[#ff4d80] text-white border border-[#ff85a2]/40 text-xs font-bold transition-all cursor-pointer shadow-[0_4px_20px_rgba(255,77,128,0.3)] hover:scale-105 active:scale-95"
          >
            <span>Skip (Tap / Space)</span>
            <span>⏩</span>
          </button>
        )}

        {/* 8. PAUSE MENU */}
        {isPaused && (
          <div className="absolute inset-0 z-30 bg-[#140b17]/90 backdrop-blur-md flex flex-col items-center justify-center text-center animate-fadeIn select-none">
            <div className="text-4xl font-black text-white mb-1 tracking-widest font-torus drop-shadow-[0_0_25px_rgba(255,133,162,0.7)] flex items-center gap-2">
              <span className="text-3xl animate-kawaii-bounce inline-block">🐰</span>
              <span>PAUSED</span>
              <span className="text-3xl animate-kawaii-wiggle inline-block">🎀</span>
            </div>
            <div className="text-xs text-[#ffaec9] mb-6 font-mono">
              {activeChartName} [{activeDiffName}]
            </div>

            <div className="flex flex-col gap-2.5 w-72">
              {[
                { label: '▶ Resume 🎀', action: handlePauseToggle },
                { label: '↺ Retry 🐰', action: handleRetry },
                {
                  label: '⚙ Settings',
                  action: () => {
                    if (onOpenSettings) onOpenSettings();
                  }
                },
                { label: '✕ Change Song 🐰', action: handleBack }
              ].map((item, idx) => {
                const isSelected = pauseMenuIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      playClick();
                      item.action();
                    }}
                    onMouseEnter={() => {
                      playHover();
                      setPauseMenuIndex(idx);
                    }}
                    className={`w-full py-3 px-4 rounded-full text-xs font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_4px_24px_rgba(255,133,162,0.6)] scale-105'
                        : 'bg-white/[0.06] text-[#ffd6e0] hover:bg-white/[0.12] hover:text-white border border-[#ff85a2]/20'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 text-[11px] text-[#b89cb9] font-mono">
              [↑ / ↓] Navigate • [Enter] Select • [Esc] Resume 🐰
            </div>
          </div>
        )}

        {/* 9. RESULT SCREEN CHUẨN OSU!(LAZER) */}
        {gameResult && (
          <AstroResultScreen
            result={gameResult}
            beatmap={engineRef.current?.beatmap || initialChart?.beatmap || initialChart}
            initialChart={initialChart}
            currentUser={currentUser}
            isAutoplay={isAutoplay}
            onRetry={handleRetry}
            onReplay={handleReplay}
            onBack={() => {
              setGameResult(null);
              if (onBackToSelect) onBackToSelect();
            }}
          />
        )}
      </div>
    </div>
  );
}
