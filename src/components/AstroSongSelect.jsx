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
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [leaderboardScores, setLeaderboardScores] = useState([]);
  const [isLoadingScores, setIsLoadingScores] = useState(false);

  const audioRef = useRef(null);

  // Filter beatmaps
  const filteredBeatmaps = beatmaps
    .filter((bm) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const title = (bm.title || bm.metadata?.title || '').toLowerCase();
      const artist = (bm.artist || bm.metadata?.artist || '').toLowerCase();
      const creator = (bm.creator || bm.metadata?.creator || '').toLowerCase();
      return title.includes(q) || artist.includes(q) || creator.includes(q);
    });

  const current = selectedBeatmap || filteredBeatmaps[0] || null;

  // Auto preview on select
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
    audioRef.current.volume = 0.5;

    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlayingPreview(true))
        .catch(() => setIsPlayingPreview(false));
    }

    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, [current?.id]);

  // Difficulty list
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

  // Load leaderboard
  useEffect(() => {
    if (!current?.id) return;
    let isCancelled = false;
    setIsLoadingScores(true);

    apiClient.getMapLeaderboard(current.id, selectedDiff?.difficultyName)
      .then((res) => {
        if (!isCancelled && res?.scores) setLeaderboardScores(res.scores);
      })
      .catch(() => {
        if (!isCancelled) setLeaderboardScores([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingScores(false);
      });

    return () => { isCancelled = true; };
  }, [current?.id, selectedDiff?.difficultyName]);

  const handleTogglePreview = () => {
    if (!audioRef.current || !current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      const audioUrl = current.audioSource || current.serverAssets?.audioUrl || (current.audioBlob instanceof Blob ? URL.createObjectURL(current.audioBlob) : null);
      if (!audioUrl) return;
      if (audioRef.current.src !== audioUrl) audioRef.current.src = audioUrl;
      const previewSec = ((current.previewTime || current.metadata?.previewTime || current.beatmap?.metadata?.previewTime || 0)) / 1000;
      if (audioRef.current.currentTime === 0 && previewSec > 0) audioRef.current.currentTime = previewSec;
      audioRef.current.play().then(() => setIsPlayingPreview(true)).catch(() => {});
    }
  };

  const handleRandomSelect = () => {
    if (filteredBeatmaps.length === 0) return;
    const randIdx = Math.floor(Math.random() * filteredBeatmaps.length);
    onSelectBeatmap(filteredBeatmaps[randIdx]);
  };

  const handleDeleteBeatmap = async (bm) => {
    if (!bm || !bm.id) return;
    const title = bm.title || bm.metadata?.title || 'Untitled';
    if (!window.confirm(`Delete "${title}" from database?`)) return;
    try {
      await dbManager.deleteBeatmap(bm.id);
      try { await apiClient.deleteMap(bm.id); } catch (_) {}
      if (onReloadBeatmaps) await onReloadBeatmaps();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);
    try {
      const result = await importFiles(files, { preset: 'twoFingers', autoSlide: false, overwrite: true });
      if (onReloadBeatmaps) await onReloadBeatmaps();
      if (onSelectBeatmap && result.songEntry) onSelectBeatmap(result.songEntry);
      alert(`Imported "${result.songEntry.title}" with ${result.difficultyCount} difficulties!`);
    } catch (err) {
      alert('Import error: ' + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

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

  const getDiffColor = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('master') || n.includes('remaster') || n.includes('lunatic')) return '#a855f7';
    if (n.includes('expert') || n.includes('insane')) return '#ef4444';
    if (n.includes('advanced') || n.includes('hard')) return '#ff9800';
    return '#66bb6a';
  };

  return (
    <div className="w-full h-[calc(100vh-52px)] mt-[52px] flex select-none overflow-hidden">
      {/* Hidden audio for preview */}
      {current?.audioSource && (
        <audio ref={audioRef} src={current.audioSource} onEnded={() => setIsPlayingPreview(false)} />
      )}

      {/* LEFT: Beatmap List */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.04]">
        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-white/[0.04] shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-xs">⌕</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="type to search..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-full pl-8 pr-4 py-2 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#ff66ab]/50 transition-colors"
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between mt-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#ff66ab] hover:bg-[#ff7ab8] text-white font-bold cursor-pointer transition-colors shadow-[0_0_10px_rgba(255,102,171,0.3)]">
                <span>{isImporting ? '⏳' : '+'}</span>
                <span>{isImporting ? 'Importing...' : 'Import'}</span>
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
                className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-[#b8c0d4] font-semibold cursor-pointer transition-colors"
              >
                🎲 Random
              </button>

              <button
                onClick={onToggleAutoplay}
                className={`px-3 py-1.5 rounded-full font-semibold cursor-pointer transition-all ${
                  isAutoplay
                    ? 'bg-[#ffdd57]/15 text-[#ffdd57] border border-[#ffdd57]/30'
                    : 'bg-white/[0.06] text-[#6b7280] hover:text-[#b8c0d4]'
                }`}
              >
                {isAutoplay ? '⚡ Auto ON' : '⚡ Auto'}
              </button>
            </div>

            <span className="text-[#6b7280] font-mono">{filteredBeatmaps.length} maps</span>
          </div>
        </div>

        {/* Beatmap Cards */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
          {filteredBeatmaps.map((bm) => {
            const isSelected = current?.id === bm.id;
            const bpm = bm.beatmap?.timingPoints?.[0]?.bpm || 120;
            const diffs = bm.difficulties || [];

            return (
              <div
                key={bm.id}
                onClick={() => onSelectBeatmap(bm)}
                className={`osu-card mb-2 ${isSelected ? 'osu-card-selected' : ''}`}
              >
                {/* Cover */}
                <div className="relative w-[100px] h-[100px] shrink-0 bg-[#1a1a2e] overflow-hidden">
                  {(bm.backgroundSource || bm.backgroundBlob) ? (
                    <img
                      src={bm.backgroundSource || (bm.backgroundBlob instanceof Blob ? URL.createObjectURL(bm.backgroundBlob) : '')}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">🎵</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1a1a2e]/80" />
                </div>

                {/* Info */}
                <div className="flex-1 px-3 py-2.5 flex flex-col justify-between min-w-0">
                  <div>
                    <h4 className="font-bold text-sm text-white truncate leading-tight">
                      {bm.title || bm.metadata?.title}
                    </h4>
                    <p className="text-[11px] text-[#b8c0d4] truncate">
                      {bm.artist || bm.metadata?.artist}
                    </p>
                    <p className="text-[10px] text-[#6b7280] truncate">
                      mapped by {bm.creator || bm.metadata?.creator || 'Unknown'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#6b7280] font-mono">{Math.round(bpm)} bpm</span>
                    <div className="flex items-center gap-0.5">
                      {diffs.slice(0, 5).map((d, dIdx) => (
                        <div
                          key={dIdx}
                          title={d.difficultyName}
                          style={{ backgroundColor: getDiffColor(d.difficultyName) }}
                          className="w-1.5 h-3.5 rounded-full opacity-80"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Delete */}
                <div className="px-2 flex items-start pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteBeatmap(bm); }}
                    className="text-[#6b7280] hover:text-[#ef5350] p-1 text-[10px] transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          {filteredBeatmaps.length === 0 && (
            <div className="py-20 text-center text-[#6b7280] text-sm">
              No beatmaps found. Click <span className="text-[#ff66ab] font-bold">+ Import</span> to add songs.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Details Panel */}
      {current && (
        <div className="w-[360px] bg-[#111122] flex flex-col shrink-0 overflow-hidden">
          {/* Cover Banner */}
          <div className="relative w-full h-48 shrink-0 bg-[#1a1a2e]">
            {(current.backgroundSource || current.backgroundBlob) ? (
              <img
                src={current.backgroundSource || (current.backgroundBlob instanceof Blob ? URL.createObjectURL(current.backgroundBlob) : '')}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl opacity-10">🎵</div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#111122] via-[#111122]/60 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-bold text-lg text-white leading-tight truncate">
                {current.title || current.metadata?.title}
              </h3>
              <p className="text-xs text-[#b8c0d4] truncate">{current.artist || current.metadata?.artist}</p>
              <p className="text-[10px] text-[#6b7280] mt-0.5">
                mapped by {current.creator || current.metadata?.creator || 'Unknown'}
              </p>
            </div>

            {/* Preview Button */}
            {(current.audioSource || current.audioBlob) && (
              <button
                onClick={handleTogglePreview}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 hover:bg-[#ff66ab]/60 backdrop-blur-md text-white flex items-center justify-center text-xs transition-all cursor-pointer"
              >
                {isPlayingPreview ? '⏸' : '▶'}
              </button>
            )}
          </div>

          {/* Difficulty Select */}
          <div className="px-4 py-3 border-b border-white/[0.04] shrink-0">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#6b7280] mb-2 uppercase tracking-wider">
              <span>Difficulties ({diffList.length})</span>
              <span className="text-[#ff66ab]">{selectedDiff?.difficultyName}</span>
            </div>

            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto custom-scrollbar">
              {diffList.map((diff, dIdx) => {
                const isActive = selectedDiffIndex === dIdx;
                return (
                  <button
                    key={dIdx}
                    onClick={() => setSelectedDiffIndex(dIdx)}
                    style={{ borderLeftColor: getDiffColor(diff.difficultyName) }}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold border-l-[3px] transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#ff66ab]/10 text-white'
                        : 'bg-white/[0.02] text-[#b8c0d4] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="truncate pr-2">{diff.difficultyName}</span>
                    <span className="text-[10px] text-[#6b7280] font-mono shrink-0">
                      {diff.noteCount || diff.beatmap?.notes?.length || 0} notes
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Leaderboard</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoadingScores ? (
                <div className="h-full flex items-center justify-center text-xs text-[#6b7280]">Loading...</div>
              ) : leaderboardScores.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#6b7280] text-center px-4">
                  No scores yet. Be the first!
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {leaderboardScores.slice(0, 8).map((score, sIdx) => {
                    const rankNum = sIdx + 1;
                    let rankColor = 'text-[#6b7280]';
                    if (rankNum === 1) rankColor = 'text-[#ffdd57]';
                    else if (rankNum === 2) rankColor = 'text-[#b8c0d4]';
                    else if (rankNum === 3) rankColor = 'text-[#ff9800]';

                    return (
                      <div key={score.id || sIdx} className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] px-2.5 py-1.5 rounded-lg text-xs transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 text-center font-bold text-[10px] ${rankColor}`}>#{rankNum}</span>
                          <span className="truncate max-w-[100px] text-white text-[11px]">
                            {score.user?.name || score.user?.username || 'Guest'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-white font-bold text-[11px]">{Number(score.score).toLocaleString()}</span>
                          <span className="text-[#ff66ab] font-bold text-[10px]">{score.rank}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="px-4 py-3 border-t border-white/[0.04] flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenEditor && onOpenEditor(current)}
              className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] flex items-center justify-center text-[#b8c0d4] hover:text-white transition-colors cursor-pointer text-sm shrink-0"
              title="Editor"
            >
              ✎
            </button>

            <button
              onClick={handlePlaySelected}
              className="flex-1 h-10 rounded-full osu-btn flex items-center justify-center gap-2 text-sm font-bold tracking-wider cursor-pointer"
            >
              <span>▶</span>
              <span>Play</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
