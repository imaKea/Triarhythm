import React, { useState, useEffect, useRef } from 'react';
import { dbManager } from '../core/storage/db.js';
import { importFiles } from '../core/parser/index.js';
import { apiClient } from '../core/api/client.js';

export default function AstroSongSelect({
  beatmaps,
  selectedBeatmap,
  onSelectBeatmap,
  onStartGame,
  onOpenSettings,
  onOpenEditor,
  currentUser,
  onOpenAuth,
  isAutoplay,
  onToggleAutoplay,
  onReloadBeatmaps
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'MAIMAI' | 'OSU'
  const [sortBy, setSortBy] = useState('DEFAULT'); // 'DEFAULT' | 'TITLE' | 'ARTIST' | 'BPM'
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [leaderboardScores, setLeaderboardScores] = useState([]);
  const [isLoadingScores, setIsLoadingScores] = useState(false);

  const audioRef = useRef(null);

  // Lọc và sắp xếp bài hát theo phong cách RhythmTyper
  const filteredBeatmaps = beatmaps
    .filter((bm) => {
      const isMaimai = (bm.source === 'maimai') || (bm.metadata?.source === 'maimai') || (bm.id && bm.id.startsWith('maimai'));
      if (categoryFilter === 'MAIMAI' && !isMaimai) return false;
      if (categoryFilter === 'OSU' && isMaimai) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const title = (bm.title || bm.metadata?.title || '').toLowerCase();
      const artist = (bm.artist || bm.metadata?.artist || '').toLowerCase();
      const creator = (bm.creator || bm.metadata?.creator || '').toLowerCase();
      return title.includes(q) || artist.includes(q) || creator.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'TITLE') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'ARTIST') {
        return (a.artist || '').localeCompare(b.artist || '');
      }
      if (sortBy === 'BPM') {
        const bpmA = a.beatmap?.timingPoints?.[0]?.bpm || 120;
        const bpmB = b.beatmap?.timingPoints?.[0]?.bpm || 120;
        return bpmB - bpmA;
      }
      return 0;
    });

  const current = selectedBeatmap || filteredBeatmaps[0] || null;

  // Tự động phát nhạc nghe trước (preview) tại previewTime khi chọn hoặc đổi bài hát
  useEffect(() => {
    setSelectedDiffIndex(0);
    if (!audioRef.current || !current) return;

    const audioUrl = current.audioSource || (current.audioBlob instanceof Blob ? URL.createObjectURL(current.audioBlob) : null);
    if (!audioUrl) {
      setIsPlayingPreview(false);
      return;
    }

    const previewSec = ((current.previewTime || current.metadata?.previewTime || current.beatmap?.metadata?.previewTime || 0)) / 1000;

    if (audioRef.current.src !== audioUrl) {
      audioRef.current.src = audioUrl;
    }
    audioRef.current.currentTime = previewSec > 0 ? previewSec : 0;
    audioRef.current.volume = 0.7;

    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlayingPreview(true))
        .catch(() => {
          setIsPlayingPreview(false);
        });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [current?.id]);

  // Trích xuất danh sách độ khó
  const diffList = current?.difficulties && current.difficulties.length > 0
    ? current.difficulties
    : [
        {
          difficultyName: current?.difficultyName || current?.beatmap?.metadata?.difficultyName || 'Normal',
          difficultyLevel: current?.difficultyLevel || '10',
          beatmap: current?.beatmap,
          noteCount: current?.beatmap?.notes?.length || 0
        }
      ];

  const selectedDiff = diffList[selectedDiffIndex] || diffList[0];

  // Nạp bảng xếp hạng online của map & diff từ MySQL
  useEffect(() => {
    if (!current?.id) return;
    let isCancelled = false;
    setIsLoadingScores(true);

    apiClient.getMapLeaderboard(current.id, selectedDiff?.difficultyName)
      .then((res) => {
        if (!isCancelled && res?.scores) {
          setLeaderboardScores(res.scores);
        }
      })
      .catch(() => {
        if (!isCancelled) setLeaderboardScores([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingScores(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [current?.id, selectedDiff?.difficultyName]);

  // Nghe thử bài hát (Play/Pause Audio Preview)
  const handleTogglePreview = () => {
    if (!audioRef.current || !current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      const audioUrl = current.audioSource || (current.audioBlob instanceof Blob ? URL.createObjectURL(current.audioBlob) : null);
      if (!audioUrl) return;
      if (audioRef.current.src !== audioUrl) {
        audioRef.current.src = audioUrl;
      }
      const previewSec = ((current.previewTime || current.metadata?.previewTime || current.beatmap?.metadata?.previewTime || 0)) / 1000;
      if (audioRef.current.currentTime === 0 && previewSec > 0) {
        audioRef.current.currentTime = previewSec;
      }
      audioRef.current.play().then(() => {
        setIsPlayingPreview(true);
      }).catch((e) => {
        console.warn('Lỗi phát âm thanh:', e);
      });
    }
  };

  // Chọn ngẫu nhiên một bài hát
  const handleRandomSelect = () => {
    if (filteredBeatmaps.length === 0) return;
    const randIdx = Math.floor(Math.random() * filteredBeatmaps.length);
    onSelectBeatmap(filteredBeatmaps[randIdx]);
  };

  // Xóa map khỏi Database
  const handleDeleteBeatmap = async (bm) => {
    if (!bm || !bm.id) return;
    const title = bm.title || bm.metadata?.title || 'Untitled';
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài hát "${title}" khỏi Database không?`)) return;

    try {
      await dbManager.deleteBeatmap(bm.id);
      try { await apiClient.deleteMap(bm.id); } catch (_) {}
      if (onReloadBeatmaps) await onReloadBeatmaps();
      alert(`Đã xóa thành công bài hát "${title}"!`);
    } catch (err) {
      alert(`Lỗi khi xóa bài: ${err.message}`);
    }
  };

  // Nạp map qua một nút duy nhất (hỗ trợ .osz, .zip maimai, .osu, maidata.txt)
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);

    try {
      const result = await importFiles(files, { preset: 'twoFingers', autoSlide: false });

      if (result.status === 'duplicate') {
        alert(`Bản đồ "${result.songEntry?.title || 'Bản đồ'}" đã tồn tại trong Database!`);
        return;
      }

      if (result.songEntry) {
        try {
          await apiClient.saveMap({
            song_id: result.songEntry.id,
            title: result.songEntry.title,
            artist: result.songEntry.artist,
            creator: result.songEntry.creator,
            source: result.songEntry.source || 'maimai',
            bpm: result.songEntry.beatmap?.timingPoints?.[0]?.bpm || 120,
            preview_time: result.songEntry.beatmap?.metadata?.previewTime || 0,
            cover_url: result.songEntry.backgroundSource || null,
            audio_url: result.songEntry.audioSource || null,
            video_url: result.songEntry.videoSource || null,
            difficulties: result.songEntry.difficulties?.map((d) => ({
              difficultyName: d.difficultyName,
              difficultyLevel: d.difficultyLevel,
              noteCount: d.noteCount,
            })) || [],
          });
        } catch (_) {}
      }

      if (onReloadBeatmaps) await onReloadBeatmaps();
      if (onSelectBeatmap && result.songEntry) onSelectBeatmap(result.songEntry);

      const kindLabel = result.kind === 'package'
        ? (result.songEntry?.beatmap?.keys ? ` (OSU ${result.songEntry.beatmap.keys}K)` : '')
        : (result.kind === 'maidata' ? ' (Maimai DX)' : '');

      alert(`Đã nạp thành công "${result.songEntry.title}"${kindLabel} với ${result.difficultyCount} độ khó!`);
    } catch (err) {
      alert('Lỗi nạp file map: ' + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  // Khởi động Gameplay với độ khó đã chọn
  const handlePlaySelected = () => {
    if (!current) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    }
    const chartToPlay = {
      ...current,
      beatmap: selectedDiff.beatmap || current.beatmap,
      difficultyName: selectedDiff.difficultyName,
      difficultyLevel: selectedDiff.difficultyLevel,
      videoBlob: current.videoBlob,
      videoSource: current.videoSource,
      backgroundBlob: current.backgroundBlob,
      backgroundSource: current.backgroundSource,
      audioBlob: current.audioBlob,
      audioSource: current.audioSource,
    };
    onStartGame(chartToPlay);
  };

  return (
    <div className="w-full max-w-7xl h-[calc(100vh-80px)] mt-16 flex flex-col font-sans text-white select-none overflow-hidden">
      {/* Hidden audio tag for song preview */}
      {current?.audioSource && (
        <audio
          ref={audioRef}
          src={current.audioSource}
          onEnded={() => setIsPlayingPreview(false)}
        />
      )}

      {/* RhythmTyper Search & Filter Header (Matching _11ho1_) */}
      <div className="w-full bg-[#16213e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-4 shadow-lg shrink-0">
        {/* Full-width Search Input */}
        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by song title, artist, or mapper..."
            className="w-full bg-[#2a2a3e] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter Row: Category + Sort + Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-[#2a2a3e] p-1 rounded-xl border border-white/10">
              <span className="text-[11px] font-bold text-slate-400 px-2 uppercase">Category:</span>
              {[
                { id: 'ALL', label: 'All Maps' },
                { id: 'MAIMAI', label: 'Maimai DX' },
                { id: 'OSU', label: 'Osu!mania' }
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    categoryFilter === c.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 bg-[#2a2a3e] px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="DEFAULT" className="bg-[#1e293b]">Default</option>
                <option value="TITLE" className="bg-[#1e293b]">Song Title</option>
                <option value="ARTIST" className="bg-[#1e293b]">Artist</option>
                <option value="BPM" className="bg-[#1e293b]">BPM (High - Low)</option>
              </select>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Nút Import Beatmap */}
            <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wide transition-all cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.35)]">
              <span>{isImporting ? '⏳' : '📥'}</span>
              <span>{isImporting ? 'Importing...' : 'Import Beatmap'}</span>
              <input
                type="file"
                multiple
                accept=".osz,.zip,.osu,.txt,audio/*,image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isImporting}
              />
            </label>

            <button
              onClick={handleRandomSelect}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-200 border border-white/10 font-semibold transition-colors cursor-pointer"
              title="Pick Random Beatmap"
            >
              <span>🎲</span>
              <span>Random</span>
            </button>

            <button
              onClick={onToggleAutoplay}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold transition-all cursor-pointer ${
                isAutoplay
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 border-white/10'
              }`}
            >
              <span>⚡</span>
              <span>Auto: {isAutoplay ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={onReloadBeatmaps}
              className="w-9 h-9 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="Reload Beatmaps"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Beatmap List (Left) + Selected Beatmap Details & Leaderboard (Right) */}
      <div className="flex-1 flex gap-5 overflow-hidden">
        {/* Left Side: Beatmap Cards Grid (Matching RhythmTyper _beatmapGrid_1wxju_18) */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredBeatmaps.map((bm) => {
              const isSelected = current?.id === bm.id;
              const isMaimai = (bm.source === 'maimai') || (bm.metadata?.source === 'maimai') || (bm.id && bm.id.startsWith('maimai'));
              const diffs = bm.difficulties || [];
              const bpm = bm.beatmap?.timingPoints?.[0]?.bpm || 120;

              return (
                <div
                  key={bm.id}
                  onClick={() => onSelectBeatmap(bm)}
                  className={`rt-card ${isSelected ? 'rt-card-selected' : ''}`}
                >
                  {/* Left: Cover Art with Hover Play Button */}
                  <div className="relative w-[120px] h-[120px] shrink-0 bg-[#2a2a3e] overflow-hidden group">
                    {(bm.backgroundSource || bm.backgroundBlob) ? (
                      <img
                        src={bm.backgroundSource || (bm.backgroundBlob instanceof Blob ? URL.createObjectURL(bm.backgroundBlob) : '')}
                        alt="Jacket"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">
                        {isMaimai ? '💿' : '🎹'}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg text-sm">
                        ▶
                      </div>
                    </div>
                  </div>

                  {/* Center: Main Beatmap Content */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <h4 className="font-bold text-sm text-white truncate leading-tight">
                        {bm.title || bm.metadata?.title}
                      </h4>
                      <p className="text-xs text-slate-300 truncate mt-0.5">
                        {bm.artist || bm.metadata?.artist}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        Mapped by {bm.creator || bm.metadata?.creator || 'Unknown'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      {/* Stats & Badge */}
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-bold font-mono">
                          {isMaimai ? 'MAIMAI DX' : 'OSU! 5K/7K'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ⚡ {Math.round(bpm)} BPM
                        </span>
                      </div>

                      {/* Difficulty Pills (Vertical Bars matching RhythmTyper) */}
                      <div className="flex items-center gap-1">
                        {diffs.slice(0, 5).map((d, dIdx) => {
                          const dLower = (d.difficultyName || '').toLowerCase();
                          let pColor = '#10b981'; // Green
                          if (dLower.includes('master') || dLower.includes('remaster')) pColor = '#a855f7'; // Purple
                          else if (dLower.includes('expert') || dLower.includes('insane')) pColor = '#ef4444'; // Red
                          else if (dLower.includes('advanced') || dLower.includes('hard')) pColor = '#f59e0b'; // Amber

                          return (
                            <div
                              key={dIdx}
                              title={`${d.difficultyName} (${d.difficultyLevel || ''})`}
                              style={{ backgroundColor: pColor }}
                              className="w-1.5 h-4 rounded-full"
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Card Actions */}
                  <div className="p-2 flex flex-col justify-between items-center border-l border-white/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBeatmap(bm);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1 text-xs transition-colors cursor-pointer"
                      title="Delete Beatmap"
                    >
                      🗑️
                    </button>
                    <div className="text-indigo-400 text-xs font-bold">
                      {isSelected ? '●' : ''}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredBeatmaps.length === 0 && (
              <div className="col-span-full py-24 text-center text-slate-400 font-medium text-sm bg-[#16213e]/40 rounded-2xl border border-white/10">
                No beatmaps found. Click "Import Beatmap" to add new songs!
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Selected Beatmap Details & Online Leaderboard Pane */}
        {current && (
          <div className="w-[380px] bg-[#1a1a2e] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl shrink-0 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Cover Art Banner with Audio Preview */}
              <div className="relative w-full h-44 rounded-xl overflow-hidden mb-4 border border-white/10 shrink-0 bg-[#2a2a3e]">
                {(current.backgroundSource || current.backgroundBlob) ? (
                  <img
                    src={current.backgroundSource || (current.backgroundBlob instanceof Blob ? URL.createObjectURL(current.backgroundBlob) : '')}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">
                    🎵
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-600/80 text-white text-[11px] font-bold">
                      {(current.source === 'maimai' || current.id?.startsWith('maimai')) ? 'MAIMAI DX' : 'OSU!MANIA'}
                    </span>

                    {(current.audioSource || current.audioBlob) && (
                      <button
                        onClick={handleTogglePreview}
                        className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span>{isPlayingPreview ? '⏸' : '▶'}</span>
                        <span>{isPlayingPreview ? 'Pause' : 'Preview'}</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-white leading-tight truncate">
                      {current.title || current.metadata?.title}
                    </h3>
                    <p className="text-xs text-slate-300 truncate mt-0.5">
                      {current.artist || current.metadata?.artist}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mapped by {current.creator || current.metadata?.creator || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Difficulty Selection */}
              <div className="mb-4 shrink-0">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                  <span>DIFFICULTIES ({diffList.length})</span>
                  <span className="text-indigo-400">{selectedDiff?.difficultyName}</span>
                </div>

                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {diffList.map((diff, dIdx) => {
                    const isSelected = selectedDiffIndex === dIdx;
                    const dLower = (diff.difficultyName || '').toLowerCase();
                    let borderColor = '#10b981';
                    if (dLower.includes('master') || dLower.includes('remaster')) borderColor = '#a855f7';
                    else if (dLower.includes('expert') || dLower.includes('insane')) borderColor = '#ef4444';
                    else if (dLower.includes('advanced') || dLower.includes('hard')) borderColor = '#f59e0b';

                    return (
                      <button
                        key={dIdx}
                        onClick={() => setSelectedDiffIndex(dIdx)}
                        style={{ borderLeftColor: borderColor }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border-l-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/30 text-white border-t border-r border-b border-indigo-500/60 shadow'
                            : 'bg-[#2a2a3e] text-slate-300 hover:bg-[#3a3a4e] border-t border-r border-b border-transparent'
                        }`}
                      >
                        <span className="truncate pr-2">{diff.difficultyName}</span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span>{diff.difficultyLevel || ''}</span>
                          <span className="text-slate-400 text-[10px]">
                            {diff.noteCount || diff.beatmap?.notes?.length || 0} notes
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Leaderboard for Selected Difficulty */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[#16213e]/70 rounded-xl border border-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span>🏆</span>
                    <span>LEADERBOARD</span>
                  </span>
                  <span className="text-[10px] font-mono text-indigo-400">MySQL Database</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {isLoadingScores ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      Loading records...
                    </div>
                  ) : leaderboardScores.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center px-4">
                      No plays recorded yet. Be the first to set a highscore!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {leaderboardScores.slice(0, 5).map((score, sIdx) => {
                        const rankNum = sIdx + 1;
                        let rankColor = 'text-slate-400';
                        if (rankNum === 1) rankColor = 'text-amber-400 font-bold';
                        else if (rankNum === 2) rankColor = 'text-slate-200 font-bold';
                        else if (rankNum === 3) rankColor = 'text-amber-600 font-bold';

                        return (
                          <div
                            key={score.id || sIdx}
                            className="flex items-center justify-between bg-[#2a2a3e] px-2.5 py-1.5 rounded-lg text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-4 text-center font-bold ${rankColor}`}>#{rankNum}</span>
                              <img
                                src={score.user?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                                alt=""
                                className="w-5 h-5 rounded-full"
                              />
                              <span className="truncate max-w-[90px] font-medium text-white text-[11px]">
                                {score.user?.name || score.user?.username || 'Guest'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-white font-bold text-[11px]">
                                {Number(score.score).toLocaleString()}
                              </span>
                              <span className="text-amber-300 font-bold text-[10px]">
                                {score.rank}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions: Editor + PLAY BEATMAP */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => onOpenEditor && onOpenEditor(current)}
                className="w-12 h-12 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer text-base shrink-0"
                title="Open Beatmap Editor"
              >
                ✏️
              </button>

              <button
                onClick={handlePlaySelected}
                className="flex-1 h-12 rounded-xl rt-btn-primary flex items-center justify-center gap-2 text-sm tracking-wider cursor-pointer"
              >
                <span>PLAY BEATMAP</span>
                <span>▶</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
