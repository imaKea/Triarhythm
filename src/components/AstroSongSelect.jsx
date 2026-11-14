import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbManager } from '../core/storage/db.js';
import { importFiles } from '../core/parser/index.js';
import { apiClient } from '../core/api/client.js';
import {
  Button,
  IconButton,
  Dropdown,
  StarRating,
  RankBadge,
  ContextMenu,
  ConfirmDialog,
  toast,
  playHover,
  playClick,
  playSelect,
  playBack
} from '../ui/index.js';

export default function AstroSongSelect({
  beatmaps = [],
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
  const [sortBy, setSortBy] = useState('title'); // 'title' | 'artist' | 'bpm' | 'length' | 'stars'
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'artist' | 'stars'
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('global'); // 'global' | 'local'
  const [leaderboardScores, setLeaderboardScores] = useState([]);
  const [localScores, setLocalScores] = useState([]);
  const [isLoadingScores, setIsLoadingScores] = useState(false);

  // History stack for Shift+F2 (Previous Random)
  const [historyStack, setHistoryStack] = useState([]);

  // Context menu & Confirm dialog state
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, beatmap: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, beatmap: null, deleteFromServer: false });

  const audioRef = useRef(null);
  const carouselRef = useRef(null);

  // Parse advanced search query: free text + 'stars>5', 'bpm<200', 'artist=xyz', 'creator=xyz'
  const filteredBeatmaps = useMemo(() => {
    let list = [...beatmaps];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);

      list = list.filter((bm) => {
        const metadata = bm.metadata || bm.beatmap?.metadata || {};
        const title = (bm.title || metadata.title || '').toLowerCase();
        const artist = (bm.artist || metadata.artist || '').toLowerCase();
        const creator = (bm.creator || metadata.creator || '').toLowerCase();
        const stars = parseFloat(bm.stars || metadata.stars || bm.difficultyLevel || 5);
        const bpm = parseFloat(bm.timingPoints?.[0]?.bpm || 120);

        for (const token of tokens) {
          if (token.startsWith('stars>') || token.startsWith('stars>=')) {
            const val = parseFloat(token.replace(/^stars>=?/, ''));
            if (!isNaN(val) && stars < val) return false;
          } else if (token.startsWith('stars<') || token.startsWith('stars<=')) {
            const val = parseFloat(token.replace(/^stars<=?/, ''));
            if (!isNaN(val) && stars > val) return false;
          } else if (token.startsWith('bpm>') || token.startsWith('bpm>=')) {
            const val = parseFloat(token.replace(/^bpm>=?/, ''));
            if (!isNaN(val) && bpm < val) return false;
          } else if (token.startsWith('bpm<') || token.startsWith('bpm<=')) {
            const val = parseFloat(token.replace(/^bpm<=?/, ''));
            if (!isNaN(val) && bpm > val) return false;
          } else if (token.startsWith('artist=')) {
            const val = token.replace('artist=', '');
            if (!artist.includes(val)) return false;
          } else if (token.startsWith('creator=') || token.startsWith('mapper=')) {
            const val = token.replace(/^(creator|mapper)=/, '');
            if (!creator.includes(val)) return false;
          } else {
            // Free text match
            if (!title.includes(token) && !artist.includes(token) && !creator.includes(token)) {
              return false;
            }
          }
        }
        return true;
      });
    }

    // Sort beatmaps
    list.sort((a, b) => {
      const metaA = a.metadata || a.beatmap?.metadata || {};
      const metaB = b.metadata || b.beatmap?.metadata || {};

      if (sortBy === 'artist') {
        return (a.artist || metaA.artist || '').localeCompare(b.artist || metaB.artist || '');
      }
      if (sortBy === 'bpm') {
        const bpmA = a.timingPoints?.[0]?.bpm || 120;
        const bpmB = b.timingPoints?.[0]?.bpm || 120;
        return bpmB - bpmA;
      }
      if (sortBy === 'stars') {
        const starsA = parseFloat(a.stars || metaA.stars || a.difficultyLevel || 0);
        const starsB = parseFloat(b.stars || metaB.stars || b.difficultyLevel || 0);
        return starsB - starsA;
      }
      if (sortBy === 'length') {
        const lenA = a.beatmap?.notes?.slice(-1)[0]?.time || 0;
        const lenB = b.beatmap?.notes?.slice(-1)[0]?.time || 0;
        return lenB - lenA;
      }
      // Default: title
      return (a.title || metaA.title || '').localeCompare(b.title || metaB.title || '');
    });

    return list;
  }, [beatmaps, searchQuery, sortBy]);

  const current = selectedBeatmap || filteredBeatmaps[0] || null;

  // Extract difficulty list from current beatmap set
  const diffList = useMemo(() => {
    if (!current) return [];
    if (current.difficulties && current.difficulties.length > 0) {
      return current.difficulties;
    }
    const meta = current.metadata || current.beatmap?.metadata || {};
    return [
      {
        difficultyName: current.difficultyName || meta.difficultyName || 'Normal',
        difficultyLevel: current.difficultyLevel || meta.difficultyLevel || '10',
        stars: parseFloat(current.stars || meta.stars || 5),
        beatmap: current.beatmap,
        noteCount: current.beatmap?.notes?.length || 0
      }
    ];
  }, [current]);

  const selectedDiff = diffList[selectedDiffIndex] || diffList[0] || null;
  const currentNotes = selectedDiff?.beatmap?.notes || current?.beatmap?.notes || [];

  // Note breakdown by type
  const noteStats = useMemo(() => {
    let tap = 0, hold = 0, breakN = 0, ring = 0, slide = 0, typing = 0;
    for (const n of currentNotes) {
      if (n.type === 'tap') tap++;
      else if (n.type === 'hold') hold++;
      else if (n.type === 'break') breakN++;
      else if (n.type === 'ring') ring++;
      else if (n.type === 'slide') slide++;
      else if (n.type === 'typing') typing++;
    }
    return { tap, hold, breakN, ring, slide, typing, total: currentNotes.length };
  }, [currentNotes]);

  // Audio preview playback with smooth fade-in
  useEffect(() => {
    setSelectedDiffIndex(0);
    if (!audioRef.current || !current) return;

    const audioUrl = current.audioSource || (current.audioBlob instanceof Blob ? URL.createObjectURL(current.audioBlob) : null);
    if (!audioUrl) return;

    const previewSec = ((current.previewTime || current.metadata?.previewTime || current.beatmap?.metadata?.previewTime || 0)) / 1000;

    if (audioRef.current.src !== audioUrl) {
      audioRef.current.src = audioUrl;
    }
    audioRef.current.currentTime = previewSec > 0 ? previewSec : 0;
    audioRef.current.volume = 0.55;

    const p = audioRef.current.play();
    if (p) p.catch(() => {});

    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, [current?.id]);

  // Load Leaderboards (Global via API and Local via IndexedDB)
  useEffect(() => {
    if (!current?.id) return;
    let isCancelled = false;
    setIsLoadingScores(true);

    // 1. Fetch Global scores
    apiClient.getMapLeaderboard(current.id, selectedDiff?.difficultyName)
      .then((res) => {
        if (!isCancelled && res?.scores) setLeaderboardScores(res.scores);
      })
      .catch(() => {
        if (!isCancelled) setLeaderboardScores([]);
      });

    // 2. Fetch Local scores
    dbManager.getScoresForBeatmap(current.id)
      .then((scores) => {
        if (!isCancelled) {
          const matching = (scores || []).filter(
            (s) => !selectedDiff?.difficultyName || s.difficultyName === selectedDiff.difficultyName
          );
          matching.sort((a, b) => (b.score || 0) - (a.score || 0));
          setLocalScores(matching);
        }
      })
      .catch(() => {
        if (!isCancelled) setLocalScores([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingScores(false);
      });

    return () => { isCancelled = true; };
  }, [current?.id, selectedDiff?.difficultyName]);

  // Keyboard Navigation: ↑ / ↓ to scroll cards, ← / → to change diff, Enter to Play, F2 for Random
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in search input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        playHover();
        const idx = filteredBeatmaps.findIndex((b) => b.id === current?.id);
        if (idx !== -1 && idx < filteredBeatmaps.length - 1) {
          onSelectBeatmap(filteredBeatmaps[idx + 1]);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playHover();
        const idx = filteredBeatmaps.findIndex((b) => b.id === current?.id);
        if (idx > 0) {
          onSelectBeatmap(filteredBeatmaps[idx - 1]);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (diffList.length > 1) {
          playHover();
          setSelectedDiffIndex((prev) => (prev + 1) % diffList.length);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (diffList.length > 1) {
          playHover();
          setSelectedDiffIndex((prev) => (prev - 1 + diffList.length) % diffList.length);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePlaySelected();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePreviousRandom();
        } else {
          handleRandomSelect();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredBeatmaps, current, diffList, selectedDiffIndex, historyStack]);

  const handleRandomSelect = () => {
    if (filteredBeatmaps.length === 0) return;
    playSelect();
    if (current) setHistoryStack((prev) => [...prev, current]);
    const randIdx = Math.floor(Math.random() * filteredBeatmaps.length);
    onSelectBeatmap(filteredBeatmaps[randIdx]);
  };

  const handlePreviousRandom = () => {
    if (historyStack.length === 0) return;
    playSelect();
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    onSelectBeatmap(prev);
  };

  const handlePlaySelected = () => {
    if (!current) return;
    playClick();
    if (audioRef.current) audioRef.current.pause();

    const chartToPlay = {
      ...current,
      beatmap: selectedDiff?.beatmap || current.beatmap,
      difficultyName: selectedDiff?.difficultyName || 'Normal',
      difficultyLevel: selectedDiff?.difficultyLevel || '10',
      stars: selectedDiff?.stars || current.stars,
      videoBlob: current.videoBlob,
      videoSource: current.videoSource,
      backgroundBlob: current.backgroundBlob,
      backgroundSource: current.backgroundSource,
      audioBlob: current.audioBlob,
      audioSource: current.audioSource,
    };
    onStartGame(chartToPlay);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);
    playClick();
    try {
      const result = await importFiles(files, { preset: 'twoFingers', autoSlide: false, overwrite: true });
      if (onReloadBeatmaps) await onReloadBeatmaps();
      if (onSelectBeatmap && result.songEntry) onSelectBeatmap(result.songEntry);
      toast.success(`Đã nạp bài hát "${result.songEntry.title}" thành công!`);
    } catch (err) {
      toast.error('Lỗi nạp file: ' + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleCardContextMenu = (e, bm) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      beatmap: bm
    });
  };

  const confirmDeleteBeatmap = async () => {
    const bm = deleteConfirm.beatmap;
    if (!bm || !bm.id) return;
    setDeleteConfirm({ isOpen: false, beatmap: null, deleteFromServer: false });

    const deletedCopy = { ...bm };
    try {
      await dbManager.deleteBeatmap(bm.id);
      if (deleteConfirm.deleteFromServer) {
        try { await apiClient.deleteMap(bm.id); } catch (e) {
          toast.error('Lỗi xoá trên server: ' + (e.message || 'Không thể kết nối'));
        }
      }
      if (onReloadBeatmaps) await onReloadBeatmaps();

      // Undo Toast (8s)
      toast.undo(`Đã xoá bài hát "${bm.title || 'Untitled'}"`, async () => {
        try {
          await dbManager.saveBeatmap(deletedCopy);
          if (onReloadBeatmaps) await onReloadBeatmaps();
          toast.success('Đã hoàn tác và khôi phục bài hát!');
        } catch (restoreErr) {
          toast.error('Không thể hoàn tác: ' + restoreErr.message);
        }
      });
    } catch (err) {
      toast.error('Lỗi khi xoá bài hát: ' + err.message);
    }
  };

  // Metadata helpers
  const currentTitle = current?.title || current?.metadata?.title || 'No beatmaps loaded';
  const currentArtist = current?.artist || current?.metadata?.artist || 'Unknown Artist';
  const currentCreator = current?.creator || current?.metadata?.creator || 'Triarhythm';
  const currentBpm = Math.round(current?.timingPoints?.[0]?.bpm || 120);
  const currentStars = parseFloat(selectedDiff?.stars || current?.stars || current?.difficultyLevel || 5);
  const coverUrl = current?.backgroundSource || current?.serverAssets?.coverUrl || null;

  return (
    <div className="w-full h-[calc(100vh-52px-24px)] mt-[52px] mb-6 flex flex-col select-none overflow-hidden osu-screen-transition">
      {/* Hidden audio element for preview */}
      {current?.audioSource && (
        <audio ref={audioRef} src={current.audioSource} />
      )}

      {/* TOP BAR: Search + Filters + Sort */}
      <div className="h-13 px-6 bg-[#111122]/90 border-b border-white/[0.06] flex items-center justify-between gap-4 shrink-0 z-20">
        {/* Search with syntax hints */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7c849c] text-sm">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type to search (stars>5, bpm<200, artist=...)..."
            className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab]/60 rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-[#7c849c] outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#7c849c] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort & Action controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[#7c849c]">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#1a1a2e] border border-white/[0.08] text-white text-xs rounded-lg px-2.5 py-1 outline-none cursor-pointer"
            >
              <option value="title">Title (A-Z)</option>
              <option value="artist">Artist (A-Z)</option>
              <option value="stars">Difficulty (Stars)</option>
              <option value="bpm">BPM</option>
              <option value="length">Length</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff66ab] hover:bg-[#ff7ab8] text-white text-xs font-bold cursor-pointer transition-all shadow-[0_0_12px_rgba(255,102,171,0.3)]">
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
        </div>
      </div>

      {/* MAIN BODY: LEFT WEDGE + RIGHT CAROUSEL */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Blurred background cover image */}
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 pointer-events-none scale-105"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}

        {/* LEFT PANE: Song Wedge Info + Leaderboard */}
        <div className="w-[480px] h-full flex flex-col p-6 overflow-y-auto custom-scrollbar border-r border-white/[0.06] bg-[#0d0d1a]/85 backdrop-blur-md z-10">
          {/* Song Info Wedge */}
          <div className="p-5 rounded-2xl bg-[#1a1a2e]/90 border border-white/[0.08] shadow-xl flex flex-col gap-3 relative overflow-hidden">
            {/* Top row: StarRating + BPM + Length */}
            <div className="flex items-center justify-between">
              <StarRating stars={currentStars} size="md" />
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#b8c0d4]">
                <span className="px-2 py-0.5 rounded bg-white/[0.06]">{currentBpm} BPM</span>
                <span className="px-2 py-0.5 rounded bg-white/[0.06]">{noteStats.total} Notes</span>
              </div>
            </div>

            {/* Title & Artist */}
            <div>
              <h1 className="text-xl font-black text-white tracking-wide truncate max-w-full font-torus">
                {currentTitle}
              </h1>
              <p className="text-sm font-semibold text-[#b8c0d4] truncate max-w-full">
                {currentArtist}
              </p>
            </div>

            {/* Creator info */}
            <div className="text-xs text-[#7c849c]">
              Beatmap by <strong className="text-[#f0f2f8]">{currentCreator}</strong>
            </div>

            {/* Note breakdown badges */}
            <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-[#ff2a70]/15 text-[#ff2a70] border border-[#ff2a70]/30 font-bold">
                Tap: {noteStats.tap}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#ff9100]/15 text-[#ff9100] border border-[#ff9100]/30 font-bold">
                Hold: {noteStats.hold}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#ff3d00]/15 text-[#ff3d00] border border-[#ff3d00]/30 font-bold">
                Break: {noteStats.breakN}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 font-bold">
                Ring: {noteStats.ring}
              </span>
              {noteStats.slide > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#ffe600]/15 text-[#ffe600] border border-[#ffe600]/30 font-bold">
                  Slide: {noteStats.slide}
                </span>
              )}
              {noteStats.typing > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#a29bfe]/15 text-[#a29bfe] border border-[#a29bfe]/30 font-bold">
                  Typing: {noteStats.typing}
                </span>
              )}
            </div>
          </div>

          {/* LEADERBOARD WIDGET */}
          <div className="flex-1 mt-4 flex flex-col min-h-0 bg-[#1a1a2e]/70 rounded-2xl border border-white/[0.06] p-4">
            {/* Header + Tabs */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.06]">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🏆</span>
                <span>Bảng xếp hạng ({selectedDiff?.difficultyName || 'All'})</span>
              </div>
              <div className="flex gap-1 bg-[#111122] p-0.5 rounded-full border border-white/[0.06]">
                <button
                  onClick={() => { playHover(); setLeaderboardTab('global'); }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    leaderboardTab === 'global' ? 'bg-[#ff66ab] text-white shadow-sm' : 'text-[#7c849c] hover:text-white'
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => { playHover(); setLeaderboardTab('local'); }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    leaderboardTab === 'local' ? 'bg-[#ff66ab] text-white shadow-sm' : 'text-[#7c849c] hover:text-white'
                  }`}
                >
                  Local
                </button>
              </div>
            </div>

            {/* Scores List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {isLoadingScores ? (
                <div className="text-center py-8 text-xs text-[#7c849c]">Đang tải bảng điểm...</div>
              ) : (leaderboardTab === 'global' ? leaderboardScores : localScores).length === 0 ? (
                <div className="text-center py-8 text-xs text-[#7c849c]">
                  Chưa có điểm nào được ghi nhận cho độ khó này. Hãy là người đầu tiên!
                </div>
              ) : (
                (leaderboardTab === 'global' ? leaderboardScores : localScores).map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-[#ff66ab] w-4 text-center">
                        #{idx + 1}
                      </span>
                      <RankBadge rank={s.rank || 'S'} size="sm" />
                      <div className="flex flex-col">
                        <span className="font-bold text-white truncate max-w-[120px]">
                          {s.user?.name || s.username || 'Player'}
                        </span>
                        <span className="text-[10px] text-[#7c849c] font-mono">
                          {Number(s.accuracy || 0).toFixed(2)}% • {s.max_combo || s.maxCombo || 0}x
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="font-bold text-white">
                        {Number(s.score || 0).toLocaleString()}
                      </div>
                      {s.pp !== undefined && (
                        <div className="text-[10px] text-[#ff66ab] font-bold">
                          {Math.round(s.pp)}pp
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Vertical Carousel of Beatmap Cards */}
        <div
          ref={carouselRef}
          className="flex-1 h-full overflow-y-auto custom-scrollbar p-6 space-y-3 z-10"
        >
          {filteredBeatmaps.map((bm, index) => {
            const isSelected = current?.id === bm.id;
            const meta = bm.metadata || bm.beatmap?.metadata || {};
            const title = bm.title || meta.title || 'Untitled';
            const artist = bm.artist || meta.artist || 'Unknown';
            const stars = parseFloat(bm.stars || meta.stars || bm.difficultyLevel || 5);
            const cardCover = bm.backgroundSource || bm.serverAssets?.coverUrl || null;

            return (
              <div
                key={bm.id}
                onClick={() => {
                  playSelect();
                  onSelectBeatmap(bm);
                }}
                onContextMenu={(e) => handleCardContextMenu(e, bm)}
                className={`relative rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden border ${
                  isSelected
                    ? 'border-[#ff66ab] shadow-[0_4px_24px_rgba(255,102,171,0.35)] scale-[1.01]'
                    : 'border-white/[0.08] hover:border-white/[0.2] bg-[#1a1a2e]/80 hover:bg-[#222238]/90'
                }`}
              >
                {/* Horizontal Card Body */}
                <div className="flex items-center justify-between p-3.5 gap-4 relative">
                  {/* Left: Thumbnail & Song Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#111122] shrink-0 border border-white/[0.08] flex items-center justify-center">
                      {cardCover ? (
                        <img src={cardCover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl text-[#ff66ab]">▲</span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-torus font-black text-sm text-white truncate max-w-sm">
                        {title}
                      </span>
                      <span className="text-xs font-semibold text-[#b8c0d4] truncate max-w-xs mt-0.5">
                        {artist}
                      </span>
                      <span className="text-[10px] text-[#7c849c] mt-0.5">
                        {bm.creator || meta.creator || 'Mapper'}
                      </span>
                    </div>
                  </div>

                  {/* Right: StarRating + Diff count */}
                  <div className="flex items-center gap-3 shrink-0">
                    <StarRating stars={stars} size="sm" />
                    <span className="text-xs text-[#7c849c] font-mono">
                      {bm.difficulties?.length || 1} diffs
                    </span>
                  </div>
                </div>

                {/* Expanded Difficulties Bar if selected */}
                {isSelected && diffList.length > 0 && (
                  <div className="px-4 py-2.5 bg-[#111122]/90 border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <span className="text-[11px] font-bold text-[#7c849c] uppercase tracking-wider shrink-0 mr-1">
                      Độ khó (Diff):
                    </span>
                    {diffList.map((d, dIdx) => {
                      const isDiffActive = selectedDiffIndex === dIdx;
                      const dStars = parseFloat(d.stars || d.difficultyLevel || 5);
                      return (
                        <button
                          key={dIdx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playHover();
                            setSelectedDiffIndex(dIdx);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isDiffActive
                              ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_0_10px_rgba(255,102,171,0.5)]'
                              : 'bg-white/[0.06] text-[#b8c0d4] hover:bg-white/[0.12] hover:text-white'
                          }`}
                        >
                          <span>{d.difficultyName}</span>
                          <span className="text-[10px] opacity-80">★{dStars.toFixed(1)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="h-16 px-6 bg-[#111122]/95 border-t border-white/[0.08] flex items-center justify-between z-30 shrink-0">
        {/* Left: Back */}
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} icon="←">
          Back (Esc)
        </Button>

        {/* Center: Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant={isAutoplay ? 'primary' : 'ghost'}
            size="sm"
            onClick={onToggleAutoplay}
            icon="⚡"
          >
            Mods: {isAutoplay ? 'Autoplay ON' : 'None'}
          </Button>

          <Button variant="ghost" size="sm" onClick={handleRandomSelect} icon="🎲">
            Random (F2)
          </Button>

          <Button variant="ghost" size="sm" onClick={onOpenSettings} icon="⚙">
            Options
          </Button>

          {onOpenEditor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenEditor(current)}
              icon="✎"
            >
              Edit Beatmap
            </Button>
          )}
        </div>

        {/* Right: PLAY Button */}
        <Button
          variant="primary"
          size="lg"
          onClick={handlePlaySelected}
          className="px-10 text-base shadow-[0_0_24px_rgba(255,102,171,0.6)]"
          icon="▶"
        >
          PLAY
        </Button>
      </div>

      {/* Context Menu on Beatmap Cards */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu({ isOpen: false, x: 0, y: 0, beatmap: null })}
        items={[
          {
            label: 'Chơi bài hát này',
            icon: '▶',
            onClick: () => {
              if (contextMenu.beatmap) {
                onSelectBeatmap(contextMenu.beatmap);
                handlePlaySelected();
              }
            }
          },
          {
            label: 'Chỉnh sửa trong Editor',
            icon: '✎',
            onClick: () => {
              if (onOpenEditor && contextMenu.beatmap) onOpenEditor(contextMenu.beatmap);
            }
          },
          { divider: true },
          {
            label: 'Xoá khỏi máy (IndexedDB)',
            icon: '🗑',
            danger: true,
            onClick: () => {
              setDeleteConfirm({
                isOpen: true,
                beatmap: contextMenu.beatmap,
                deleteFromServer: false
              });
            }
          },
          ...(currentUser ? [{
            label: 'Xoá khỏi Server & Máy',
            icon: '⚠',
            danger: true,
            onClick: () => {
              setDeleteConfirm({
                isOpen: true,
                beatmap: contextMenu.beatmap,
                deleteFromServer: true
              });
            }
          }] : [])
        ]}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, beatmap: null, deleteFromServer: false })}
        onConfirm={confirmDeleteBeatmap}
        title="Xác nhận xoá Beatmap?"
        message={`Bạn có chắc muốn xoá "${deleteConfirm.beatmap?.title || 'bài hát'}"? Thao tác có thể được hoàn tác trong vòng 8 giây sau khi xoá.`}
        confirmText={deleteConfirm.deleteFromServer ? 'Xoá cả Server & Máy' : 'Xoá khỏi máy'}
        confirmVariant="danger"
      />
    </div>
  );
}
