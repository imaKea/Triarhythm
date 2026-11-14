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
  const [audioSourceName, setAudioSourceName] = useState('audio.ogg (Gói map)');
  const [noteSpeed, setNoteSpeed] = useState(settings?.noteSpeed ?? 10.0);
  const [userOffset, setUserOffset] = useState(settings?.userOffset ?? 0);
  const [musicVol, setMusicVol] = useState(settings?.musicVol ?? 85);
  const [hitVol, setHitVol] = useState(settings?.hitVol ?? 95);

  // Cấu hình Video nền & Background Dim (GĐ5)
  const [videoSrc, setVideoSrc] = useState(null);
  const [showVideo, setShowVideo] = useState(true);
  const [backgroundDim, setBackgroundDim] = useState(settings?.backgroundDim ?? 0.75);

  // Chế độ Autoplay để test (AP 101.0000%)
  const [isAutoplay, setIsAutoplay] = useState(settings?.isAutoplay ?? false);

  // Khởi tạo GameEngine gắn với Canvas
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

      // Tính Star Rating / PP và lưu kết quả (IndexedDB + MySQL)
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

        // Hiển thị kết quả ngay, không chờ đồng bộ MySQL
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
        const audioBlob = initialChart.audioBlob || initialChart.audioSource || null;
        const hitsounds = initialChart.hitsounds || null;
        const videoBlob = initialChart.videoBlob || beatmap.assets?.video || null;

        await engine.loadChart(beatmap, audioBlob, hitsounds);
        setActiveChartName(`${beatmap.metadata?.title || initialChart.title || 'Unknown'} [${beatmap.metadata?.difficultyName || initialChart.difficultyName || 'Normal'}]`);
        setAudioSourceName(audioBlob ? (typeof audioBlob === 'string' ? audioBlob : 'File nhạc từ gói map') : 'Synth Procedural');

        if (videoBlob) {
          const vUrl = videoBlob instanceof Blob ? URL.createObjectURL(videoBlob) : videoBlob;
          setVideoSrc(vUrl);
        } else {
          setVideoSrc(null);
        }
      } else {
        // Mặc định nạp Beyond The Aexis mẫu
        try {
          const res = await fetch('/tests/fixtures/beyond-the-aexis/2025310 SDMNE - Beyond The Aexis/SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu');
          if (res.ok) {
            const text = await res.text();
            const parsed = parseOsu(text, { preset: 'twoFingers', autoSlide: false });
            await engine.loadChart(parsed.beatmap, '/audio.ogg');
            setActiveChartName('Beyond The Æxis [Soulless Wanderers]');
            setAudioSourceName('audio.ogg (Mẫu)');
            setVideoSrc(null);
            return;
          }
        } catch (e) {}
        await engine.loadChart(SAMPLE_BEATMAP, null);
        setActiveChartName('Neon Odyssey');
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

  // Cập nhật settings & video background & autoplay
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

  // Đồng bộ Video Nền với nhịp bài hát theo chuẩn lệch <= 80ms (Mục 3.8 SPEC)
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
          if (drift > 0.08) { // Chuẩn <= 80ms
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

  // Lắng nghe phím Space / Enter để bắt đầu chơi
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

  const handleSelectSample = async () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    await engineRef.current.loadChart(SAMPLE_BEATMAP, null);
    setActiveChartName('Neon Odyssey');
    setAudioSourceName('Synth Procedural');
    setIsPlaying(false);
    setGameResult(null);
  };

  const handleSelectBeyondTheAexis = async () => {
    if (!engineRef.current) return;
    try {
      const res = await fetch('/tests/fixtures/beyond-the-aexis/2025310 SDMNE - Beyond The Aexis/SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu');
      if (res.ok) {
        const text = await res.text();
        const parsed = parseOsu(text, { preset: 'twoFingers', autoSlide: false });
        engineRef.current.stop();
        await engineRef.current.loadChart(parsed.beatmap, '/audio.ogg');
        setActiveChartName('Beyond The Æxis [Soulless Wanderers]');
        setAudioSourceName('audio.ogg (SDMNE)');
        setIsPlaying(false);
        setGameResult(null);
      }
    } catch (e) {
      alert('Không thể tải bài Beyond The Aexis: ' + e.message);
    }
  };

  // Cho phép người dùng gán file âm thanh riêng bất kỳ lúc nào
  const handleCustomAudioUpload = async (e) => {
    const audioFile = e.target.files?.[0];
    if (!audioFile || !engineRef.current) return;

    try {
      await engineRef.current.audioEngine.loadMusic(audioFile);
      setAudioSourceName(`File riêng: ${audioFile.name}`);
      alert(`Đã gán nhạc thành công từ file: ${audioFile.name}`);
    } catch (err) {
      alert('Lỗi nạp file âm thanh: ' + err.message);
    }
  };

  // Cho phép người dùng gán file video nền riêng (GĐ5)
  const handleCustomVideoUpload = (e) => {
    const videoFile = e.target.files?.[0];
    if (!videoFile) return;
    const url = URL.createObjectURL(videoFile);
    setVideoSrc(url);
    setShowVideo(true);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      {/* Cảnh báo bài hát chưa có nhạc gốc */}
      {audioSourceName.includes('Synth') && activeChartName !== 'Neon Odyssey' && (
        <div className="w-full mb-3 p-3 rounded-xl bg-[#1a1410] border border-amber-600/40 text-amber-200 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-base text-amber-400">⚠️</span>
            <div>
              <p className="font-semibold text-amber-300">File .osu không kèm nhạc – đang dùng Synth Procedural</p>
              <p className="text-[11px] text-slate-400">Kéo thả file .mp3 / .ogg vào đây hoặc bấm nút Đổi nhạc để nạp nhạc gốc.</p>
            </div>
          </div>
          <label className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-[11px] cursor-pointer whitespace-nowrap shadow transition-all">
            + CHỌN FILE NHẠC (.MP3)
            <input
              type="file"
              accept="audio/*,.ogg,.mp3,.wav"
              onChange={handleCustomAudioUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Arcade Control Deck Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-4 bg-[#0d1017] p-3.5 rounded-2xl border border-[#222838] text-xs shadow-xl">
        <div className="flex items-center gap-3 flex-wrap">
          {onBackToSelect && (
            <button
              onClick={() => {
                if (engineRef.current) engineRef.current.stop();
                onBackToSelect();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1e2538] text-cyan-300 border border-[#27324c] font-mono text-xs font-bold transition-all cursor-pointer shadow"
              title="Quay lại màn hình chọn bài hát"
            >
              <span>←</span>
              <span>CHỌN BÀI</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1e2538] text-slate-300 border border-[#27324c] font-mono text-xs font-semibold transition-all cursor-pointer"
              title="Mở bảng cài đặt AstroDX"
            >
              <span>⚙️</span>
              <span>CÀI ĐẶT</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
            <span className="text-slate-400 font-mono text-[11px]">MAP:</span>
            <span className="font-bold text-white font-mono text-sm tracking-wide">{activeChartName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-[#141824] px-2.5 py-0.5 rounded-md border border-[#2b3348]">
            <span className="text-slate-500">Audio:</span>
            <span className={audioSourceName.includes('Synth') && activeChartName !== 'Neon Odyssey' ? 'text-amber-400 font-bold' : 'text-slate-200 font-medium'}>{audioSourceName}</span>
          </div>

          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-white/10 text-white border border-white/20">
            2-FINGER MODE (MAX 2)
          </span>

          <div className="flex gap-1.5 flex-wrap">
            {onUploadFiles && (
              <label className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 text-black font-bold font-mono text-[10px] cursor-pointer shadow transition-colors">
                + NẠP MAP (.OSZ / MAIMAI)
                <input
                  type="file"
                  accept=".osu,.osz,.zip,.txt,audio/*,image/*"
                  multiple
                  onChange={(e) => onUploadFiles(e.target.files)}
                  className="hidden"
                />
              </label>
            )}
            <label className="px-2.5 py-1 rounded-lg bg-[#181d2a] hover:bg-[#232a3d] text-slate-200 border border-[#2d354a] font-mono text-[10px] cursor-pointer transition-colors">
              🎵 Đổi nhạc...
              <input
                type="file"
                accept="audio/*,.ogg,.mp3,.wav"
                onChange={handleCustomAudioUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={handleSelectBeyondTheAexis}
              className="px-2.5 py-1 rounded-lg bg-[#181d2a] hover:bg-[#232a3d] text-slate-300 border border-[#2d354a] font-mono text-[10px] transition-colors"
            >
              Beyond The Æxis
            </button>
            <button
              onClick={handleSelectSample}
              className="px-2.5 py-1 rounded-lg bg-[#181d2a] hover:bg-[#232a3d] text-slate-300 border border-[#2d354a] font-mono text-[10px] transition-colors"
            >
              Neon Odyssey
            </button>

            {/* Nút bật/tắt Autoplay để test (AP 101.0000%) */}
            <button
              onClick={() => {
                const next = !isAutoplay;
                setIsAutoplay(next);
                if (engineRef.current) engineRef.current.setAutoplay(next);
              }}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold border transition-all cursor-pointer ${
                isAutoplay
                  ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-pulse'
                  : 'bg-[#181d2a] hover:bg-[#232a3d] text-slate-300 border-[#2d354a]'
              }`}
              title="Bật/Tắt chế độ tự động đánh (Autoplay Bot 101.0000% AP)"
            >
              {isAutoplay ? '⚡ AUTOPLAY: BẬT' : '⚡ AUTOPLAY: TẮT'}
            </button>

            {/* Video Controls */}
            <label className="px-2 py-1 rounded-lg bg-[#181d2a] hover:bg-[#232a3d] text-slate-300 border border-[#2d354a] font-mono text-[10px] cursor-pointer transition-colors">
              + VIDEO
              <input
                type="file"
                accept="video/*,.mp4,.webm"
                onChange={handleCustomVideoUpload}
                className="hidden"
              />
            </label>
            {videoSrc && (
              <button
                onClick={() => setShowVideo(!showVideo)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] border transition-colors ${
                  showVideo
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-[#181d2a] text-slate-400 border-[#2d354a]'
                }`}
              >
                {showVideo ? 'VIDEO: BẬT' : 'VIDEO: TẮT'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono text-[11px]">NS:</span>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.1"
              value={noteSpeed}
              onChange={(e) => setNoteSpeed(parseFloat(e.target.value))}
              className="w-20 accent-white"
            />
            <span className="font-mono text-white font-bold w-7">{noteSpeed.toFixed(1)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono text-[11px]">Dim:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(backgroundDim * 100)}
              onChange={(e) => setBackgroundDim(parseInt(e.target.value, 10) / 100)}
              className="w-16 accent-white"
            />
            <span className="font-mono text-slate-300 w-8">{Math.round(backgroundDim * 100)}%</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono text-[11px]">Nhạc:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVol}
              onChange={(e) => setMusicVol(parseInt(e.target.value, 10))}
              className="w-16 accent-white"
            />
            <span className="font-mono text-slate-300 w-8">{musicVol}%</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono text-[11px]">Hit:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={hitVol}
              onChange={(e) => setHitVol(parseInt(e.target.value, 10))}
              className="w-16 accent-yellow-400"
            />
            <span className="font-mono text-yellow-300 w-8">{hitVol}%</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono text-[11px]">Offset:</span>
            <input
              type="number"
              min="-200"
              max="200"
              value={userOffset}
              onChange={(e) => setUserOffset(parseInt(e.target.value || '0', 10))}
              className="w-14 bg-[#0a0d14] border border-[#2b3348] rounded px-1 py-0.5 text-center font-mono text-white"
            />
            <span className="text-slate-500 font-mono text-[10px]">ms</span>
          </div>
        </div>
      </div>

      {/* Main Arcade Cabinet Monitor Bezel (mô phỏng thùng máy Maimai Arcade Image 2) */}
      <div className="relative p-2.5 sm:p-3.5 rounded-[28px] bg-[#11141c] border-2 border-[#262c3c] shadow-[0_25px_60px_rgba(0,0,0,0.95)]">
        {/* Thanh trang trí viền trên cabinet */}
        <div className="flex items-center justify-between px-3 py-1 mb-2 bg-[#090b10] rounded-lg border border-[#1b202e] text-[10px] font-mono text-slate-400">
          <span className="tracking-widest uppercase font-bold text-slate-300">TRIARHYTHM ARCADE DISPLAY</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>120 FPS CALIBRATED</span>
          </span>
        </div>

        {/* Màn hình Canvas chính */}
        <div className="relative rounded-2xl overflow-hidden border border-[#1e2332] bg-[#040507]">
          {/* Video nền hỗ trợ sync <= 80ms (GĐ5) */}
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
            className="block cursor-default relative z-10"
          />

          {/* Nút bấm Skip Break / Intro (nhấn Space hoặc click chuột) */}
          {canSkip && isPlaying && !isPaused && (
            <button
              onClick={() => {
                if (engineRef.current) engineRef.current.skipBreak();
              }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0c101a]/95 hover:bg-cyan-950/90 text-cyan-300 hover:text-white border-2 border-cyan-400 font-mono text-xs font-bold shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all cursor-pointer animate-pulse hover:scale-105 active:scale-95"
              title="Bỏ qua đoạn nghỉ (Nhấn SPACE hoặc Click)"
            >
              <span>⏩</span>
              <span>NHẤN SPACE ĐỂ SKIP (BỎ QUA NGHỈ)</span>
            </button>
          )}

          {/* Overlay khi chưa bắt đầu (Arcade Attract Screen) */}
          {!isPlaying && !gameResult && (
            <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <div className="font-cyber text-4xl sm:text-5xl font-black text-white mb-2 tracking-[0.2em]">
                TRIARHYTHM
              </div>
              <p className="text-xs font-mono text-slate-300 tracking-wider mb-6 uppercase">
                SEGA maimai Style Triangular VSRG • 2-Finger Ergonomics
              </p>

              <button
                onClick={handleStartGame}
                className="px-10 py-3.5 rounded-full font-cyber font-black text-sm tracking-widest bg-white hover:bg-slate-200 text-black shadow-2xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer relative z-40"
              >
                BẮT ĐẦU CHƠI (START)
              </button>

              <div className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Nhấn <kbd className="px-2 py-0.5 rounded bg-slate-800 text-white font-bold border border-slate-700">SPACE</kbd> hoặc click để bắt đầu</span>
              </div>
            </div>
          )}

          {/* Pause Overlay */}
          {isPaused && (
            <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
              <div className="font-cyber text-4xl font-black text-white mb-4 tracking-widest">
                PAUSED
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handlePauseToggle}
                  className="px-6 py-2.5 rounded-xl font-mono text-xs font-bold bg-white text-black hover:bg-slate-200 shadow-lg cursor-pointer"
                >
                  TIẾP TỤC (RESUME)
                </button>
                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="px-6 py-2.5 rounded-xl font-mono text-xs font-bold bg-[#1e2332] hover:bg-[#283044] text-cyan-300 border border-cyan-500/40 cursor-pointer transition-colors"
                  >
                    CÀI ĐẶT / PHÍM
                  </button>
                )}
                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 rounded-xl font-mono text-xs font-bold bg-[#1e2332] hover:bg-[#283044] text-slate-200 border border-[#353d54] cursor-pointer"
                >
                  CHƠI LẠI (RETRY)
                </button>
              </div>
            </div>
          )}

          {/* Result Screen Modal (RhythmTyper Result Screen) */}
          {gameResult && (
            <div className="absolute inset-0 z-30 bg-[#0f0f1a]/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-fadeIn select-none font-sans">
              <div className="text-xs text-indigo-300 font-bold tracking-[0.2em] mb-1 uppercase">TRACK COMPLETED</div>
              
              {/* RhythmTyper Grade Badge */}
              <div className="text-7xl font-black text-white mb-1 tracking-wider drop-shadow-[0_0_25px_rgba(99,102,241,0.6)]">
                {gameResult.rank}
              </div>

              {/* Achievement Rate / Accuracy */}
              <div className="font-mono text-3xl font-black text-white mb-3 tracking-tight">
                {gameResult.achievement.toFixed(2)}%
              </div>

              {/* Stats Cards Row */}
              <div className="flex items-center justify-center gap-3 mb-4 text-xs font-mono">
                <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-white font-bold">
                  SCORE: {(gameResult.score ?? Math.round(gameResult.achievement * 10000)).toLocaleString('en-US')}
                </span>
                {gameResult.stars !== undefined && (
                  <span className="px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-bold">
                    ★ {Number(gameResult.stars).toFixed(2)}
                  </span>
                )}
                {gameResult.pp !== undefined && (
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold">
                    {Number(gameResult.pp).toFixed(2)} PP
                  </span>
                )}
              </div>

              {/* Judgments Grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs font-mono text-slate-300 mb-6 bg-[#16213e] p-4 rounded-2xl border border-white/10 text-left w-80 shadow-lg">
                <div className="flex justify-between"><span className="text-yellow-400">CRITICAL:</span> <span className="font-bold text-white">{gameResult.counts.criticalPerfect}</span></div>
                <div className="flex justify-between"><span className="text-amber-300">PERFECT:</span> <span className="font-bold text-white">{gameResult.counts.perfect}</span></div>
                <div className="flex justify-between"><span className="text-emerald-400">GREAT:</span> <span className="font-bold text-white">{gameResult.counts.great}</span></div>
                <div className="flex justify-between"><span className="text-blue-400">GOOD:</span> <span className="font-bold text-white">{gameResult.counts.good}</span></div>
                <div className="flex justify-between"><span className="text-rose-400">MISS:</span> <span className="font-bold text-rose-400">{gameResult.counts.miss}</span></div>
                <div className="flex justify-between"><span className="text-white">MAX COMBO:</span> <span className="font-bold text-white">{gameResult.maxCombo}</span></div>
                <div className="flex justify-between col-span-2 pt-1.5 border-t border-white/10 text-slate-400">
                  <span>UNSTABLE RATE:</span> <span className="text-slate-200 font-bold">{gameResult.ur}</span>
                </div>
              </div>

              {/* Badges AP / FC */}
              <div className="flex gap-2 mb-6">
                {gameResult.flags.isAP && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/60 text-xs font-bold tracking-wider">
                    ★ ALL PERFECT
                  </span>
                )}
                {gameResult.flags.isFC && !gameResult.flags.isAP && (
                  <span className="px-3 py-1 rounded-full bg-white/20 text-white border border-white/60 text-xs font-bold tracking-wider">
                    FULL COMBO
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 rounded-xl rt-btn-primary text-xs font-bold shadow-lg cursor-pointer"
                >
                  RETRY
                </button>
                <button
                  onClick={() => {
                    setGameResult(null);
                    if (onBackToSelect) onBackToSelect();
                  }}
                  className="px-6 py-2.5 rounded-xl rt-btn-secondary text-xs font-bold cursor-pointer"
                >
                  SONG SELECT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
