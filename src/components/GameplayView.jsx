import React, { useRef, useEffect, useState } from 'react';
import { GameEngine, gameEvents, audioEngine } from '../core/engine/index.js';
import { SAMPLE_BEATMAP } from '../core/beatmap/sampleChart.js';
import { parseOsu } from '../core/parser/index.js';
import { buildScoreRecord, persistScoreResult } from '../core/storage/scoreService.js';
import { calculateStars, calculatePP } from '../core/pp/ppCalculator.js';
import { Button, StarRating, RankBadge, playHover, playClick, playBack } from '../ui/index.js';

export default function GameplayView({
  initialChart = null,
  settings = null,
  currentUser = null,
  onBackToSelect = null,
  onOpenSettings = null,
  onUploadFiles = null
}) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const engineRef = useRef(null);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  // Live HUD States
  const [liveScore, setLiveScore] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100.0);
  const [liveCombo, setLiveCombo] = useState(0);
  const [songProgress, setSongProgress] = useState(0);

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

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    if (settings?.customKeybinds) {
      engine.inputManager.setKeybinds(settings.customKeybinds);
      engine.renderer.customKeybinds = settings.customKeybinds;
    }

    engine.onSyncVideo = (sec) => {
      if (videoRef.current) {
        try { videoRef.current.currentTime = sec; } catch (e) {}
      }
    };

    engine.onCountdownEnd = (sec) => {
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

    const offSkip = gameEvents.on('canSkipBreak', ({ canSkip }) => setCanSkip(Boolean(canSkip)));

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
        const missCount = summary?.counts?.miss || 0;
        const noteCount = beatmap?.notes?.length || 0;
        const pp = engine.isAutoplay ? 0 : calculatePP({
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
          isAutoplay: engine.isAutoplay,
          stars,
          pp
        });

        setGameResult({ ...summary, score: record.score, stars, pp });

        const { mysql } = await persistScoreResult(record);
        setGameResult((prev) => (prev ? { ...prev, sync: mysql } : prev));
      } catch (err) {
        console.warn('Lỗi lưu điểm số:', err);
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
        const vidUrl = typeof vidBlob === 'string' ? vidBlob : URL.createObjectURL(vidBlob);
        setVideoSrc(vidUrl);
      } else {
        setVideoSrc(null);
      }

      await engine.loadChart(parsedBeatmap, audioBlob, hitsounds);
      engine.renderer.backgroundDim = backgroundDim;
      engine.enableStartCountdown = (settings?.enableStartCountdown ?? settings?.countdownBeforeStart) !== false;

      // Tự động khởi động trận đấu kèm đếm ngược 3-2-1
      setIsPlaying(true);
      setIsPaused(false);
      setGameResult(null);
      setLiveScore(0);
      setLiveAccuracy(100.0);
      setLiveCombo(0);
      setSongProgress(0);

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.pause();
      }

      await engine.start(0, engine.enableStartCountdown);
    };

    setupChart();

    return () => {
      offPause();
      offSkip();
      offJudgement();
      offEnd();
      engine.stop();
    };
  }, [initialChart]);

  // Sync settings updates to Engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.renderer.noteSpeed = noteSpeed;
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

  // Track live song progress & Key Overlay listeners
  useEffect(() => {
    let animId;
    const updateProgress = () => {
      if (isPlaying && !isPaused && engineRef.current) {
        const currentMs = engineRef.current.audioEngine.getSongTimeMs();
        const totalMs = engineRef.current.beatmap?.totalDuration || (engineRef.current.beatmap?.notes?.slice(-1)[0]?.time || 1);
        if (totalMs > 0) {
          setSongProgress(Math.min(1, Math.max(0, currentMs / totalMs)));
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
    setSongProgress(0);

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
          className="h-full bg-gradient-to-r from-[#cc5289] to-[#ff66ab] shadow-[0_0_8px_#ff66ab] transition-all duration-75"
          style={{ width: `${songProgress * 100}%` }}
        />
      </div>

      {/* 2. TOP HUD: Left Song Info + Right Score & Accuracy */}
      <div className="h-14 px-5 flex items-center justify-between z-20 shrink-0 bg-gradient-to-b from-[#090912]/95 to-transparent">
        {/* Left: Back + Settings + Map Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            icon="←"
            className="text-[#b8c0d4] hover:text-white shrink-0"
          >
            Back
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isPlaying && !isPaused) handlePauseToggle();
              if (onOpenSettings) onOpenSettings();
            }}
            icon="⚙"
            className="text-[#b8c0d4] hover:text-white shrink-0"
          >
            Settings
          </Button>

          <div className="h-5 w-px bg-white/10 mx-1 shrink-0" />

          {/* Map Info with Thumbnail */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 shadow-sm flex items-center justify-center">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#ff66ab] text-sm font-bold">♪</span>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-torus font-black text-sm truncate max-w-[280px]">
                  {activeChartName}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#ff66ab]/20 text-[#ff66ab] text-[10px] font-bold shrink-0">
                  {activeDiffName}
                </span>
                <StarRating stars={activeStars} size="sm" showIcon={true} />
                {isAutoplay && (
                  <span className="px-2 py-0.5 rounded-full bg-[#ffdd57]/20 text-[#ffdd57] text-[10px] font-black animate-pulse shrink-0">
                    AUTO PLAY
                  </span>
                )}
              </div>
              {activeArtist && (
                <span className="text-[11px] text-[#7c849c] truncate max-w-[280px]">{activeArtist}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: 7-8 Digit Score + Accuracy with Circular Ring */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end">
            <span className="font-mono font-black text-2xl text-white tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {formattedScore}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#b8c0d4]">
              <span>{liveAccuracy.toFixed(2)}%</span>
            </div>
          </div>

          {/* Circular Accuracy Progress Ring */}
          <div className="relative w-10 h-10 shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-white/[0.1] fill-none"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-[#ff66ab] fill-none transition-all duration-100"
                strokeWidth="3"
                strokeDasharray="100.5"
                strokeDashoffset={100.5 - (100.5 * liveAccuracy) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[#ff66ab]">
              ★
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN CANVAS GAMEPLAY AREA */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
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

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={720}
          height={620}
          className="block cursor-default relative z-10 max-h-full"
        />

        {/* 4. BOTTOM-LEFT HUD: Large Combo Counter */}
        {liveCombo > 0 && (
          <div className="absolute bottom-10 left-8 z-20 pointer-events-none flex flex-col items-start animate-fadeIn">
            <div className="font-torus font-black text-5xl text-white tracking-wider drop-shadow-[0_4px_16px_rgba(255,102,171,0.5)]">
              {liveCombo}x
            </div>
            <div className="text-[11px] font-black tracking-widest text-[#ff66ab] uppercase -mt-1 ml-0.5">
              COMBO
            </div>
          </div>
        )}

        {/* 5. RIGHT KEY OVERLAY (osu! style key press counter) */}
        {settings?.showKeyOverlay !== false && isPlaying && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col gap-1.5 p-2 rounded-2xl bg-[#111122]/70 backdrop-blur-md border border-white/[0.06]">
            {keyOverlayLanes.map((lane) => {
              const isPressed = activePressedLanes.has(lane.key);
              const count = keyPressCounts[lane.key] || 0;
              return (
                <div
                  key={lane.key}
                  className={`w-12 h-6.5 rounded-lg flex items-center justify-between px-2 text-[10px] font-mono font-bold transition-all ${
                    isPressed
                      ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_0_12px_#ff66ab] scale-105'
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

        {/* 6. SKIP BUTTON (osu! style) */}
        {canSkip && isPlaying && !isPaused && (
          <button
            onClick={() => {
              if (engineRef.current) engineRef.current.skipBreak();
            }}
            className="absolute bottom-8 right-8 z-20 flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#111122]/90 hover:bg-[#ff66ab] text-white border border-[#ff66ab]/40 text-xs font-bold transition-all cursor-pointer shadow-[0_4px_20px_rgba(255,102,171,0.3)] hover:scale-105"
          >
            <span>Skip (Space)</span>
            <span>⏩</span>
          </button>
        )}



        {/* 8. PAUSE MENU (osu! lazer style with keyboard navigation) */}
        {isPaused && (
          <div className="absolute inset-0 z-30 bg-[#0d0d1a]/90 backdrop-blur-md flex flex-col items-center justify-center text-center animate-fadeIn select-none">
            <div className="text-4xl font-black text-white mb-1 tracking-widest font-torus drop-shadow-[0_0_20px_rgba(255,102,171,0.5)]">
              PAUSED
            </div>
            <div className="text-xs text-[#7c849c] mb-6 font-mono">
              {activeChartName} [{activeDiffName}]
            </div>

            <div className="flex flex-col gap-2.5 w-72">
              {[
                { label: '▶ Tiếp tục (Continue)', action: handlePauseToggle },
                { label: '↺ Thử lại (Retry)', action: handleRetry },
                {
                  label: '⚙ Cài đặt (Settings)',
                  action: () => {
                    if (onOpenSettings) onOpenSettings();
                  }
                },
                { label: '✕ Quay lại bài hát (Back)', action: handleBack }
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
                        ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_4px_20px_rgba(255,102,171,0.5)] scale-105'
                        : 'bg-white/[0.06] text-[#b8c0d4] hover:bg-white/[0.12] hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 text-[11px] text-[#7c849c] font-mono">
              [↑ / ↓] Di chuyển • [Enter] Chọn • [Esc] Tiếp tục
            </div>
          </div>
        )}

        {/* 9. RESULT SCREEN */}
        {gameResult && (
          <div className="absolute inset-0 z-30 bg-[#0d0d1a]/95 backdrop-blur-xl flex items-center justify-center animate-fadeIn">
            <div className="flex flex-col items-center max-w-lg w-full px-6">
              <div className="text-xs text-[#ff66ab] font-bold tracking-[0.2em] mb-1 uppercase font-mono">
                RESULTS
              </div>
              <div className="text-sm font-bold text-white mb-4 truncate max-w-full text-center">
                {activeChartName} <span className="text-[#ff66ab]">[{activeDiffName}]</span>
              </div>

              {/* Grade */}
              <div className="mb-3">
                <RankBadge rank={gameResult.rank} size="xl" />
              </div>

              {/* Accuracy */}
              <div className="font-mono text-3xl font-black text-white mb-4">
                {gameResult.achievement.toFixed(2)}%
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-2 mb-5 text-xs font-mono">
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.06] text-white font-bold">
                  {(gameResult.score ?? Math.round(gameResult.achievement * 10000)).toLocaleString('en-US')}
                </span>
                {gameResult.stars !== undefined && (
                  <StarRating stars={gameResult.stars} size="sm" />
                )}
                {gameResult.pp !== undefined && (
                  <span className="px-3 py-1.5 rounded-full bg-[#6c5ce7]/15 border border-[#6c5ce7]/30 text-[#a29bfe] font-bold">
                    {Number(gameResult.pp).toFixed(0)}pp
                  </span>
                )}
              </div>

              {/* Judgments Grid */}
              <div className="w-80 bg-[#1a1a2e]/90 rounded-2xl border border-white/[0.06] p-4 mb-5 shadow-xl">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-[#ffdd57]">CRITICAL</span> <span className="font-bold text-white">{gameResult.counts.criticalPerfect}</span></div>
                  <div className="flex justify-between"><span className="text-[#ff9800]">PERFECT</span> <span className="font-bold text-white">{gameResult.counts.perfect}</span></div>
                  <div className="flex justify-between"><span className="text-[#66bb6a]">GREAT</span> <span className="font-bold text-white">{gameResult.counts.great}</span></div>
                  <div className="flex justify-between"><span className="text-[#4fc3f7]">GOOD</span> <span className="font-bold text-white">{gameResult.counts.good}</span></div>
                  <div className="flex justify-between"><span className="text-[#ef5350]">MISS</span> <span className="font-bold text-[#ef5350]">{gameResult.counts.miss}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">MAX COMBO</span> <span className="font-bold text-white">{gameResult.maxCombo}</span></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="primary" size="md" onClick={handleRetry} icon="↺">
                  Retry
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setGameResult(null);
                    if (onBackToSelect) onBackToSelect();
                  }}
                  icon="←"
                >
                  Back to Songs
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
