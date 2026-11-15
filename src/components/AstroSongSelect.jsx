import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbManager } from '../core/storage/db.js';
import { importFiles, buildSongEntryFromServerMap, songEntryToMapPayload } from '../core/parser/index.js';
import { exportBeatmapFile } from '../core/parser/exportService.js';
import { apiClient } from '../core/api/client.js';
import { resolveDifficultyBeatmap } from '../core/beatmap/difficulty.js';
import { normalizeMaimaiCategory, calculateMaimaiRating } from '../core/beatmap/maimaiDifficulty.js';
import {
  Button,
  IconButton,
  Dropdown,
  StarRating,
  DifficultyBadge,
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
  const [leaderboardTab, setLeaderboardTab] = useState(currentUser ? 'global' : 'local'); // 'global' | 'local' | 'online'
  const [leaderboardScores, setLeaderboardScores] = useState([]);
  const [localScores, setLocalScores] = useState([]);
  const [isLoadingScores, setIsLoadingScores] = useState(false);
  const [onlineUserScores, setOnlineUserScores] = useState([]);
  const [isLoadingOnlineUserScores, setIsLoadingOnlineUserScores] = useState(false);
  const [mobileTab, setMobileTab] = useState('list'); // 'list' | 'info' on mobile screen

  // History stack for Shift+F2 (Previous Random)
  const [historyStack, setHistoryStack] = useState([]);

  // Context menu & Confirm dialog state
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, beatmap: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, beatmap: null, deleteFromServer: false });
  const [collections, setCollections] = useState([]);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [isAddToCollectionOpen, setIsAddToCollectionOpen] = useState(false);
  const [collectionTargetBeatmap, setCollectionTargetBeatmap] = useState(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [collectionDeleteConfirm, setCollectionDeleteConfirm] = useState(null);
  const [isDownloadMapsOpen, setIsDownloadMapsOpen] = useState(false);
  const [serverMaps, setServerMaps] = useState([]);
  const [serverMapSearch, setServerMapSearch] = useState('');
  const [isLoadingServerMaps, setIsLoadingServerMaps] = useState(false);
  const [downloadingMapId, setDownloadingMapId] = useState(null);
  const [uploadingMapId, setUploadingMapId] = useState(null);

  // Chế độ chọn hàng loạt & Bulk Delete
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMapIds, setSelectedMapIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({ isOpen: false, count: 0, deleteFromServer: false });

  // Ngăn xếp hoàn tác xóa bài hát (Undo Ctrl+Z)
  const deletedStackRef = useRef([]);

  // Quản lý Thùng rác (Trash Bin)
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [trashMaps, setTrashMaps] = useState([]);

  const audioRef = useRef(null);
  const carouselRef = useRef(null);
  const activeCollection = collections.find((collection) => collection.id === activeCollectionId) || null;

  // Parse advanced search query: free text + 'stars>5', 'bpm<200', 'artist=xyz', 'creator=xyz'
  const filteredBeatmaps = useMemo(() => {
    let list = [...beatmaps];
    if (activeCollectionId) {
      const activeIds = collections.find((collection) => collection.id === activeCollectionId)?.beatmapIds || [];
      list = list.filter((beatmap) => activeIds.includes(beatmap.id));
    }

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
  }, [beatmaps, searchQuery, sortBy, collections, activeCollectionId]);

  const current = activeCollectionId
    ? filteredBeatmaps.find((beatmap) => beatmap.id === selectedBeatmap?.id) || filteredBeatmaps[0] || null
    : selectedBeatmap || filteredBeatmaps[0] || null;
  const filteredServerMaps = useMemo(() => {
    const query = serverMapSearch.trim().toLowerCase();
    if (!query) return serverMaps;
    return serverMaps.filter((map) =>
      `${map.title || ''} ${map.artist || ''} ${map.creator || ''}`.toLowerCase().includes(query)
    );
  }, [serverMaps, serverMapSearch]);

  // Extract difficulty list from current beatmap set (excluding Utage per Maimai rules)
  const diffList = useMemo(() => {
    if (!current) return [];
    if (current.difficulties && current.difficulties.length > 0) {
      const list = current.difficulties
        .filter((d) => {
          const name = (d.difficultyName || '').toLowerCase();
          return !name.includes('utage') && !name.includes('宴');
        })
        .map((d) => {
          const category = normalizeMaimaiCategory(d.difficultyName);
          const maimaiRating = calculateMaimaiRating(d.beatmap || current.beatmap);
          const maimaiLevel = d.difficultyLevel || maimaiRating.levelString;
          return {
            ...d,
            category,
            maimaiLevel: String(maimaiLevel),
            stars: parseFloat(d.stars || current.stars || 5.0)
          };
        });

      // Sắp xếp đúng chuẩn thứ tự Maimai: Basic -> Advanced -> Expert -> Master -> Re:Master
      const MAIMAI_ORDER = { 'basic': 1, 'advanced': 2, 'expert': 3, 'master': 4, 're:master': 5 };
      list.sort((a, b) => {
        const orderA = MAIMAI_ORDER[(a.category || '').toLowerCase()] || 99;
        const orderB = MAIMAI_ORDER[(b.category || '').toLowerCase()] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return (parseFloat(a.maimaiLevel) || a.stars || 0) - (parseFloat(b.maimaiLevel) || b.stars || 0);
      });

      return list;
    }
    const meta = current.metadata || current.beatmap?.metadata || {};
    const name = current.difficultyName || meta.difficultyName || 'Normal';
    const category = normalizeMaimaiCategory(name);
    const maimaiRating = calculateMaimaiRating(current.beatmap);
    const maimaiLevel = current.difficultyLevel || meta.difficultyLevel || maimaiRating.levelString;
    return [
      {
        difficultyName: name,
        category,
        difficultyLevel: String(maimaiLevel),
        maimaiLevel: String(maimaiLevel),
        stars: parseFloat(current.stars || meta.stars || 5.0),
        beatmap: current.beatmap,
        noteCount: current.beatmap?.notes?.length || 0
      }
    ];
  }, [current]);

  // Keep selected difficulty in sync when switching beatmaps or returning from gameplay
  useEffect(() => {
    if (!current || !diffList.length) return;
    if (current.difficultyName) {
      const idx = diffList.findIndex(
        (d) => d.difficultyName.trim().toLowerCase() === current.difficultyName.trim().toLowerCase()
      );
      if (idx >= 0) {
        setSelectedDiffIndex(idx);
        return;
      }
    }
    // Mặc định ưu tiên chọn Master nếu có, hoặc độ khó cao nhất trong danh sách
    const masterIdx = diffList.findIndex((d) => d.category === 'Master');
    if (masterIdx >= 0) {
      setSelectedDiffIndex(masterIdx);
      return;
    }
    setSelectedDiffIndex(Math.max(0, diffList.length - 1));
  }, [current?.id, current?.difficultyName, diffList]);

  const selectedDiff = diffList[selectedDiffIndex] || diffList[0] || null;
  const selectedChart = resolveDifficultyBeatmap(current, selectedDiff);
  const currentNotes = selectedChart?.notes || [];

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
        else if (!isCancelled) setLeaderboardScores([]);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Leaderboard API error:', err.message);
          setLeaderboardScores([]);
        }
      });

    // 2. Fetch Local scores
    const fetchLocal = dbManager.getScoresByBeatmap || dbManager.getScoresForBeatmap;
    if (fetchLocal) {
      fetchLocal.call(dbManager, current.id)
        .then((scores) => {
          if (!isCancelled) {
            const targetDiff = (selectedDiff?.difficultyName || '').trim().toLowerCase();
            const matching = (scores || []).filter((s) => {
              if (!targetDiff) return true;
              const sDiff = (s.difficultyName || '').trim().toLowerCase();
              return sDiff === targetDiff;
            });
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

  useEffect(() => {
    if (!current?.id || !currentUser?.id) {
      setOnlineUserScores([]);
      setIsLoadingOnlineUserScores(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingOnlineUserScores(true);
    apiClient.getUserScores(currentUser.id, {
      song_id: current.id,
      difficulty_name: selectedDiff?.difficultyName || ''
    })
      .then((response) => {
        if (!isCancelled) setOnlineUserScores(response?.scores || []);
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Online personal scores error:', error.message);
          setOnlineUserScores([]);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingOnlineUserScores(false);
      });

    return () => { isCancelled = true; };
  }, [current?.id, currentUser?.id, selectedDiff?.difficultyName]);

  const displayedLeaderboardScores = leaderboardTab === 'global'
    ? leaderboardScores
    : leaderboardTab === 'online'
      ? onlineUserScores
      : localScores;
  const isLoadingDisplayedScores = leaderboardTab === 'online'
    ? isLoadingOnlineUserScores
    : isLoadingScores;

  useEffect(() => {
    if (!currentUser && leaderboardTab === 'online') setLeaderboardTab('local');
  }, [currentUser, leaderboardTab]);

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
    if (!selectedChart) {
      toast.error('No valid chart found for the selected difficulty.');
      return;
    }
    playClick();
    if (audioRef.current) audioRef.current.pause();

    const chartToPlay = {
      ...current,
      beatmap: selectedChart,
      difficultyName: selectedDiff?.difficultyName || 'Normal',
      difficultyLevel: selectedDiff?.maimaiLevel || selectedDiff?.difficultyLevel || '10',
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
      if (result.status === 'bulk') {
        toast.success(`Successfully imported ${result.count} beatmaps! 🎀`);
      } else if (result.songEntry) {
        toast.success(`Loaded "${result.songEntry.title || 'Beatmap'}"! 🎀`);
      }
      if (onSelectBeatmap && result.songEntry) onSelectBeatmap(result.songEntry);
    } catch (err) {
      toast.error('Error loading files: ' + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const refreshCollections = async () => {
    const savedCollections = await dbManager.getAllCollections();
    setCollections(savedCollections);
    return savedCollections;
  };

  const handleOpenCollections = async () => {
    try {
      await refreshCollections();
      setIsCollectionsOpen(true);
    } catch (error) {
      toast.error(`Could not load collections: ${error.message}`);
    }
  };

  const handleOpenAddToCollection = async (bm) => {
    try {
      await refreshCollections();
      setCollectionTargetBeatmap(bm);
      setNewCollectionName('');
      setIsAddToCollectionOpen(true);
    } catch (error) {
      toast.error(`Could not load collections: ${error.message}`);
    }
  };

  const handleAddToCollection = async (collectionId) => {
    if (!collectionTargetBeatmap) return;
    setIsSavingCollection(true);
    try {
      const result = await dbManager.addBeatmapToCollection(collectionId, collectionTargetBeatmap.id);
      if (!result) {
        toast.error('That collection no longer exists.');
        await refreshCollections();
        return;
      }
      await refreshCollections();
      setIsAddToCollectionOpen(false);
      toast[result.added ? 'success' : 'info'](
        result.added
          ? `Added "${collectionTargetBeatmap.title || 'Beatmap'}" to "${result.collection.name}".`
          : `That beatmap is already in "${result.collection.name}".`
      );
    } catch (error) {
      toast.error(`Could not add beatmap to collection: ${error.message}`);
    } finally {
      setIsSavingCollection(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!collectionTargetBeatmap) return;
    const name = newCollectionName.trim();
    if (!name) {
      toast.info('Enter a name for the new collection.');
      return;
    }
    if (collections.some((collection) => collection.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.info('A collection with that name already exists. Choose it from the list instead.');
      return;
    }

    setIsSavingCollection(true);
    try {
      const collection = await dbManager.createCollection(name, collectionTargetBeatmap.id);
      await refreshCollections();
      setIsAddToCollectionOpen(false);
      toast.success(`Created "${collection.name}" and added the beatmap.`);
    } catch (error) {
      toast.error(`Could not create collection: ${error.message}`);
    } finally {
      setIsSavingCollection(false);
    }
  };

  const handleRemoveFromCollection = async (bm) => {
    if (!activeCollection || !bm) return;
    try {
      const removed = await dbManager.removeBeatmapFromCollection(activeCollection.id, bm.id);
      await refreshCollections();
      if (removed) toast.success(`Removed "${bm.title || 'Beatmap'}" from "${activeCollection.name}".`);
    } catch (error) {
      toast.error(`Could not remove beatmap from collection: ${error.message}`);
    }
  };

  const handleDeleteCollection = async () => {
    if (!collectionDeleteConfirm) return;
    try {
      await dbManager.deleteCollection(collectionDeleteConfirm.id);
      if (activeCollectionId === collectionDeleteConfirm.id) setActiveCollectionId(null);
      await refreshCollections();
      toast.success(`Deleted collection "${collectionDeleteConfirm.name}".`);
    } catch (error) {
      toast.error(`Could not delete collection: ${error.message}`);
    } finally {
      setCollectionDeleteConfirm(null);
    }
  };

  const handleOpenServerMapLibrary = async () => {
    setIsDownloadMapsOpen(true);
    setIsLoadingServerMaps(true);
    try {
      const response = await apiClient.getMaps();
      setServerMaps(Array.isArray(response?.maps) ? response.maps : []);
    } catch (error) {
      toast.error(`Could not load online maps: ${error.message}`);
    } finally {
      setIsLoadingServerMaps(false);
    }
  };

  const handleDownloadServerMap = async (serverMap) => {
    if (!serverMap?.song_id || downloadingMapId) return;
    setDownloadingMapId(serverMap.song_id);
    try {
      const response = await apiClient.getMap(serverMap.song_id);
      const map = response?.map;
      if (!map) throw new Error('The server did not return this map.');

      const existing = await dbManager.getBeatmap(map.song_id);
      const mapEntry = buildSongEntryFromServerMap(map, {}, existing);
      const [audio, background, video] = await Promise.all([
        map.audio_url ? apiClient.fetchAssetBlob(map.audio_url) : null,
        map.cover_url ? apiClient.fetchAssetBlob(map.cover_url) : null,
        map.video_url ? apiClient.fetchAssetBlob(map.video_url) : null
      ]);
      const entry = buildSongEntryFromServerMap(map, { audio, background, video }, mapEntry);
      await dbManager.saveBeatmap(entry);
      if (onReloadBeatmaps) await onReloadBeatmaps();
      toast.success(`Downloaded "${entry.title}" to this device.`);
    } catch (error) {
      toast.error(`Could not download "${serverMap.title || 'map'}": ${error.message}`);
    } finally {
      setDownloadingMapId(null);
    }
  };

  const handleUploadServerMap = async (beatmap) => {
    if (uploadingMapId) return;
    if (!beatmap?.id) {
      toast.error('This beatmap is missing its ID and cannot be uploaded.');
      return;
    }
    if (!currentUser) {
      toast.error('Sign in before uploading a map to the online library.');
      onOpenAuth?.();
      return;
    }

    setUploadingMapId(beatmap.id);
    try {
      const response = await apiClient.saveMap(songEntryToMapPayload(beatmap));
      if (!response?.success) {
        throw new Error(response?.message || 'The server did not confirm the map upload.');
      }

      const assets = {
        audio: beatmap.audioBlob,
        background: beatmap.backgroundBlob,
        video: beatmap.videoBlob
      };
      if (assets.audio || assets.background || assets.video) {
        try {
          await apiClient.uploadMapAssets(beatmap.id, assets);
        } catch (error) {
          toast.error(`Map chart uploaded, but its media files could not be uploaded: ${error.message}`);
          return;
        }
      }

      toast.success(`Uploaded "${beatmap.title || 'Map'}" to the online library. It can now be downloaded on other devices.`);
    } catch (error) {
      toast.error(`Could not upload "${beatmap.title || 'map'}": ${error.message}`);
    } finally {
      setUploadingMapId(null);
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

  const handleCardActionsClick = (e, bm) => {
    e.stopPropagation();
    playClick();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      isOpen: true,
      x: rect.left,
      y: rect.bottom,
      beatmap: bm
    });
  };

  const handleExportBeatmap = async (bm) => {
    try {
      const { blob, filename } = await exportBeatmapFile(bm);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${filename}`);
    } catch (error) {
      toast.error(`Could not export beatmap: ${error.message}`);
    }
  };

  // Bulk Selection Helpers
  const toggleSelectMap = (id) => {
    setSelectedMapIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllMaps = () => {
    const allIds = new Set(filteredBeatmaps.map((b) => b.id));
    setSelectedMapIds(allIds);
  };

  const deselectAllMaps = () => {
    setSelectedMapIds(new Set());
  };

  const handleOpenBulkDelete = (deleteFromServer = false) => {
    if (selectedMapIds.size === 0) {
      toast.info('Please select at least one beatmap to delete.');
      return;
    }
    setBulkDeleteConfirm({
      isOpen: true,
      count: selectedMapIds.size,
      deleteFromServer
    });
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedMapIds);
    if (ids.length === 0) return;
    const deleteFromServer = Boolean(bulkDeleteConfirm.deleteFromServer);
    setBulkDeleteConfirm({ isOpen: false, count: 0, deleteFromServer: false });

    try {
      const beatmapsToDelete = beatmaps.filter((b) => selectedMapIds.has(b.id));

      if (typeof dbManager.softDeleteBeatmaps === 'function') {
        await dbManager.softDeleteBeatmaps(ids);
      } else {
        await Promise.all(ids.map((id) => dbManager.softDeleteBeatmap(id)));
      }

      if (deleteFromServer) {
        for (const id of ids) {
          try {
            await apiClient.deleteMap(id);
          } catch (_) {}
        }
      }

      if (onReloadBeatmaps) await onReloadBeatmaps();
      setSelectedMapIds(new Set());
      setIsSelectMode(false);
      playBack();

      const stackEntry = {
        isBulk: true,
        ids,
        bulkBeatmaps: beatmapsToDelete,
        deleteFromServer,
        toastId: null
      };
      deletedStackRef.current.push(stackEntry);

      const toastId = toast.undo(
        `Deleted ${ids.length} beatmaps`,
        () => handleUndoDelete(),
        7000,
        'UNDO (Ctrl+Z)'
      );
      stackEntry.toastId = toastId;
    } catch (err) {
      toast.error('Error during bulk delete: ' + err.message);
    }
  };

  // Undo delete beatmap (Undo / Ctrl+Z)
  const handleUndoDelete = async () => {
    if (deletedStackRef.current.length === 0) {
      toast.info('No recent beatmaps to undo.');
      return;
    }

    const last = deletedStackRef.current.pop();
    if (!last) return;

    if (last.toastId) {
      toast.dismiss(last.toastId);
    }

    try {
      if (last.isBulk && last.ids) {
        if (typeof dbManager.restoreBeatmaps === 'function') {
          await dbManager.restoreBeatmaps(last.ids);
        } else {
          await Promise.all(last.ids.map((id) => dbManager.restoreBeatmap(id)));
        }
        if (last.deleteFromServer) {
          for (const id of last.ids) {
            try {
              await apiClient.restoreMap(id);
            } catch (_) {}
          }
        }
        if (onReloadBeatmaps) await onReloadBeatmaps();
        playSelect();
        toast.success(`Restored ${last.ids.length} beatmaps (Ctrl+Z)!`);
      } else if (last.beatmap) {
        await dbManager.restoreBeatmap(last.beatmap.id);
        if (last.deleteFromServer) {
          try {
            await apiClient.restoreMap(last.beatmap.id);
          } catch (_) {}
        }
        if (onReloadBeatmaps) await onReloadBeatmaps();
        onSelectBeatmap(last.beatmap);
        playSelect();
        toast.success(`Restored "${last.beatmap.title || 'Untitled'}" (Ctrl+Z)!`);
      }
    } catch (err) {
      toast.error('Could not undo: ' + err.message);
    }
  };

  const confirmDeleteBeatmap = async () => {
    const bm = deleteConfirm.beatmap;
    if (!bm || !bm.id) return;
    const deleteFromServer = Boolean(deleteConfirm.deleteFromServer);
    setDeleteConfirm({ isOpen: false, beatmap: null, deleteFromServer: false });

    try {
      // 1. Soft delete in IndexedDB (keeps Blobs intact)
      await dbManager.softDeleteBeatmap(bm.id);

      // 2. Soft delete on MySQL if option enabled
      if (deleteFromServer) {
        try {
          await apiClient.deleteMap(bm.id);
        } catch (e) {
          toast.error('Error deleting from server: ' + (e.message || 'Connection failed'));
        }
      }

      if (onReloadBeatmaps) await onReloadBeatmaps();
      playBack();

      // 3. Push to undo stack
      const stackEntry = { beatmap: bm, deleteFromServer, toastId: null };
      deletedStackRef.current.push(stackEntry);

      // 4. Trigger Toast with Undo button (7s)
      const toastId = toast.undo(
        `Deleted beatmap "${bm.title || 'Untitled'}"`,
        () => handleUndoDelete(),
        7000,
        'UNDO (Ctrl+Z)'
      );
      stackEntry.toastId = toastId;
    } catch (err) {
      toast.error('Error deleting beatmap: ' + err.message);
    }
  };

  // Trash management
  const handleOpenTrash = async () => {
    try {
      const trashed = await dbManager.getDeletedBeatmaps();
      setTrashMaps(trashed);
      setIsTrashOpen(true);
    } catch (err) {
      toast.error('Error loading trash: ' + err.message);
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
      toast.success(`Restored "${m.title}"!`);
    } catch (err) {
      toast.error('Error restoring beatmap: ' + err.message);
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
      toast.success(`Permanently deleted "${m.title}"!`);
    } catch (err) {
      toast.error('Error permanently deleting: ' + err.message);
    }
  };

  const handleClearAllTrash = async () => {
    try {
      const count = await dbManager.clearTrash();
      setTrashMaps([]);
      setIsTrashOpen(false);
      toast.success(`Emptied ${count} beatmaps from trash!`);
    } catch (err) {
      toast.error('Error emptying trash: ' + err.message);
    }
  };

  const handleRestoreAllTrash = async () => {
    if (trashMaps.length === 0) return;
    try {
      const ids = trashMaps.map((m) => m.id);
      if (typeof dbManager.restoreBeatmaps === 'function') {
        await dbManager.restoreBeatmaps(ids);
      } else {
        await Promise.all(ids.map((id) => dbManager.restoreBeatmap(id)));
      }
      for (const id of ids) {
        try { await apiClient.restoreMap(id); } catch (_) {}
      }
      if (onReloadBeatmaps) await onReloadBeatmaps();
      setTrashMaps([]);
      setIsTrashOpen(false);
      toast.success(`Restored all ${ids.length} beatmaps from trash!`);
    } catch (err) {
      toast.error('Error restoring trash: ' + err.message);
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
      <div className="min-h-12 py-2 px-3 sm:px-6 bg-[#fffafc]/85 backdrop-blur-md border-b border-[#f3dbe4] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-4 shrink-0 z-20 shadow-sm">
        {activeCollection && (
          <button
            type="button"
            onClick={() => setActiveCollectionId(null)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#fff0f5] text-[#5b2a47] hover:text-[#ff4d80] border border-[#f3dbe4] text-xs font-bold cursor-pointer shrink-0"
            title="Return to all beatmaps"
          >
            ← <span className="max-w-32 truncate">{activeCollection.name}</span>
          </button>
        )}
        {/* Search with syntax hints */}
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#ff4d80] text-xs">🐰</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search song, artist... 🎀"
            className="w-full bg-white border border-[#f3dbe4] focus:border-[#ff4d80] rounded-full pl-9 pr-4 py-1.5 text-xs text-[#5b2a47] placeholder-[#a8556f] outline-none transition-all focus:shadow-[0_2px_12px_rgba(255,77,128,0.2)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#a8556f] hover:text-[#ff4d80]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort & Action controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-[#5b2a47] font-bold">
            <span className="hidden xs:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-[#f3dbe4] text-[#5b2a47] text-xs font-bold rounded-full px-3 py-1 outline-none cursor-pointer hover:border-[#ff85a2] transition-colors shadow-sm"
            >
              <option value="title">Title (A-Z)</option>
              <option value="artist">Artist (A-Z)</option>
              <option value="stars">Difficulty</option>
              <option value="bpm">BPM</option>
              <option value="length">Length</option>
            </select>
          </div>

          <button
            onClick={() => {
              playClick();
              setIsSelectMode((prev) => {
                if (prev) setSelectedMapIds(new Set());
                return !prev;
              });
            }}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer hover:scale-105 shadow-sm ${
              isSelectMode
                ? 'bg-[#ff4d80] text-white border-[#ff4d80] shadow-[0_2px_12px_rgba(255,77,128,0.3)]'
                : 'bg-white hover:bg-[#fff0f4] text-[#5b2a47] hover:text-[#ff4d80] border-[#f3dbe4] hover:border-[#ff85a2]'
            }`}
            title="Toggle select mode for bulk operations"
          >
            <span>📋</span>
            <span className="hidden sm:inline">{isSelectMode ? 'Cancel' : 'Select'}</span>
          </button>

          <button
            onClick={handleOpenTrash}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-[#fff0f4] text-[#5b2a47] hover:text-[#ff4d80] text-xs font-bold transition-all border border-[#f3dbe4] hover:border-[#ff85a2] cursor-pointer hover:scale-105 shadow-sm"
            title="Beatmap trash (restore deleted maps)"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">Trash 🐰</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCollections}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-[#fff0f4] text-[#5b2a47] hover:text-[#ff4d80] text-xs font-bold transition-all border border-[#f3dbe4] hover:border-[#ff85a2] cursor-pointer hover:scale-105 shadow-sm"
            title="View your beatmap collections"
          >
            <span>📚</span>
            <span>Collections ({collections.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenServerMapLibrary}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-[#fff0f4] text-[#5b2a47] hover:text-[#ff4d80] text-xs font-bold transition-all border border-[#f3dbe4] hover:border-[#ff85a2] cursor-pointer hover:scale-105 shadow-sm"
            title="Download maps published to the project"
          >
            <span>⬇️</span>
            <span>Download Maps</span>
          </button>

          <label className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] hover:from-[#ffaec9] hover:to-[#ff6b93] text-white text-xs font-bold cursor-pointer transition-all shadow-[0_2px_12px_rgba(255,77,128,0.25)] hover:scale-105">
            <span>{isImporting ? '⏳' : '🎀'}</span>
            <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Add Song (+)'}</span>
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

      {/* BULK ACTION TOOLBAR (VISIBLE WHEN IN SELECT MODE) */}
      {isSelectMode && (
        <div className="py-2 px-3 sm:px-6 bg-[#fff0f5] border-b border-[#f9c2ce] flex flex-wrap items-center justify-between gap-2 z-20 shadow-inner">
          <div className="flex items-center gap-2 text-xs font-bold text-[#5b2a47]">
            <span>🐰 Selected:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ff4d80] text-white text-[11px] font-black">
              {selectedMapIds.size} / {filteredBeatmaps.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={selectAllMaps}
              className="px-2.5 py-1 rounded-full bg-white text-[#5b2a47] border border-[#f3dbe4] hover:border-[#ff85a2] text-xs font-bold cursor-pointer transition-all hover:scale-105 shadow-sm"
            >
              Select All
            </button>
            <button
              onClick={deselectAllMaps}
              className="px-2.5 py-1 rounded-full bg-white text-[#5b2a47] border border-[#f3dbe4] hover:border-[#ff85a2] text-xs font-bold cursor-pointer transition-all hover:scale-105 shadow-sm"
            >
              Deselect
            </button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleOpenBulkDelete(false)}
              disabled={selectedMapIds.size === 0}
              icon="🗑"
              className="text-xs"
            >
              Delete Selected ({selectedMapIds.size})
            </Button>
            {currentUser && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleOpenBulkDelete(true)}
                disabled={selectedMapIds.size === 0}
                icon="⚠"
                className="text-xs"
              >
                Delete Server ({selectedMapIds.size})
              </Button>
            )}
            <button
              onClick={() => {
                setIsSelectMode(false);
                setSelectedMapIds(new Set());
              }}
              className="px-2.5 py-1 rounded-full bg-white text-[#a8556f] border border-[#f3dbe4] hover:text-[#5b2a47] text-xs font-bold cursor-pointer"
            >
              ✕ Done
            </button>
          </div>
        </div>
      )}

      {/* MOBILE TAB SWITCHER */}
      <div className="flex md:hidden items-center justify-center gap-2 py-1.5 px-3 bg-[#fff1f5] border-b border-[#f3dbe4] shrink-0">
        <button
          onClick={() => { playHover(); setMobileTab('list'); }}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'list'
              ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_2px_10px_rgba(255,77,128,0.25)]'
              : 'bg-white text-[#5b2a47] border border-[#f3dbe4]'
          }`}
        >
          <span>🐰</span>
          <span>Song List ({filteredBeatmaps.length})</span>
        </button>
        <button
          onClick={() => { playHover(); setMobileTab('info'); }}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'info'
              ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_2px_10px_rgba(255,77,128,0.25)]'
              : 'bg-white text-[#5b2a47] border border-[#f3dbe4]'
          }`}
        >
          <span>🎀</span>
          <span>Details & Leaderboard</span>
        </button>
      </div>

      {/* MAIN BODY: LEFT WEDGE + RIGHT CAROUSEL */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Decorative background ribbons */}
        <div className="bg-ribbons">
          <span />
          <span />
          <span />
        </div>

        {/* Blurred background cover image */}
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none will-change-transform"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}

        {/* LEFT PANE: Song Wedge Info + Leaderboard */}
        <div className={`w-full md:w-[400px] lg:w-[480px] h-full flex flex-col p-3 sm:p-6 overflow-y-auto custom-scrollbar border-r border-[#f3dbe4] bg-white/70 backdrop-blur-md z-10 shrink-0 ${mobileTab === 'info' ? 'flex' : 'hidden md:flex'}`}>
          {/* Song Info Wedge */}
          <div className="p-5 rounded-3xl bg-white/95 border border-[#f3dbe4] shadow-[0_12px_40px_rgba(126,47,79,0.08)] flex flex-col gap-3 relative overflow-hidden">
            {/* Cute mini ribbon tag */}
            <div className="flex items-center justify-between text-[10px] font-black text-[#ff4d80] uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <span>🎀</span>
                <span>SELECTED TRACK</span>
                <span>🐰</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#fff0f4] text-[#ff4d80] border border-[#f3dbe4] text-[10px] font-bold">
                {noteStats.total} Notes
              </span>
            </div>

            {/* Top row: DifficultyBadge (Maimai Level + optional osu! Stars side by side) + BPM */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <DifficultyBadge
                category={selectedDiff?.category || 'Expert'}
                level={selectedDiff?.maimaiLevel || '10'}
                osuStars={selectedDiff?.stars || currentStars}
                showOsuStars={Boolean(current?.source === 'osu' || current?.keys || current?.rawOsu || current?.metadata?.source === 'osu')}
                size="md"
              />
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#5b2a47]">
                <span className="px-2.5 py-0.5 rounded-full bg-[#fff1f5] border border-[#f3dbe4]">{currentBpm} BPM</span>
              </div>
            </div>

            {/* Title & Artist */}
            <div>
              <h1 className="text-xl font-black text-[#5b2a47] tracking-wide truncate max-w-full font-torus">
                {currentTitle}
              </h1>
              <p className="text-sm font-bold text-[#ff4d80] truncate max-w-full">
                {currentArtist}
              </p>
            </div>

            {/* Creator info */}
            <div className="text-xs text-[#a8556f]">
              Mapper: <strong className="text-[#5b2a47]">{currentCreator}</strong> 🎀
            </div>

            {/* Note breakdown badges */}
            <div className="pt-2 border-t border-[#f3dbe4] flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded-full bg-[#fff0f4] text-[#e94267] border border-[#f3dbe4] font-bold">
                Tap: {noteStats.tap} 🐰
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#fff5eb] text-[#e78b21] border border-[#fde1bd] font-bold">
                Hold: {noteStats.hold} 🎀
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#fff0f0] text-[#e8284f] border border-[#f9c2ce] font-bold">
                Break: {noteStats.breakN} ✨
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#f0f8ff] text-[#2980b9] border border-[#d2e8fc] font-bold">
                Ring: {noteStats.ring} ⭕
              </span>
              {noteStats.slide > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#f6ffed] text-[#389e0d] border border-[#b7eb8f] font-bold">
                  Slide: {noteStats.slide}
                </span>
              )}
              {noteStats.typing > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#f9f0ff] text-[#722ed1] border border-[#d3adf7] font-bold">
                  Typing: {noteStats.typing}
                </span>
              )}
            </div>
          </div>

          {/* LEADERBOARD WIDGET */}
          <div className="flex-1 mt-4 flex flex-col min-h-0 bg-white/95 rounded-3xl border border-[#f3dbe4] p-4 shadow-[0_12px_40px_rgba(126,47,79,0.08)]">
            {/* Header + Tabs */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#f3dbe4]">
              <div className="text-xs font-black text-[#5b2a47] uppercase tracking-wider flex items-center gap-1.5">
                <span>🏆</span>
                <span>Leaderboard 🎀 ({selectedDiff?.difficultyName || 'All'})</span>
              </div>
              <div className="flex gap-1 bg-[#fff1f5] p-0.5 rounded-full border border-[#f3dbe4]">
                <button
                  onClick={() => { playHover(); setLeaderboardTab('global'); }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    leaderboardTab === 'global' ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_2px_8px_rgba(255,77,128,0.25)]' : 'text-[#5b2a47] hover:text-[#ff4d80]'
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => { playHover(); setLeaderboardTab('local'); }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    leaderboardTab === 'local' ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_2px_8px_rgba(255,77,128,0.25)]' : 'text-[#5b2a47] hover:text-[#ff4d80]'
                  }`}
                >
                  Local
                </button>
                {currentUser && (
                  <button
                    onClick={() => { playHover(); setLeaderboardTab('online'); }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                      leaderboardTab === 'online' ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_2px_8px_rgba(255,77,128,0.25)]' : 'text-[#5b2a47] hover:text-[#ff4d80]'
                    }`}
                  >
                    My Online
                  </button>
                )}
              </div>
            </div>

            {/* Scores List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {isLoadingDisplayedScores ? (
                <div className="text-center py-8 text-xs text-[#a8556f]">Loading leaderboard...</div>
              ) : displayedLeaderboardScores.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#a8556f]">
                  {leaderboardTab === 'online'
                    ? 'No online scores found for this map and difficulty on your account.'
                    : 'No scores recorded for this difficulty yet. Be the first!'}
                </div>
              ) : (
                displayedLeaderboardScores.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className="p-2.5 rounded-2xl bg-[#fff8fa] hover:bg-[#fff0f4] border border-[#f3dbe4] flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-[#ff4d80] w-4 text-center">
                        #{idx + 1}
                      </span>
                      <RankBadge rank={s.rank || 'S'} size="sm" />
                      <div className="flex flex-col">
                        <span className="font-black text-[#5b2a47] truncate max-w-[120px]">
                          {s.user?.name || s.username || 'Player'}
                        </span>
                        <span className="text-[10px] text-[#a8556f] font-mono">
                          {Number(s.accuracy || s.achievement || 0).toFixed(2)}% • {s.max_combo || s.maxCombo || 0}x
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="font-black text-[#5b2a47]">
                        {Number(s.score || 0).toLocaleString()}
                      </div>
                      {s.pp !== undefined && (
                        <div className="text-[10px] text-[#ff4d80] font-black">
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
          className={`flex-1 h-full overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-3 z-10 [contain:content] ${mobileTab === 'list' ? 'block' : 'hidden md:block'}`}
        >
          {filteredBeatmaps.map((bm, index) => {
            const isSelected = current?.id === bm.id;
            const isChecked = selectedMapIds.has(bm.id);
            const meta = bm.metadata || bm.beatmap?.metadata || {};
            const title = bm.title || meta.title || 'Untitled';
            const artist = bm.artist || meta.artist || 'Unknown';
            const stars = parseFloat(bm.stars || meta.stars || bm.difficultyLevel || 5);
            const cardCover = bm.backgroundSource || bm.serverAssets?.coverUrl || null;
            const isCardOsu = Boolean(bm.source === 'osu' || bm.keys || bm.rawOsu || bm.metadata?.source === 'osu');
            const cardMaimaiRating = calculateMaimaiRating(bm.beatmap);
            const cardCategory = normalizeMaimaiCategory(bm.difficultyName || meta.difficultyName);
            const cardLevel = bm.difficultyLevel || meta.difficultyLevel || cardMaimaiRating.levelString;

            return (
              <div
                key={bm.id}
                onClick={() => {
                  if (isSelectMode) {
                    playClick();
                    toggleSelectMap(bm.id);
                  } else {
                    playSelect();
                    onSelectBeatmap(bm);
                  }
                }}
                onContextMenu={(e) => handleCardContextMenu(e, bm)}
                className={`relative rounded-3xl transition-all duration-200 cursor-pointer overflow-hidden border [content-visibility:auto] [contain-intrinsic-size:100px] ${
                  isChecked
                    ? 'border-[#ff4d80] bg-[#fff0f5] shadow-[0_6px_24px_rgba(255,77,128,0.22)] ring-2 ring-[#ff4d80]/30'
                    : isSelected
                    ? 'border-[#ff4d80] shadow-[0_8px_30px_rgba(255,77,128,0.22)] scale-[1.01] bg-[#fff5f8]'
                    : 'border-[#f3dbe4] hover:border-[#ff85a2] bg-white/95 hover:bg-[#fffafc] shadow-[0_4px_16px_rgba(126,47,79,0.04)]'
                }`}
              >
                {/* Horizontal Card Body */}
                <div className="flex items-center justify-between p-3.5 gap-4 relative">
                  {/* Left: Thumbnail & Song Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {isSelectMode && (
                      <button
                        type="button"
                        aria-label={isChecked ? `Deselect ${title}` : `Select ${title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClick();
                          toggleSelectMap(bm.id);
                        }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          isChecked
                            ? 'bg-[#ff4d80] border-[#ff4d80] text-white shadow-sm scale-110'
                            : 'bg-white border-[#f3dbe4] text-transparent hover:border-[#ff85a2]'
                        }`}
                      >
                        <span className="text-xs font-black leading-none">✓</span>
                      </button>
                    )}

                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#fff1f5] shrink-0 border border-[#f3dbe4] flex items-center justify-center shadow-sm">
                      {cardCover ? (
                        <img src={cardCover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🐰</span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-torus font-black text-sm text-[#5b2a47] truncate max-w-sm group-hover:text-[#ff4d80] transition-colors">
                        {title}
                      </span>
                      <span className="text-xs font-bold text-[#ff4d80] truncate max-w-xs mt-0.5">
                        {artist}
                      </span>
                      <span className="text-[10px] text-[#a8556f] mt-0.5 flex items-center gap-1">
                        <span>Mapper:</span>
                        <strong className="text-[#5b2a47]">{bm.creator || meta.creator || 'Mapper'}</strong>
                        <span>🎀</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: DifficultyBadge (Maimai + osu! stars if osu) + Diff count */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button
                      type="button"
                      aria-label={`More actions for ${title}`}
                      title="Beatmap actions"
                      onClick={(e) => handleCardActionsClick(e, bm)}
                      className="w-8 h-8 rounded-full bg-[#fff1f5] hover:bg-[#ffe5ec] border border-[#f3dbe4] text-[#5b2a47] hover:text-[#ff4d80] flex items-center justify-center text-lg leading-none transition-colors cursor-pointer shrink-0"
                    >
                      ⋯
                    </button>
                    <DifficultyBadge
                      category={cardCategory}
                      level={cardLevel}
                      osuStars={stars}
                      showOsuStars={isCardOsu}
                      size="sm"
                    />
                    <span className="text-xs text-[#ff4d80] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#fff1f5] border border-[#f3dbe4]">
                      {bm.difficulties?.length || 1} diffs
                    </span>
                  </div>
                </div>

                {/* Expanded Difficulties Bar if selected */}
                {isSelected && diffList.length > 0 && (
                  <div className="px-4 py-2.5 bg-[#fffafc] border-t border-[#f3dbe4] flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <span className="text-[11px] font-black text-[#ff4d80] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                      <span>🎀</span>
                      <span>Difficulties:</span>
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
                              ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_2px_10px_rgba(255,77,128,0.3)] scale-105'
                              : 'bg-white text-[#5b2a47] hover:text-[#ff4d80] border border-[#f3dbe4]'
                          }`}
                        >
                          <span className="font-bold">{d.category || normalizeMaimaiCategory(d.difficultyName)}</span>
                          <span>{d.maimaiLevel || d.difficultyLevel || '10'}</span>
                          {isCardOsu && <span className="text-[10px] opacity-90">★{dStars.toFixed(1)}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {filteredBeatmaps.length === 0 && (
            <div className="p-8 text-center rounded-3xl bg-white/90 border border-[#f3dbe4] text-sm font-bold text-[#a8556f]">
              {activeCollection
                ? `No available beatmaps in "${activeCollection.name}". Add maps by right-clicking them from All Songs.`
                : 'No beatmaps match your search.'}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="h-auto min-h-14 sm:h-16 px-3 sm:px-6 py-2 sm:py-0 bg-[#fffafc]/90 backdrop-blur-md border-t border-[#f3dbe4] flex flex-wrap items-center justify-between z-30 shrink-0 gap-2 shadow-[0_-4px_20px_rgba(126,47,79,0.04)]">
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
            title="Autoplay Mode"
          >
            <span className="hidden sm:inline">Mods: {isAutoplay ? 'Autoplay ON' : 'None'}</span>
            <span className="sm:hidden">{isAutoplay ? 'Auto' : 'Mods'}</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={handleRandomSelect} icon="🎲" className="px-2 sm:px-3 text-xs" title="Select Random Track">
            <span className="hidden sm:inline">Random (F2) 🎀</span>
            <span className="sm:hidden">Random</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={onOpenSettings} icon="⚙" className="px-2 sm:px-3 text-xs" title="Settings">
            <span className="hidden sm:inline">Options</span>
          </Button>
        </div>

        {/* Right: PLAY Button */}
        <Button
          variant="primary"
          size="lg"
          onClick={handlePlaySelected}
          className="w-full sm:w-auto justify-center px-4 sm:px-10 py-2 sm:py-3 text-sm sm:text-base font-black shadow-[0_4px_24px_rgba(255,77,128,0.4)] hover:shadow-[0_6px_32px_rgba(255,77,128,0.6)] hover:scale-105 active:scale-95 shrink-0"
          icon="🐰"
        >
          <span>PLAY NOW 🎀</span>
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
            label: 'Play this track',
            icon: '▶',
            onClick: () => {
              if (contextMenu.beatmap) {
                onSelectBeatmap(contextMenu.beatmap);
                handlePlaySelected();
              }
            }
          },
          {
            label: 'Add to collection...',
            icon: '📚',
            onClick: () => handleOpenAddToCollection(contextMenu.beatmap)
          },
          ...(activeCollection ? [{
            label: `Remove from "${activeCollection.name}"`,
            icon: '➖',
            onClick: () => handleRemoveFromCollection(contextMenu.beatmap)
          }] : []),
          { divider: true },
          {
            label: contextMenu.beatmap?.source === 'maimai'
              || contextMenu.beatmap?.beatmap?.metadata?.source === 'maimai'
              ? 'Export .zip package (maimai)'
              : 'Export .osz package (osu!)',
            icon: '⬇',
            onClick: () => handleExportBeatmap(contextMenu.beatmap)
          },
          {
            label: uploadingMapId === contextMenu.beatmap?.id
              ? 'Uploading to online library...'
              : 'Upload / update online library',
            icon: '☁',
            onClick: () => handleUploadServerMap(contextMenu.beatmap)
          },
          { divider: true },
          {
            label: 'Delete from device (IndexedDB)',
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
            label: 'Delete from Server & Device',
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
        title="Confirm Delete Beatmap?"
        message={`Are you sure you want to delete "${deleteConfirm.beatmap?.title || 'this beatmap'}"? The track will be moved to temporary Trash and can be undone immediately (Ctrl+Z).`}
        confirmText={deleteConfirm.deleteFromServer ? 'Delete from Server & Device' : 'Delete from device'}
        confirmVariant="danger"
      />

      {/* Confirm Bulk Delete Dialog */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm.isOpen}
        onClose={() => setBulkDeleteConfirm({ isOpen: false, count: 0, deleteFromServer: false })}
        onConfirm={confirmBulkDelete}
        title="Confirm Bulk Delete?"
        message={`Are you sure you want to delete ${bulkDeleteConfirm.count} beatmaps? They will be moved to temporary Trash and can be undone immediately (Ctrl+Z).`}
        confirmText={bulkDeleteConfirm.deleteFromServer ? `Delete ${bulkDeleteConfirm.count} from Server & Device` : `Delete ${bulkDeleteConfirm.count} beatmaps`}
        confirmVariant="danger"
      />

      <Modal
        isOpen={isDownloadMapsOpen}
        onClose={() => setIsDownloadMapsOpen(false)}
        title="Download Maps"
        description="Download a published map and its available audio, cover, and video assets to this device."
        maxWidth="max-w-3xl"
      >
        <div className="flex flex-col gap-3">
          <input
            type="search"
            value={serverMapSearch}
            onChange={(event) => setServerMapSearch(event.target.value)}
            placeholder="Search online maps..."
            aria-label="Search online maps"
            className="w-full px-4 py-2 rounded-full bg-white border border-[#f3dbe4] focus:border-[#ff4d80] outline-none text-sm text-[#5b2a47] placeholder-[#a8556f]"
          />

          <div className="max-h-[55vh] min-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {isLoadingServerMaps ? (
              <p className="p-8 text-center text-xs text-[#a8556f]">Loading published maps...</p>
            ) : filteredServerMaps.length > 0 ? (
              filteredServerMaps.map((map) => {
                const isDownloaded = beatmaps.some((beatmap) => beatmap.id === map.song_id);
                const hasChart = map.chart_available !== false;
                return (
                  <div
                    key={map.song_id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-[#5b2a47] truncate">{map.title || 'Untitled Map'}</div>
                      <div className="text-[11px] text-[#a8556f] truncate">
                        {map.artist || 'Unknown Artist'} · {map.creator || 'Mapper'}
                      </div>
                      <div className="mt-1 text-[10px] text-[#a8556f]">
                        {map.difficulties?.length || 0} difficulties · {map.source || 'beatmap'}
                      </div>
                      {!hasChart && (
                        <div className="mt-1 text-[10px] font-bold text-[#c33b5d]">
                          Chart missing — upload this map again from PC.
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isDownloaded || !hasChart ? 'ghost' : 'primary'}
                      disabled={!hasChart || downloadingMapId !== null}
                      onClick={() => handleDownloadServerMap(map)}
                      className="shrink-0"
                    >
                      {!hasChart
                        ? 'Missing Chart'
                        : downloadingMapId === map.song_id
                        ? 'Downloading...'
                        : isDownloaded
                          ? 'Download Again'
                          : 'Download'}
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="p-8 text-center text-xs text-[#a8556f]">
                {serverMaps.length === 0
                  ? 'No published maps are available yet.'
                  : 'No maps match your search.'}
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAddToCollectionOpen}
        onClose={() => setIsAddToCollectionOpen(false)}
        title="Add to Collection"
        description={`Choose a collection for "${collectionTargetBeatmap?.title || 'this beatmap'}", or create a new one.`}
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="text-xs font-black uppercase tracking-wide text-[#a8556f] mb-2">
              Add to an existing collection
            </h3>
            {collections.length > 0 ? (
              <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    disabled={isSavingCollection}
                    onClick={() => handleAddToCollection(collection.id)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] hover:border-[#ff85a2] hover:bg-[#fff0f4] text-left transition-colors disabled:opacity-50"
                  >
                    <span className="font-bold text-[#5b2a47] truncate">{collection.name}</span>
                    <span className="text-[11px] text-[#a8556f] shrink-0">
                      {collection.beatmapIds?.length || 0} maps
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-3 rounded-2xl bg-[#fff8fa] text-xs text-[#a8556f]">
                You don't have any collections yet.
              </p>
            )}
          </section>

          <section className="pt-4 border-t border-[#f3dbe4]">
            <h3 className="text-xs font-black uppercase tracking-wide text-[#a8556f] mb-2">
              Or create a new collection
            </h3>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateCollection();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                maxLength={60}
                placeholder="Collection name"
                aria-label="New collection name"
                className="flex-1 min-w-0 px-4 py-2 rounded-full bg-white border border-[#f3dbe4] focus:border-[#ff4d80] outline-none text-sm text-[#5b2a47] placeholder-[#a8556f]"
              />
              <Button type="submit" variant="primary" disabled={isSavingCollection || !newCollectionName.trim()}>
                {isSavingCollection ? 'Saving...' : 'Create & Add'}
              </Button>
            </form>
          </section>
        </div>
      </Modal>

      <Modal
        isOpen={isCollectionsOpen}
        onClose={() => setIsCollectionsOpen(false)}
        title="My Collections"
        description="Open a collection to browse and play only the beatmaps you added."
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-2">
          {collections.length > 0 ? (
            collections.map((collection) => {
              const mapCount = (collection.beatmapIds || []).filter((id) =>
                beatmaps.some((beatmap) => beatmap.id === id)
              ).length;
              return (
                <div
                  key={collection.id}
                  className="flex items-center gap-2 p-3 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      playSelect();
                      setSearchQuery('');
                      setActiveCollectionId(collection.id);
                      const firstMap = beatmaps.find((beatmap) => collection.beatmapIds?.includes(beatmap.id));
                      if (firstMap) onSelectBeatmap(firstMap);
                      setIsCollectionsOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <span className="block font-black text-[#5b2a47] truncate">{collection.name}</span>
                    <span className="block mt-0.5 text-[11px] text-[#a8556f]">
                      {mapCount} {mapCount === 1 ? 'beatmap' : 'beatmaps'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionDeleteConfirm(collection)}
                    aria-label={`Delete collection ${collection.name}`}
                    title="Delete collection"
                    className="w-9 h-9 rounded-full border border-[#f3dbe4] text-[#e94267] hover:bg-[#ffeef2] cursor-pointer shrink-0"
                  >
                    🗑
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center rounded-2xl bg-[#fff8fa] text-xs text-[#a8556f]">
              No collections yet. Right-click a beatmap and choose “Add to collection...” to create one.
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(collectionDeleteConfirm)}
        onClose={() => setCollectionDeleteConfirm(null)}
        onConfirm={handleDeleteCollection}
        title="Delete Collection?"
        message={`Delete "${collectionDeleteConfirm?.name || ''}"? The beatmaps themselves will not be deleted.`}
        confirmText="Delete Collection"
        confirmVariant="danger"
      />

      {/* TRASH BIN MODAL */}
      <Modal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        title="Beatmap Trash (Temporarily Deleted)"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-[#a8556f]">
              Deleted beatmaps are stored safely here and can be restored at any time.
            </p>
            {trashMaps.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRestoreAllTrash}
                  icon="⤺"
                >
                  Restore All
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClearAllTrash}
                  icon="🗑"
                >
                  Empty Trash
                </Button>
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[#f3dbe4] custom-scrollbar border border-[#f3dbe4] rounded-2xl bg-white shadow-sm">
            {trashMaps.length > 0 ? (
              trashMaps.map((m) => (
                <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#fff0f4] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#fff1f5] border border-[#f3dbe4] flex items-center justify-center text-[#ff4d80] shrink-0 overflow-hidden shadow-sm">
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
                      <span className="font-bold text-[#5b2a47] text-xs truncate max-w-xs">{m.title}</span>
                      <span className="text-[10px] text-[#a8556f] truncate max-w-xs">{m.artist}</span>
                      {m.deletedAt && (
                        <span className="text-[9px] font-mono text-[#ff4d80] font-bold">
                          Deleted: {new Date(m.deletedAt).toLocaleString()}
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
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handlePermanentDelete(m)}
                      icon="✕"
                    >
                      Delete Permanently
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#a8556f] text-xs font-bold">
                Trash is empty. No deleted beatmaps.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
