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
  Modal,
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
  const [mobileTab, setMobileTab] = useState('list'); // 'list' | 'info' trên màn hình mobile

  // History stack for Shift+F2 (Previous Random)
  const [historyStack, setHistoryStack] = useState([]);

  // Context menu & Confirm dialog state
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, beatmap: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, beatmap: null, deleteFromServer: false });

  // Ngăn xếp hoàn tác xóa bài hát (Undo Ctrl+Z)
  const deletedStackRef = useRef([]);

  // Quản lý Thùng rác (Trash Bin)
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [trashMaps, setTrashMaps] = useState([]);

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
    const fetchLocal = dbManager.getScoresByBeatmap || dbManager.getScoresForBeatmap;
    if (fetchLocal) {
      fetchLocal.call(dbManager, current.id)
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
    } else {
      if (!isCancelled) setIsLoadingScores(false);
    }

    return () => { isCancelled = true; };
  }, [current?.id, selectedDiff?.difficultyName]);

  // Keyboard Navigation: ↑ / ↓ to scroll cards, ← / → to change diff, Enter to Play, F2 for Random
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in search input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Phím tắt Ctrl+Z / Cmd+Z: Hoàn tác xóa bài hát vừa xóa
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndoDelete();
        return;
      }

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

  // Hoàn tác xóa bài hát vừa xóa (Undo / Ctrl+Z)
  const handleUndoDelete = async () => {
    if (deletedStackRef.current.length === 0) {
      toast.info('Không có bài hát nào gần đây để hoàn tác.');
      return;
    }

    const last = deletedStackRef.current.pop();
    if (!last || !last.beatmap) return;

    try {
      await dbManager.restoreBeatmap(last.beatmap.id);
      if (last.deleteFromServer) {
        try {
          await apiClient.restoreMap(last.beatmap.id);
        } catch (_) {}
      }
      if (last.toastId) {
        toast.dismiss(last.toastId);
      }
      if (onReloadBeatmaps) await onReloadBeatmaps();
      onSelectBeatmap(last.beatmap);
      playSelect();
      toast.success(`Đã hoàn tác (Ctrl+Z): Đã khôi phục "${last.beatmap.title || 'Untitled'}"!`);
    } catch (err) {
      toast.error('Không thể hoàn tác: ' + err.message);
    }
  };

  const confirmDeleteBeatmap = async () => {
    const bm = deleteConfirm.beatmap;
    if (!bm || !bm.id) return;
    const deleteFromServer = Boolean(deleteConfirm.deleteFromServer);
    setDeleteConfirm({ isOpen: false, beatmap: null, deleteFromServer: false });

    try {
      // 1. Soft delete an toàn trong IndexedDB (giữ nguyên Blobs)
      await dbManager.softDeleteBeatmap(bm.id);

      // 2. Soft delete trên MySQL nếu có tùy chọn
      if (deleteFromServer) {
        try {
          await apiClient.deleteMap(bm.id);
        } catch (e) {
          toast.error('Lỗi xoá trên server: ' + (e.message || 'Không thể kết nối'));
        }
      }

      if (onReloadBeatmaps) await onReloadBeatmaps();
      playBack();

      // 3. Đưa vào ngăn xếp Hoàn tác
      const stackEntry = { beatmap: bm, deleteFromServer, toastId: null };
      deletedStackRef.current.push(stackEntry);

      // 4. Kích hoạt Toast với nút Hoàn tác và gợi ý phím tắt Ctrl+Z (7 giây)
      const toastId = toast.undo(
        `Đã xoá bài hát "${bm.title || 'Untitled'}"`,
        () => handleUndoDelete(),
        7000,
        'HOÀN TÁC (Ctrl+Z)'
      );
      stackEntry.toastId = toastId;
    } catch (err) {
      toast.error('Lỗi khi xoá bài hát: ' + err.message);
    }
  };

  // Quản lý Thùng rác
  const handleOpenTrash = async () => {
    try {
      const trashed = await dbManager.getDeletedBeatmaps();
      setTrashMaps(trashed);
      setIsTrashOpen(true);
    } catch (err) {
      toast.error('Lỗi tải thùng rác: ' + err.message);
    }
  };

  const handleRestoreFromTrash = async (m) => {
    try {
      await dbManager.restoreBeatmap(m.id);
      try {
        await apiClient.restoreMap(m.id);
      } catch (_) {}
      if (onReloadBeatmaps) await onReloadBeatmaps();
      const updated = await dbManager.getDeletedBeatmaps();
      setTrashMaps(updated);
      toast.success(`Đã khôi phục "${m.title}"!`);
    } catch (err) {
      toast.error('Lỗi khôi phục: ' + err.message);
    }
  };

  const handlePermanentDelete = async (m) => {
    try {
      await dbManager.permanentlyDeleteBeatmap(m.id);
      try {
        await apiClient.forceDeleteMap(m.id);
      } catch (_) {}
      const updated = await dbManager.getDeletedBeatmaps();
      setTrashMaps(updated);
      toast.success(`Đã xóa vĩnh viễn "${m.title}"!`);
    } catch (err) {
      toast.error('Lỗi xóa vĩnh viễn: ' + err.message);
    }
  };

  const handleClearAllTrash = async () => {
    try {
      const count = await dbManager.clearTrash();
      setTrashMaps([]);
      setIsTrashOpen(false);
      toast.success(`Đã dọn sạch ${count} bài hát trong thùng rác!`);
    } catch (err) {
      toast.error('Lỗi dọn thùng rác: ' + err.message);
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
    <div className="w-full h-[calc(100vh-50px)] sm:h-[calc(100vh-52px-24px)] mt-[50px] sm:mt-[52px] mb-0 sm:mb-6 flex flex-col select-none overflow-hidden osu-screen-transition">
      {/* Hidden audio element for preview */}
      {current?.audioSource && (
        <audio ref={audioRef} src={current.audioSource} />
      )}

      {/* TOP BAR: Search + Filters + Sort */}
      <div className="min-h-12 py-2 px-3 sm:px-6 bg-[#180d1e]/90 border-b border-[#ff85a2]/15 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-4 shrink-0 z-20">
        {/* Search with syntax hints */}
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#ffaec9] text-xs">🐰</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bài hát, ca sĩ... 🎀"
            className="w-full bg-[#25132b] border border-[#ff85a2]/25 focus:border-[#ff85a2] rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-[#b89cb9] outline-none transition-all focus:shadow-[0_0_12px_rgba(255,133,162,0.3)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#ffaec9] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort & Action controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-[#d8bfd8]">
            <span className="hidden xs:inline">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#25132b] border border-[#ff85a2]/25 text-white text-xs rounded-xl px-2 sm:px-2.5 py-1 outline-none cursor-pointer hover:border-[#ff85a2]/50 transition-colors"
            >
              <option value="title">Tên (A-Z)</option>
              <option value="artist">Ca sĩ (A-Z)</option>
              <option value="stars">Độ khó (★)</option>
              <option value="bpm">BPM</option>
              <option value="length">Độ dài</option>
            </select>
          </div>

          <button
            onClick={handleOpenTrash}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-[#d8bfd8] hover:text-white text-xs font-bold transition-all border border-[#ff85a2]/20 cursor-pointer hover:scale-105"
            title="Thùng rác beatmap (khôi phục bài đã xóa)"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">Thùng rác 🐰</span>
          </button>

          <label className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] hover:from-[#ffaec9] hover:to-[#ff6b93] text-white text-xs font-bold cursor-pointer transition-all shadow-[0_0_14px_rgba(255,133,162,0.4)] hover:scale-105">
            <span>{isImporting ? '⏳' : '🎀'}</span>
            <span className="hidden sm:inline">{isImporting ? 'Đang thêm...' : 'Thêm bài (+)'}</span>
            <span className="sm:hidden">{isImporting ? '...' : '+'}</span>
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

      {/* MOBILE TAB SWITCHER: Chuyển đổi giữa Danh sách và Chi tiết bài trên Mobile */}
      <div className="flex md:hidden items-center justify-center gap-2 py-1.5 px-3 bg-[#1e1124] border-b border-[#ff85a2]/20 shrink-0">
        <button
          onClick={() => { playHover(); setMobileTab('list'); }}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'list'
              ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_0_10px_rgba(255,133,162,0.4)]'
              : 'bg-white/[0.04] text-[#d8bfd8] hover:text-white'
          }`}
        >
          <span>🐰</span>
          <span>Danh sách ({filteredBeatmaps.length})</span>
        </button>
        <button
          onClick={() => { playHover(); setMobileTab('info'); }}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'info'
              ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_0_10px_rgba(255,133,162,0.4)]'
              : 'bg-white/[0.04] text-[#d8bfd8] hover:text-white'
          }`}
        >
          <span>🎀</span>
          <span>Chi tiết & BXH</span>
        </button>
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
        <div className={`w-full md:w-[400px] lg:w-[480px] h-full flex flex-col p-3 sm:p-6 overflow-y-auto custom-scrollbar border-r border-[#ff85a2]/15 bg-[#160c1a]/85 backdrop-blur-md z-10 shrink-0 ${mobileTab === 'info' ? 'flex' : 'hidden md:flex'}`}>
          {/* Song Info Wedge */}
          <div className="p-5 rounded-2xl bg-[#241229]/90 border border-[#ff85a2]/25 shadow-[0_8px_32px_rgba(22,12,26,0.6)] flex flex-col gap-3 relative overflow-hidden">
            {/* Cute mini ribbon tag */}
            <div className="flex items-center justify-between text-[10px] font-bold text-[#ffaec9] uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <span>🎀</span>
                <span>BÀI HÁT ĐANG CHỌN</span>
                <span>🐰</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ff85a2]/20 text-[#ffaec9] border border-[#ff85a2]/30 text-[10px]">
                {noteStats.total} Notes
              </span>
            </div>

            {/* Top row: StarRating + BPM */}
            <div className="flex items-center justify-between">
              <StarRating stars={currentStars} size="md" />
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#ffd6e0]">
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.1]">{currentBpm} BPM</span>
              </div>
            </div>

            {/* Title & Artist */}
            <div>
              <h1 className="text-xl font-black text-white tracking-wide truncate max-w-full font-torus">
                {currentTitle}
              </h1>
              <p className="text-sm font-semibold text-[#ffaec9] truncate max-w-full">
                {currentArtist}
              </p>
            </div>

            {/* Creator info */}
            <div className="text-xs text-[#b89cb9]">
              Mapper: <strong className="text-white">{currentCreator}</strong> 🎀
            </div>

            {/* Note breakdown badges */}
            <div className="pt-2 border-t border-[#ff85a2]/15 flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded-full bg-[#ff85a2]/15 text-[#ffaec9] border border-[#ff85a2]/35 font-bold">
                Tap: {noteStats.tap} 🐰
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ffaec9]/15 text-[#ffd6e0] border border-[#ffaec9]/35 font-bold">
                Hold: {noteStats.hold} 🎀
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ff4d80]/15 text-[#ff85a2] border border-[#ff4d80]/35 font-bold">
                Break: {noteStats.breakN} ✨
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ffd6e0]/20 text-white border border-[#ffd6e0]/40 font-bold">
                Ring: {noteStats.ring} ⭕
              </span>
              {noteStats.slide > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#ffe082]/15 text-[#ffe082] border border-[#ffe082]/35 font-bold">
                  Slide: {noteStats.slide}
                </span>
              )}
              {noteStats.typing > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#b388ff]/15 text-[#b388ff] border border-[#b388ff]/35 font-bold">
                  Typing: {noteStats.typing}
                </span>
              )}
            </div>
          </div>

          {/* LEADERBOARD WIDGET */}
          <div className="flex-1 mt-4 flex flex-col min-h-0 bg-[#241229]/75 rounded-2xl border border-[#ff85a2]/20 p-4 shadow-lg">
            {/* Header + Tabs */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#ff85a2]/15">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🏆</span>
                <span>Bảng xếp hạng 🎀 ({selectedDiff?.difficultyName || 'All'})</span>
              </div>
              <div className="flex gap-1 bg-[#1a0e21] p-0.5 rounded-full border border-[#ff85a2]/20">
                <button
                  onClick={() => { playHover(); setLeaderboardTab('global'); }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    leaderboardTab === 'global' ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_0_10px_rgba(255,133,162,0.4)]' : 'text-[#b89cb9] hover:text-white'
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => { playHover(); setLeaderboardTab('local'); }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    leaderboardTab === 'local' ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_0_10px_rgba(255,133,162,0.4)]' : 'text-[#b89cb9] hover:text-white'
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
          className={`flex-1 h-full overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-3 z-10 ${mobileTab === 'list' ? 'block' : 'hidden md:block'}`}
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
                    ? 'border-[#ff85a2] shadow-[0_6px_28px_rgba(255,133,162,0.45)] scale-[1.01] bg-[#2d1734]/95'
                    : 'border-[#ff85a2]/15 hover:border-[#ff85a2]/45 bg-[#221227]/85 hover:bg-[#2c1733]/90'
                }`}
              >
                {/* Horizontal Card Body */}
                <div className="flex items-center justify-between p-3.5 gap-4 relative">
                  {/* Left: Thumbnail & Song Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#180d1e] shrink-0 border border-[#ff85a2]/30 flex items-center justify-center shadow-md">
                      {cardCover ? (
                        <img src={cardCover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🐰</span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-torus font-black text-sm text-white truncate max-w-sm group-hover:text-[#ffaec9] transition-colors">
                        {title}
                      </span>
                      <span className="text-xs font-semibold text-[#ffaec9] truncate max-w-xs mt-0.5">
                        {artist}
                      </span>
                      <span className="text-[10px] text-[#b89cb9] mt-0.5 flex items-center gap-1">
                        <span>Mapper:</span>
                        <strong className="text-[#ffd6e0]">{bm.creator || meta.creator || 'Mapper'}</strong>
                        <span>🎀</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: StarRating + Diff count */}
                  <div className="flex items-center gap-3 shrink-0">
                    <StarRating stars={stars} size="sm" />
                    <span className="text-xs text-[#ffaec9] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-[#ff85a2]/20">
                      {bm.difficulties?.length || 1} diffs
                    </span>
                  </div>
                </div>

                {/* Expanded Difficulties Bar if selected */}
                {isSelected && diffList.length > 0 && (
                  <div className="px-4 py-2.5 bg-[#180d1e]/90 border-t border-[#ff85a2]/15 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <span className="text-[11px] font-bold text-[#ffaec9] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                      <span>🎀</span>
                      <span>Độ khó:</span>
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
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isDiffActive
                              ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_0_12px_rgba(255,133,162,0.6)] scale-105'
                              : 'bg-white/[0.06] text-[#ffd6e0] hover:bg-white/[0.12] hover:text-white border border-[#ff85a2]/20'
                          }`}
                        >
                          <span>{d.difficultyName}</span>
                          <span className="text-[10px] opacity-85">★{dStars.toFixed(1)}</span>
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
      <div className="h-14 sm:h-16 px-3 sm:px-6 bg-[#1a0e21]/95 border-t border-[#ff85a2]/20 flex items-center justify-between z-30 shrink-0 gap-2">
        {/* Left: Back */}
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} icon="←" className="px-2.5 sm:px-4 text-xs">
          <span className="hidden sm:inline">Back (Esc) 🐰</span>
        </Button>

        {/* Center: Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Button
            variant={isAutoplay ? 'primary' : 'ghost'}
            size="sm"
            onClick={onToggleAutoplay}
            icon="⚡"
            className="px-2 sm:px-3 text-xs"
            title="Chế độ Autoplay"
          >
            <span className="hidden sm:inline">Mods: {isAutoplay ? 'Autoplay ON' : 'None'}</span>
            <span className="sm:hidden">{isAutoplay ? 'Auto' : 'Mods'}</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={handleRandomSelect} icon="🎲" className="px-2 sm:px-3 text-xs" title="Chọn ngẫu nhiên">
            <span className="hidden sm:inline">Random (F2) 🎀</span>
            <span className="sm:hidden">Random</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={onOpenSettings} icon="⚙" className="px-2 sm:px-3 text-xs" title="Cài đặt">
            <span className="hidden sm:inline">Options</span>
          </Button>
        </div>

        {/* Right: PLAY Button */}
        <Button
          variant="primary"
          size="lg"
          onClick={handlePlaySelected}
          className="px-4 sm:px-10 py-2 sm:py-3 text-sm sm:text-base font-black shadow-[0_0_28px_rgba(255,133,162,0.7)] hover:shadow-[0_0_38px_rgba(255,133,162,0.95)] hover:scale-105 active:scale-95 shrink-0"
          icon="🐰"
        >
          <span>CHƠI NGAY 🎀</span>
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
        message={`Bạn có chắc muốn xoá "${deleteConfirm.beatmap?.title || 'bài hát'}"? Bài hát sẽ được chuyển vào Thùng rác tạm và có thể Hoàn tác ngay lập tức (Ctrl+Z hoặc nút Hoàn tác).`}
        confirmText={deleteConfirm.deleteFromServer ? 'Xoá cả Server & Máy' : 'Xoá khỏi máy'}
        confirmVariant="danger"
      />

      {/* TRASH BIN MODAL (Thùng rác Beatmap) */}
      <Modal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        title="Thùng rác Beatmap (Đã xóa tạm thời)"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8890a4]">
              Các bài hát bị xóa được lưu trữ an toàn tại đây để khôi phục bất cứ lúc nào.
            </p>
            {trashMaps.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearAllTrash}
                icon="🗑"
              >
                Dọn sạch thùng rác
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.06] custom-scrollbar border border-white/[0.08] rounded-xl bg-[#141424]">
            {trashMaps.length > 0 ? (
              trashMaps.map((m) => (
                <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#ff66ab] shrink-0 overflow-hidden">
                      {m.backgroundSource || m.serverAssets?.coverUrl ? (
                        <img
                          src={m.backgroundSource || m.serverAssets?.coverUrl}
                          alt="Cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>♪</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white text-xs truncate max-w-xs">{m.title}</span>
                      <span className="text-[10px] text-[#7c849c] truncate max-w-xs">{m.artist}</span>
                      {m.deletedAt && (
                        <span className="text-[9px] font-mono text-[#ff80bf]">
                          Đã xóa: {new Date(m.deletedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleRestoreFromTrash(m)}
                      icon="⤺"
                    >
                      Khôi phục
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handlePermanentDelete(m)}
                      icon="✕"
                    >
                      Xóa vĩnh viễn
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#7c849c] text-xs">
                Thùng rác trống. Không có bài hát nào bị xóa.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
