import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine, gameEvents, audioEngine } from '../core/engine/index.js';
import { SAMPLE_BEATMAP } from '../core/beatmap/sampleChart.js';
import { parseOsu } from '../core/parser/index.js';
import { buildScoreRecord, persistScoreResult } from '../core/storage/scoreService.js';
import { calculateStars, calculatePP } from '../core/pp/ppCalculator.js';

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
  const [activeChartName, setActiveChartName] = useState('Beyond The Æxis');
  const [activeArtist, setActiveArtist] = useState('');
  const [activeDiffName, setActiveDiffName] = useState('');
  const [audioSourceName, setAudioSourceName] = useState('audio.ogg (Gói map)');
  const [noteSpeed, setNoteSpeed] = useState(settings?.noteSpeed ?? 10.0);
  const [userOffset, setUserOffset] = useState(settings?.userOffset ?? 0);
  const [musicVol, setMusicVol] = useState(settings?.musicVol ?? 85);
  const [hitVol, setHitVol] = useState(settings?.hitVol ?? 95);

  // Video nền & Background Dim
  const [videoSrc, setVideoSrc] = useState(null);
  const [showVideo, setShowVideo] = useState(true);
  const [backgroundDim, setBackgroundDim] = useState(settings?.backgroundDim ?? 0.75);

  // Autoplay
  const [isAutoplay, setIsAutoplay] = useState(settings?.isAutoplay ?? false);

  // Khởi tạo GameEngine
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

    const offPause = gameEvents.on('pause', () => setIsPaused(true));
    const offSkip = gameEvents.on('canSkipBreak', ({ canSkip }) => setCanSkip(Boolean(canSkip)));
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
        setGameResult(summary);
      }
    });

    const setupChart = async () => {
      if (initialChart) {
        const beatmap = initialChart.beatmap || initialChart;
        const audioBlob = initialChart.audioBlob || initialChart.audioSource || initialChart.serverAssets?.audioUrl || null;
        const hitsounds = initialChart.hitsounds || null;
        const videoBlob = initialChart.videoBlob || initialChart.videoSource || initialChart.serverAssets?.videoUrl || beatmap.assets?.video || null;

        await engine.loadChart(beatmap, audioBlob, hitsounds);
        const title = beatmap.metadata?.title || initialChart.title || 'Unknown';
        const diff = beatmap.metadata?.difficultyName || initialChart.difficultyName || 'Normal';
        const artist = beatmap.metadata?.artist || initialChart.artist || '';
        setActiveChartName(title);
        setActiveDiffName(diff);
        setActiveArtist(artist);
        setAudioSourceName(audioBlob ? (typeof audioBlob === 'string' ? audioBlob : 'File nhạc từ gói map') : 'Synth Procedural');

        if (videoBlob) {
          const vUrl = videoBlob instanceof Blob ? URL.createObjectURL(videoBlob) : videoBlob;
          setVideoSrc(vUrl);
        } else {
          setVideoSrc(null);
        }
      } else {
        try {
          const res = await fetch('/tests/fixtures/beyond-the-aexis/2025310 SDMNE - Beyond The Aexis/SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu');
          if (res.ok) {
            const text = await res.text();
            const parsed = parseOsu(text, { preset: 'twoFingers', autoSlide: false });
            await engine.loadChart(parsed.beatmap, '/audio.ogg');
            setActiveChartName('Beyond The Æxis');
            setActiveDiffName('Soulless Wanderers');
            setActiveArtist('SDMNE');
            setAudioSourceName('audio.ogg (Mẫu)');
            setVideoSrc(null);
            return;
          }
        } catch (e) {}
        await engine.loadChart(SAMPLE_BEATMAP, null);
        setActiveChartName('Neon Odyssey');
        setActiveDiffName('Normal');
        setActiveArtist('Triarhythm');
        setAudioSourceName('Synth Procedural');
        setVideoSrc(null);
      }
    };

    setupChart();

    return () => {
      offPause();
      offSkip();
      offEnd();
      engine.stop();
    };
  }, [initialChart]);

  // Cập nhật settings
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.renderer.noteSpeed = noteSpeed;
      engineRef.current.renderer.backgroundDim = backgroundDim;
      engineRef.current.hasBackgroundVideo = Boolean(videoSrc && showVideo);
      engineRef.current.setAutoplay(isAutoplay);
      if (settings?.customKeybinds) {
        engineRef.current.inputManager.setKeybinds(settings.customKeybinds);
        engineRef.current.renderer.customKeybinds = settings.customKeybinds;
      }
      audioEngine.setUserOffset(userOffset);
      audioEngine.setVolumes(musicVol / 100, hitVol / 100);
    }
  }, [noteSpeed, userOffset, musicVol, hitVol, backgroundDim, videoSrc, showVideo, isAutoplay, settings?.customKeybinds]);

  // Đồng bộ Video
  useEffect(() => {
    let animId;
    const syncVideo = () => {
      if (videoRef.current && showVideo && isPlaying && !isPaused && engineRef.current) {
        const audioTime = engineRef.current.audioEngine.getSongTimeMs();
        const videoOffset = engineRef.current.beatmap?.assets?.videoOffset || 0;
        const targetVideoTime = (audioTime - videoOffset) / 1000;

        if (targetVideoTime >= 0) {
          const vid = videoRef.current;
          const drift = Math.abs(vid.currentTime - targetVideoTime);
          if (drift > 0.08) {
            vid.currentTime = targetVideoTime;
          }
          if (vid.paused) {
            vid.play().catch(() => {});
          }
        }
      } else if (videoRef.current && isPaused && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      animId = requestAnimationFrame(syncVideo);
    };

    animId = requestAnimationFrame(syncVideo);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isPaused, showVideo]);

  const handleStartGame = async () => {
    if (!engineRef.current) return;
    setGameResult(null);
    setIsPaused(false);
    setIsPlaying(true);
    if (videoRef.current && showVideo) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    await engineRef.current.start(0);
  };

  // Phím Space / Enter để bắt đầu chơi
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (!isPlaying && !gameResult && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        handleStartGame();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isPlaying, gameResult]);

  const handlePauseToggle = () => {
    if (!engineRef.current) return;
    engineRef.current.togglePause();
    setIsPaused(engineRef.current.isPaused);
    if (videoRef.current) {
      if (engineRef.current.isPaused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  };

  const handleRetry = async () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    await handleStartGame();
  };

  const handleBack = () => {
    if (engineRef.current) engineRef.current.stop();
    if (onBackToSelect) onBackToSelect();
  };

  // Rank color helper
  const getRankColor = (rank) => {
    if (!rank) return 'text-white';
    const r = rank.toUpperCase();
    if (r.includes('SS') || r === 'SSS+' || r === 'SSS') return 'text-[#ffdd57]';
    if (r.includes('S')) return 'text-[#ff66ab]';
    if (r === 'A' || r.includes('A')) return 'text-[#66bb6a]';
    if (r === 'B') return 'text-[#4fc3f7]';
    if (r === 'C') return 'text-[#ff9800]';
    return 'text-white';
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#0a0a16] flex flex-col select-none">
      {/* Top HUD Bar - Minimal: Back + Map Info + Settings */}
      <div className="h-11 bg-[#0d0d1a]/90 backdrop-blur-md border-b border-white/[0.04] px-4 flex items-center justify-between z-20 shrink-0">
        {/* Left: Back Button */}
        <div className="flex items-center gap-3">
          {onBackToSelect && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#b8c0d4] hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <span className="text-sm">←</span>
              <span>Back</span>
            </button>
          )}

          {/* Map Info */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm truncate max-w-[300px]">
                  {activeChartName}
                </span>
                {activeDiffName && (
                  <span className="px-2 py-0.5 rounded-full bg-[#ff66ab]/20 text-[#ff66ab] text-[10px] font-bold shrink-0">
                    {activeDiffName}
                  </span>
                )}
                {isAutoplay && (
                  <span className="px-2 py-0.5 rounded-full bg-[#ffdd57]/20 text-[#ffdd57] text-[10px] font-bold animate-pulse shrink-0">
                    AUTO
                  </span>
                )}
              </div>
              {activeArtist && (
                <span className="text-[10px] text-[#6b7280]">{activeArtist}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Settings */}
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#b8c0d4] hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <span>⚙</span>
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area - Full remaining space */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Video Background */}
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

        <canvas
          ref={canvasRef}
          width={720}
          height={620}
          className="block cursor-default relative z-10 max-h-full"
        />

        {/* Skip Button */}
        {canSkip && isPlaying && !isPaused && (
          <button
            onClick={() => {
              if (engineRef.current) engineRef.current.skipBreak();
            }}
            className="absolute bottom-8 right-8 z-20 flex items-center gap-2 px-5 py-2 rounded-full bg-[#1a1a2e]/90 hover:bg-[#ff66ab]/20 text-white/70 hover:text-white border border-white/10 hover:border-[#ff66ab]/50 text-xs font-bold transition-all cursor-pointer"
          >
            <span>Skip</span>
            <span className="text-base">⏩</span>
          </button>
        )}

        {/* Pre-game Start Overlay */}
        {!isPlaying && !gameResult && (
          <div className="absolute inset-0 z-30 bg-[#0a0a16]/85 backdrop-blur-sm flex flex-col items-center justify-center text-center animate-fadeIn">
            <div className="text-5xl font-black text-white mb-2 tracking-[0.15em]">
              TRIARHYTHM
            </div>
            <p className="text-xs text-[#6b7280] tracking-wider mb-8 uppercase">
              Triangular VSRG • 2-Finger Ergonomics
            </p>

            <button
              onClick={handleStartGame}
              className="px-12 py-3.5 rounded-full osu-btn text-sm tracking-widest font-black cursor-pointer relative z-40"
            >
              PLAY
            </button>

            <div className="mt-6 text-[11px] text-[#6b7280]">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-bold border border-white/10 text-[10px]">SPACE</kbd> or click to start
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {isPaused && (
          <div className="absolute inset-0 z-30 bg-[#0a0a16]/85 backdrop-blur-md flex flex-col items-center justify-center text-center animate-fadeIn">
            <div className="text-4xl font-black text-white mb-6 tracking-widest">
              PAUSED
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePauseToggle}
                className="px-8 py-2.5 rounded-full osu-btn text-xs font-bold cursor-pointer"
              >
                Continue
              </button>
              <button
                onClick={handleRetry}
                className="px-8 py-2.5 rounded-full osu-btn-ghost text-xs font-bold cursor-pointer"
              >
                Retry
              </button>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="px-6 py-2.5 rounded-full osu-btn-ghost text-xs font-bold cursor-pointer"
                >
                  Settings
                </button>
              )}
            </div>
          </div>
        )}

        {/* Result Screen */}
        {gameResult && (
          <div className="absolute inset-0 z-30 bg-[#0a0a16]/90 backdrop-blur-xl flex items-center justify-center animate-fadeIn">
            <div className="flex flex-col items-center max-w-lg w-full px-6">
              {/* Track info */}
              <div className="text-xs text-[#ff66ab] font-bold tracking-[0.2em] mb-1 uppercase">
                RESULTS
              </div>
              <div className="text-sm text-[#b8c0d4] mb-4 truncate max-w-full text-center">
                {activeChartName} <span className="text-[#6b7280]">[{activeDiffName}]</span>
              </div>

              {/* Grade */}
              <div className={`text-8xl font-black mb-2 tracking-wider drop-shadow-[0_0_30px_rgba(255,102,171,0.4)] ${getRankColor(gameResult.rank)}`}>
                {gameResult.rank}
              </div>

              {/* Accuracy */}
              <div className="font-mono text-3xl font-black text-white mb-4">
                {gameResult.achievement.toFixed(2)}%
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-2 mb-5 text-xs">
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.06] text-white font-bold font-mono">
                  {(gameResult.score ?? Math.round(gameResult.achievement * 10000)).toLocaleString('en-US')}
                </span>
                {gameResult.stars !== undefined && (
                  <span className="px-3 py-1.5 rounded-full bg-[#ff66ab]/10 border border-[#ff66ab]/30 text-[#ff66ab] font-bold font-mono">
                    ★ {Number(gameResult.stars).toFixed(2)}
                  </span>
                )}
                {gameResult.pp !== undefined && (
                  <span className="px-3 py-1.5 rounded-full bg-[#6c5ce7]/10 border border-[#6c5ce7]/30 text-[#a29bfe] font-bold font-mono">
                    {Number(gameResult.pp).toFixed(0)}pp
                  </span>
                )}
              </div>

              {/* Judgments Grid */}
              <div className="w-80 bg-[#1a1a2e]/80 rounded-2xl border border-white/[0.06] p-4 mb-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-[#ffdd57]">CRITICAL</span> <span className="font-bold text-white">{gameResult.counts.criticalPerfect}</span></div>
                  <div className="flex justify-between"><span className="text-[#ff9800]">PERFECT</span> <span className="font-bold text-white">{gameResult.counts.perfect}</span></div>
                  <div className="flex justify-between"><span className="text-[#66bb6a]">GREAT</span> <span className="font-bold text-white">{gameResult.counts.great}</span></div>
                  <div className="flex justify-between"><span className="text-[#4fc3f7]">GOOD</span> <span className="font-bold text-white">{gameResult.counts.good}</span></div>
                  <div className="flex justify-between"><span className="text-[#ef5350]">MISS</span> <span className="font-bold text-[#ef5350]">{gameResult.counts.miss}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">MAX COMBO</span> <span className="font-bold text-white">{gameResult.maxCombo}</span></div>
                  <div className="flex justify-between col-span-2 pt-2 border-t border-white/[0.06] text-[#6b7280]">
                    <span>UR</span> <span className="text-white/80 font-bold">{gameResult.ur}</span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2 mb-5">
                {gameResult.flags.isAP && (
                  <span className="px-3 py-1 rounded-full bg-[#ffdd57]/10 text-[#ffdd57] border border-[#ffdd57]/40 text-xs font-bold">
                    ALL PERFECT
                  </span>
                )}
                {gameResult.flags.isFC && !gameResult.flags.isAP && (
                  <span className="px-3 py-1 rounded-full bg-[#66bb6a]/10 text-[#66bb6a] border border-[#66bb6a]/40 text-xs font-bold">
                    FULL COMBO
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="px-8 py-2.5 rounded-full osu-btn text-xs font-bold cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    setGameResult(null);
                    if (onBackToSelect) onBackToSelect();
                  }}
                  className="px-8 py-2.5 rounded-full osu-btn-ghost text-xs font-bold cursor-pointer"
                >
                  Back to Songs
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
