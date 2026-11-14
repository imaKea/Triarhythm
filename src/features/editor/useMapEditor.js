/**
 * useMapEditor - state + logic của Map Editor.
 *
 * Bao gồm: beatmap/notes, undo history, selection/clipboard, playback audio,
 * timeline virtualization, save/export và kiểm tra hợp lệ (validator).
 * Toàn bộ phần vẽ canvas nằm trong editorPreview.js.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TRI_RING_LAYOUT, layoutToPixels } from '../../config/layout.config.js';
import { dbManager } from '../../core/storage/db.js';
import { apiClient } from '../../core/api/client.js';
import { validateBeatmap } from '../../core/beatmap/validator.js';
import {
  createBlankBeatmap,
  pushHistory,
  undoHistory,
  redoHistory,
  flipNotesHorizontal,
  flipNotesVertical,
  createClipboard,
  notesFromClipboard,
  createNote,
  snapTime,
  buildBeatmapSavePayload,
  serializeBeatmapExport,
  getExportFilename,
  formatTime
} from './editorModel.js';
import { drawEditorPreview, drawOverview } from './editorPreview.js';
import { KEY_TO_LANE, TRACK_HEADER_WIDTH, SNAP_OPTIONS } from './editorConstants.js';

function createInitialBeatmap(initialBeatmap) {
  if (initialBeatmap) {
    return JSON.parse(JSON.stringify(initialBeatmap.beatmap || initialBeatmap));
  }
  return createBlankBeatmap();
}

function createInitialAudioUrl(initialBeatmap) {
  if (initialBeatmap?.audioBlob && typeof URL !== 'undefined') {
    return URL.createObjectURL(initialBeatmap.audioBlob);
  }
  if (initialBeatmap?.audioSource) return initialBeatmap.audioSource;
  if (initialBeatmap?.beatmap?.metadata?.id === 'sample-neon-odyssey') return null;
  return '/audio.ogg';
}

export function useMapEditor({ initialBeatmap = null, onTestPlay = null } = {}) {
  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const [beatmap, setBeatmap] = useState(() => createInitialBeatmap(initialBeatmap));
  const [activeTab, setActiveTab] = useState('compose'); // 'setup' | 'compose' | 'timing' | 'verify'
  const [editorOrientation, setEditorOrientation] = useState('vertical');
  const [audioUrl, setAudioUrl] = useState(() => createInitialAudioUrl(initialBeatmap));
  const [songDuration, setSongDuration] = useState(180000);

  // Playback
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [snapDivisor, setSnapDivisor] = useState(4);
  const [zoom, setZoom] = useState(1.0);
  const [activeTool, setActiveTool] = useState('tap');
  const [holdDuration, setHoldDuration] = useState(1000);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);

  // View toggles
  const [showRayGuides, setShowRayGuides] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // Dirty state & Autosave
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Virtualization
  const [timelineScroll, setTimelineScroll] = useState(0);
  const [viewportSize, setViewportSize] = useState(600);

  // Selection / clipboard / history
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [clipboard, setClipboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Validator
  const [validation, setValidation] = useState(null);
  const [validationSource, setValidationSource] = useState(null);

  // ---------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const timelineRef = useRef(null);
  const overviewCanvasRef = useRef(null);
  const overviewProgressRef = useRef(null);
  const overviewThumbRef = useRef(null);
  const playheadLineRef = useRef(null);
  const playheadBadgeRef = useRef(null);
  const timeDisplayRef = useRef(null);

  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playbackSpeedRef = useRef(1.0);
  const metronomeEnabledRef = useRef(false);
  const lastMetronomeBeatRef = useRef(-1);
  const audioContextRef = useRef(null);

  const lastPerfTimeRef = useRef(null);
  const lastStateSyncRef = useRef(0);
  const dragStateRef = useRef(null);
  const isDraggingNoteRef = useRef(false);
  const [isDraggingNote, setIsDraggingNote] = useState(false);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { metronomeEnabledRef.current = metronomeEnabled; }, [metronomeEnabled]);

  // ---------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------
  const bpm = beatmap.timingPoints?.[0]?.bpm || 140;
  const beatLength = beatmap.timingPoints?.[0]?.beatLength || (60000 / bpm);
  const meter = beatmap.timingPoints?.[0]?.meter || 4;
  const snapMs = beatLength / snapDivisor;

  const maxNoteTime = useMemo(() => {
    return (beatmap.notes || []).reduce((max, n) => Math.max(max, n.endTime || n.time || 0), 0);
  }, [beatmap.notes]);

  const totalDurationMs = Math.max(songDuration, maxNoteTime + 20000, 180000);
  const timeScale = 0.2 * zoom;
  const totalPixels = totalDurationMs * timeScale;

  // ---------------------------------------------------------------------
  // Notes + history + dirty flag
  // ---------------------------------------------------------------------
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const updateNotesWithHistory = useCallback((newNotes) => {
    setHistory((prev) => pushHistory(prev, beatmap.notes));
    setRedoStack([]);
    setIsDirty(true);
    setBeatmap((prev) => ({ ...prev, notes: newNotes }));
  }, [beatmap.notes]);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      const result = undoHistory(prev, null);
      if (!result.undone) return prev;
      setRedoStack((redo) => [...redo, beatmap.notes]);
      setBeatmap((bm) => ({ ...bm, notes: result.notes }));
      setSelectedIndices(new Set());
      setIsDirty(true);
      return result.history;
    });
  }, [beatmap.notes]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (!prevRedo || prevRedo.length === 0) return prevRedo;
      const nextNotes = prevRedo[prevRedo.length - 1];
      setHistory((prevHist) => pushHistory(prevHist, beatmap.notes));
      setBeatmap((bm) => ({ ...bm, notes: nextNotes }));
      setSelectedIndices(new Set());
      setIsDirty(true);
      return prevRedo.slice(0, -1);
    });
  }, [beatmap.notes]);

  // Lật đối xứng ngang và dọc
  const handleFlipHorizontal = useCallback(() => {
    const flipped = flipNotesHorizontal(beatmap.notes, selectedIndices);
    updateNotesWithHistory(flipped);
  }, [beatmap.notes, selectedIndices, updateNotesWithHistory]);

  const handleFlipVertical = useCallback(() => {
    const flipped = flipNotesVertical(beatmap.notes, selectedIndices);
    updateNotesWithHistory(flipped);
  }, [beatmap.notes, selectedIndices, updateNotesWithHistory]);

  // Đổi snap divisor theo bước
  const SNAP_DIVISORS = [1, 2, 3, 4, 6, 8, 12, 16];
  const handleCycleSnap = useCallback((direction) => {
    setSnapDivisor((current) => {
      const idx = SNAP_DIVISORS.indexOf(current);
      if (idx === -1) return 4;
      if (direction > 0) {
        return SNAP_DIVISORS[Math.min(SNAP_DIVISORS.length - 1, idx + 1)];
      } else {
        return SNAP_DIVISORS[Math.max(0, idx - 1)];
      }
    });
  }, []);

  // Metronome tick sound
  const playMetronomeTick = useCallback((isMeasureStart) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isMeasureStart ? 1200 : 700, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (_) {}
  }, []);

  // Autosave draft mỗi 30s
  useEffect(() => {
    const mapId = beatmap.metadata?.id || 'default_draft';
    const draftKey = `triarhythm_draft_${mapId}`;

    const interval = setInterval(async () => {
      if (isDirty) {
        try {
          const payload = buildBeatmapSavePayload(beatmap, { existing: initialBeatmap || null });
          localStorage.setItem(draftKey, JSON.stringify({ payload, savedAt: Date.now() }));
          await dbManager.saveBeatmap({ ...payload, isDraft: true }).catch(() => {});
          setLastSavedTime(Date.now());
        } catch (err) {
          console.warn('[Editor] Autosave draft failed:', err);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isDirty, beatmap, initialBeatmap]);

  // Cảnh báo beforeunload khi có thay đổi chưa lưu
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Bạn có thay đổi chưa lưu trong beatmap. Bạn có chắc muốn rời đi?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ---------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      isPlayingRef.current = next;
      if (audioRef.current && audioUrl) {
        if (next) {
          audioRef.current.currentTime = currentTimeRef.current / 1000;
          audioRef.current.playbackRate = playbackSpeedRef.current;
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
      return next;
    });
  }, [audioUrl]);

  const handleSeek = useCallback((newTime) => {
    const clamped = Math.max(0, Math.min(totalDurationMs, newTime));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);

    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = clamped / 1000;
    }

    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = formatTime(clamped);
    }
    const pct = Math.min(100, (clamped / totalDurationMs) * 100);
    if (overviewProgressRef.current) {
      overviewProgressRef.current.style.width = `${pct}%`;
    }
    if (overviewThumbRef.current) {
      overviewThumbRef.current.style.left = `${pct}%`;
    }
  }, [audioUrl, totalDurationMs]);

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
      setSongDuration(audioRef.current.duration * 1000);
    }
  };

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, []);

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    playbackSpeedRef.current = speed;
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleUploadAudio = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.currentTime = currentTimeRef.current / 1000;
    }
  };

  // ---------------------------------------------------------------------
  // Selection / clipboard
  // ---------------------------------------------------------------------
  const handleSelectAll = useCallback(() => {
    setSelectedIndices(new Set(beatmap.notes.map((_, i) => i)));
  }, [beatmap.notes]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) return;
    const newNotes = beatmap.notes.filter((_, i) => !selectedIndices.has(i));
    updateNotesWithHistory(newNotes);
    setSelectedIndices(new Set());
  }, [beatmap.notes, selectedIndices, updateNotesWithHistory]);

  const handleDeleteSingleNote = useCallback((idx) => {
    const newNotes = beatmap.notes.filter((_, i) => i !== idx);
    updateNotesWithHistory(newNotes);
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  }, [beatmap.notes, updateNotesWithHistory]);

  const handleCopy = useCallback(() => {
    setClipboard(createClipboard(beatmap.notes, selectedIndices));
  }, [selectedIndices, beatmap.notes]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDeleteSelected();
  }, [handleCopy, handleDeleteSelected]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    const pastedNotes = notesFromClipboard(clipboard, currentTimeRef.current, snapMs);

    const newNotes = [...beatmap.notes, ...pastedNotes].sort((a, b) => a.time - b.time);
    updateNotesWithHistory(newNotes);

    const pastedSignature = new Set(pastedNotes.map((p) => `${p.time}_${p.lane}`));
    const newSelection = new Set();
    newNotes.forEach((n, idx) => {
      if (pastedSignature.has(`${n.time}_${n.lane}`)) {
        newSelection.add(idx);
      }
    });
    setSelectedIndices(newSelection);
  }, [clipboard, snapMs, beatmap.notes, updateNotesWithHistory]);

  // ---------------------------------------------------------------------
  // Add / drag notes
  // ---------------------------------------------------------------------
  const handleAddNote = useCallback((laneIndex, time) => {
    if (activeTool === 'select') return;

    const noteType = laneIndex === 'ring' ? 'ring' : activeTool;
    const noteObj = createNote({
      type: noteType,
      lane: laneIndex === 'ring' ? undefined : laneIndex,
      time,
      snapMs,
      holdDuration
    });

    const newNotes = [...beatmap.notes, noteObj].sort((a, b) => a.time - b.time);
    updateNotesWithHistory(newNotes);

    const newIdx = newNotes.findIndex((n) => n === noteObj);
    if (newIdx !== -1) setSelectedIndices(new Set([newIdx]));
  }, [activeTool, beatmap.notes, holdDuration, snapMs, updateNotesWithHistory]);

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;
    const scale = Math.min(width / TRI_RING_LAYOUT.bounds.width, height / TRI_RING_LAYOUT.bounds.height);
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, width, height);

    const distToCenter = Math.hypot(x - originPix.x, y - originPix.y);
    if (distToCenter <= 30 * (scale / 240)) {
      handleAddNote('ring', currentTimeRef.current);
      return;
    }

    for (const lane of TRI_RING_LAYOUT.tapLanes) {
      const p = layoutToPixels(lane.x, lane.y, width, height);
      const rPix = lane.a * scale;
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist <= rPix * 1.35) {
        handleAddNote(lane.lane, currentTimeRef.current);
        return;
      }
    }
  }, [handleAddNote]);

  const handleNoteMouseDown = useCallback((e, noteIdx, note) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    dragStateRef.current = {
      noteIdx,
      origNote: { ...note },
      origNotes: [...beatmap.notes],
      startX: e.clientX,
      startY: e.clientY,
      didDrag: false
    };

    if (e.shiftKey || e.ctrlKey) {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(noteIdx)) next.delete(noteIdx);
        else next.add(noteIdx);
        return next;
      });
    } else {
      setSelectedIndices(new Set([noteIdx]));
    }
  }, [beatmap.notes]);

  const handleHoldResizeMouseDown = useCallback((e, noteIdx, note) => {
    e.stopPropagation();
    e.preventDefault();
    const origEndTime = note.endTime || (note.time + holdDuration);
    const startPos = editorOrientation === 'vertical' ? e.clientY : e.clientX;
    const origNotes = [...beatmap.notes];

    const onMouseMove = (moveEvent) => {
      const currentPos = editorOrientation === 'vertical' ? moveEvent.clientY : moveEvent.clientX;
      const deltaPix = currentPos - startPos;
      const deltaTime = deltaPix / timeScale;
      const newEndTime = Math.max(note.time + snapMs, Math.round((origEndTime + deltaTime) / snapMs) * snapMs);

      setBeatmap((prev) => {
        const notes = [...prev.notes];
        if (notes[noteIdx]) {
          notes[noteIdx] = { ...notes[noteIdx], endTime: newEndTime };
        }
        return { ...prev, notes };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setHistory((prev) => pushHistory(prev, origNotes));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [beatmap.notes, editorOrientation, holdDuration, snapMs, timeScale]);

  // Drag note bằng chuột
  useEffect(() => {
    const handleMouseMove = (e) => {
      const state = dragStateRef.current;
      if (!state) return;

      const deltaX = e.clientX - state.startX;
      const deltaY = e.clientY - state.startY;

      if (!state.didDrag && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
        state.didDrag = true;
        isDraggingNoteRef.current = true;
        setIsDraggingNote(true);
      }

      if (!state.didDrag) return;

      let deltaTime = 0;
      let newLane = state.origNote.lane;
      let newType = state.origNote.type;

      if (editorOrientation === 'vertical') {
        deltaTime = deltaY / timeScale;
        if (timelineRef.current) {
          const rect = timelineRef.current.getBoundingClientRect();
          const relX = e.clientX - rect.left + timelineRef.current.scrollLeft - 36;
          const colWidth = Math.max(34, (rect.width - 36) / 10);
          const colIdx = Math.max(0, Math.min(9, Math.floor(relX / colWidth)));
          if (colIdx === 9) {
            newLane = 'ring';
            newType = 'ring';
          } else {
            newLane = colIdx;
            if (newType === 'ring') newType = 'tap';
          }
        }
      } else {
        deltaTime = deltaX / timeScale;
        if (timelineRef.current) {
          const rect = timelineRef.current.getBoundingClientRect();
          const relY = e.clientY - rect.top + timelineRef.current.scrollTop - 28;
          const trackIdx = Math.max(0, Math.min(9, Math.floor(relY / 24)));
          if (trackIdx === 9) {
            newLane = 'ring';
            newType = 'ring';
          } else {
            newLane = trackIdx;
            if (newType === 'ring') newType = 'tap';
          }
        }
      }

      const newTime = Math.max(0, Math.round((state.origNote.time + deltaTime) / snapMs) * snapMs);

      setBeatmap((prev) => {
        const notes = [...prev.notes];
        const target = notes[state.noteIdx];
        if (!target) return prev;

        const updated = { ...target, time: newTime, type: newType };

        if (newLane === 'ring') {
          delete updated.lane;
        } else {
          updated.lane = newLane;
        }

        if (target.endTime && state.origNote.endTime) {
          const duration = state.origNote.endTime - state.origNote.time;
          updated.endTime = newTime + duration;
        }

        notes[state.noteIdx] = updated;
        return { ...prev, notes };
      });
    };

    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (state) {
        if (state.didDrag) {
          setHistory((prev) => pushHistory(prev, state.origNotes));
          setBeatmap((prev) => {
            const sorted = [...prev.notes].sort((a, b) => a.time - b.time);
            return { ...prev, notes: sorted };
          });
        }
        dragStateRef.current = null;
        isDraggingNoteRef.current = false;
        setIsDraggingNote(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editorOrientation, timeScale, snapMs]);

  // ---------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 's') {
          e.preventDefault();
          handleSaveToDatabase();
        } else if (key === 'a') {
          e.preventDefault();
          handleSelectAll();
        } else if (key === 'c') {
          e.preventDefault();
          handleCopy();
        } else if (key === 'v') {
          e.preventDefault();
          handlePaste();
        } else if (key === 'x') {
          e.preventDefault();
          handleCut();
        } else if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        } else if (key === 'y') {
          e.preventDefault();
          handleRedo();
        } else if (key === 'h') {
          e.preventDefault();
          handleFlipHorizontal();
        } else if (key === 'j') {
          e.preventDefault();
          handleFlipVertical();
        } else if (key === 't') {
          e.preventDefault();
          handleTestPlay();
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleTestPlay();
      } else if (e.code === 'Digit1') {
        e.preventDefault();
        setActiveTool('select');
      } else if (e.code === 'Digit2') {
        e.preventDefault();
        setActiveTool('tap');
      } else if (e.code === 'Digit3') {
        e.preventDefault();
        setActiveTool('hold');
      } else if (e.code === 'Digit4') {
        e.preventDefault();
        setActiveTool('break');
      } else if (e.code === 'Digit5') {
        e.preventDefault();
        setActiveTool('ring');
      } else if (e.code === 'Digit6') {
        e.preventDefault();
        setActiveTool('slide');
      } else if (e.code === 'Digit7') {
        e.preventDefault();
        setActiveTool('typing');
      } else if (e.key === ',' || e.code === 'Comma') {
        e.preventDefault();
        handleCycleSnap(-1);
      } else if (e.key === '.' || e.code === 'Period') {
        e.preventDefault();
        handleCycleSnap(1);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.shiftKey ? beatLength * meter : snapMs;
        handleSeek(Math.max(0, currentTimeRef.current - step));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? beatLength * meter : snapMs;
        handleSeek(Math.min(totalDurationMs, currentTimeRef.current + step));
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleSeek(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        handleSeek(maxNoteTime);
      } else {
        const lane = KEY_TO_LANE[e.code];
        if (lane !== undefined) {
          e.preventDefault();
          handleAddNote(lane, currentTimeRef.current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleSelectAll, handleCopy, handlePaste, handleCut, handleUndo, handleRedo,
    handleFlipHorizontal, handleFlipVertical, handleTestPlay, handleCycleSnap,
    handleDeleteSelected, handleTogglePlay, handleSeek, handleAddNote,
    beatLength, meter, snapMs, totalDurationMs, maxNoteTime
  ]);

  // ---------------------------------------------------------------------
  // Timeline scroll / zoom / overview
  // ---------------------------------------------------------------------
  const handleTimelineWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.4, Math.min(3.0, parseFloat((prev + zoomDelta).toFixed(1)))));
      return;
    }

    e.preventDefault();
    const step = e.shiftKey ? beatLength * meter : snapMs;
    const direction = e.deltaY > 0 ? 1 : -1;
    const target = Math.max(0, Math.min(totalDurationMs, Math.round((currentTimeRef.current + direction * step) / snapMs) * snapMs));
    handleSeek(target);
  };

  const handleOverviewMouseDown = (e) => {
    if (e.button !== 0) return;
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = clickX / rect.width;
    handleSeek(Math.round((pct * totalDurationMs) / snapMs) * snapMs);

    const onMouseMove = (moveEvent) => {
      const curX = Math.max(0, Math.min(rect.width, moveEvent.clientX - rect.left));
      const curPct = curX / rect.width;
      handleSeek(Math.round((curPct * totalDurationMs) / snapMs) * snapMs);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTimelineScroll = (e) => {
    if (editorOrientation === 'vertical') {
      setTimelineScroll(e.target.scrollTop);
      setViewportSize(e.target.clientHeight);
    } else {
      setTimelineScroll(e.target.scrollLeft);
      setViewportSize(e.target.clientWidth);
    }
  };

  // ---------------------------------------------------------------------
  // Overview canvas
  // ---------------------------------------------------------------------
  useEffect(() => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawOverview(ctx, canvas.width, canvas.height, beatmap.notes, totalDurationMs);
  }, [beatmap.notes, totalDurationMs]);

  // ---------------------------------------------------------------------
  // Animation loop: audio sync + preview + playhead + throttled React state
  // ---------------------------------------------------------------------
  const drawPreview = useCallback((renderTime) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const curTime = renderTime !== undefined ? renderTime : currentTimeRef.current;
    drawEditorPreview(ctx, canvas.width, canvas.height, beatmap, selectedIndices, curTime);
  }, [beatmap, selectedIndices]);

  useEffect(() => {
    let animId;
    const loop = (perfTime) => {
      let nowMs = currentTimeRef.current;

      if (isPlayingRef.current) {
        if (audioRef.current && audioUrl && !audioRef.current.paused) {
          nowMs = audioRef.current.currentTime * 1000;
        } else if (lastPerfTimeRef.current !== null) {
          const delta = (perfTime - lastPerfTimeRef.current) * playbackSpeedRef.current;
          nowMs += delta;
        }
        lastPerfTimeRef.current = perfTime;
        currentTimeRef.current = nowMs;

        const posPix = nowMs * timeScale;
        if (playheadLineRef.current) {
          if (editorOrientation === 'vertical') {
            playheadLineRef.current.style.top = `${posPix}px`;
          } else {
            playheadLineRef.current.style.left = `${posPix + TRACK_HEADER_WIDTH}px`;
          }
        }
        if (playheadBadgeRef.current) {
          if (editorOrientation === 'vertical') {
            playheadBadgeRef.current.style.top = `${posPix}px`;
          } else {
            playheadBadgeRef.current.style.left = `${posPix + TRACK_HEADER_WIDTH}px`;
          }
        }
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = formatTime(nowMs);
        }

        const pct = Math.min(100, (nowMs / totalDurationMs) * 100);
        if (overviewProgressRef.current) {
          overviewProgressRef.current.style.width = `${pct}%`;
        }
        if (overviewThumbRef.current) {
          overviewThumbRef.current.style.left = `${pct}%`;
        }

        if (timelineRef.current && !isDraggingNoteRef.current) {
          if (editorOrientation === 'vertical') {
            const centerOffset = timelineRef.current.clientHeight / 2;
            timelineRef.current.scrollTop = Math.max(0, posPix - centerOffset);
          } else {
            const centerOffset = timelineRef.current.clientWidth / 2;
            timelineRef.current.scrollLeft = Math.max(0, posPix - centerOffset + TRACK_HEADER_WIDTH);
          }
        }

        if (perfTime - lastStateSyncRef.current > 120) {
          lastStateSyncRef.current = perfTime;
          setCurrentTime(nowMs);
        }

        // Metronome click on beat
        if (metronomeEnabledRef.current) {
          const tpTime = beatmap.timingPoints?.[0]?.time || 0;
          const currentBeatIdx = Math.floor((nowMs - tpTime) / beatLength);
          if (currentBeatIdx !== lastMetronomeBeatRef.current && currentBeatIdx >= 0) {
            lastMetronomeBeatRef.current = currentBeatIdx;
            const isMeasureStart = currentBeatIdx % meter === 0;
            playMetronomeTick(isMeasureStart);
          }
        }
      } else {
        lastPerfTimeRef.current = null;
      }

      drawPreview(nowMs);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [drawPreview, audioUrl, editorOrientation, timeScale, totalDurationMs]);

  // ---------------------------------------------------------------------
  // Virtualization
  // ---------------------------------------------------------------------
  const visibleGridLines = useMemo(() => {
    const lines = [];
    const visibleStartTime = Math.max(0, (timelineScroll - 200) / timeScale);
    const visibleEndTime = (timelineScroll + viewportSize + 200) / timeScale;

    const startSnap = Math.max(0, Math.floor(visibleStartTime / snapMs));
    const endSnap = Math.min(Math.ceil(totalDurationMs / snapMs), Math.ceil(visibleEndTime / snapMs));

    for (let s = startSnap; s <= endSnap; s++) {
      const tickTime = s * snapMs;
      const pos = tickTime * timeScale;

      const beatIdx = Math.round(tickTime / beatLength);
      const isFullBeat = Math.abs(tickTime - beatIdx * beatLength) < 1.0;
      const isMeasure = isFullBeat && (beatIdx % meter === 0);
      const measureNum = Math.floor(beatIdx / meter) + 1;

      let color = 'rgba(59, 130, 246, 0.25)';
      let width = 1;
      let opacity = 0.3;
      let label = null;

      if (isMeasure) {
        color = '#ffffff';
        width = 2;
        opacity = 0.6;
        label = `M${measureNum}`;
      } else if (isFullBeat) {
        color = '#ef4444';
        width = 1.5;
        opacity = 0.45;
        label = `${(beatIdx % meter) + 1}`;
      } else {
        if (snapDivisor === 2 || (snapDivisor === 4 && s % 2 === 0)) {
          color = '#ef4444';
          opacity = 0.35;
        } else if (snapDivisor === 4) {
          color = '#3b82f6';
          opacity = 0.3;
        } else if (snapDivisor === 8) {
          color = (s % 2 === 0) ? '#3b82f6' : '#eab308';
          opacity = 0.28;
        } else if (snapDivisor === 16) {
          color = (s % 4 === 0) ? '#3b82f6' : ((s % 2 === 0) ? '#eab308' : '#a855f7');
          opacity = 0.22;
        } else if (snapDivisor === 3 || snapDivisor === 6 || snapDivisor === 12) {
          color = '#d946ef';
          opacity = 0.35;
        }
      }

      lines.push({ key: `line_${s}`, pos, color, width, opacity, isMeasure, isFullBeat, label });
    }

    return lines;
  }, [timelineScroll, viewportSize, timeScale, snapMs, beatLength, meter, snapDivisor, totalDurationMs]);

  const visibleNotes = useMemo(() => {
    const visibleStartTime = Math.max(0, (timelineScroll - 200) / timeScale);
    const visibleEndTime = (timelineScroll + viewportSize + 200) / timeScale;

    return beatmap.notes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => {
        const noteEnd = note.endTime || note.time;
        return noteEnd >= visibleStartTime && note.time <= visibleEndTime;
      });
  }, [beatmap.notes, timelineScroll, viewportSize, timeScale]);

  // ---------------------------------------------------------------------
  // Save / export / validate
  // ---------------------------------------------------------------------
  const buildPayload = useCallback(() => {
    return buildBeatmapSavePayload(beatmap, { existing: initialBeatmap || null });
  }, [beatmap, initialBeatmap]);

  const runValidation = useCallback((source) => {
    const payload = buildPayload();
    const result = validateBeatmap(payload);
    setValidation(result);
    setValidationSource(source);
    return { payload, result };
  }, [buildPayload]);

  /**
   * Lưu chính thức: ghi IndexedDB + đồng bộ MySQL nếu đăng nhập + reset dirty.
   * Chặn nếu validator báo lỗi.
   * @returns {Promise<boolean>} đã lưu hay chưa
   */
  const handleSaveToDatabase = useCallback(async () => {
    const { payload, result } = runValidation('save');
    if (!result.valid) return false;

    try {
      await dbManager.saveBeatmap(payload);

      // Đồng bộ MySQL nếu đã đăng nhập
      if (apiClient.getToken()) {
        try {
          await apiClient.saveMap(payload);
          if (payload.audioBlob || payload.backgroundBlob || payload.videoBlob) {
            await apiClient.uploadMapAssets(payload.id, {
              audio: payload.audioBlob,
              background: payload.backgroundBlob,
              video: payload.videoBlob
            }).catch(() => {});
          }
        } catch (apiErr) {
          console.warn('[Editor] MySQL sync warning:', apiErr);
        }
      }

      setIsDirty(false);
      setValidation(null);
      setValidationSource(null);
      return true;
    } catch (err) {
      setValidation({ valid: false, errors: [`Lỗi lưu beatmap: ${err.message}`], warnings: [] });
      setValidationSource('save');
      return false;
    }
  }, [runValidation]);

  /**
   * Lưu nháp: vẫn lưu dù còn lỗi, để không mất dữ liệu đang làm.
   */
  const handleSaveDraft = useCallback(async () => {
    const { payload } = runValidation('draft');
    try {
      await dbManager.saveBeatmap(payload);
      setIsDirty(false);
      return true;
    } catch (err) {
      setValidation({ valid: false, errors: [`Lỗi lưu nháp: ${err.message}`], warnings: [] });
      setValidationSource('draft');
      return false;
    }
  }, [runValidation]);

  /**
   * Test Play: chặn nếu có lỗi nghiêm trọng.
   */
  const handleTestPlay = useCallback(() => {
    const { payload, result } = runValidation('test');
    if (!result.valid) return false;
    if (onTestPlay) onTestPlay({ ...payload, audioSource: audioUrl });
    return true;
  }, [runValidation, onTestPlay, audioUrl]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([serializeBeatmapExport(beatmap)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilename(beatmap);
    a.click();
    URL.revokeObjectURL(url);
  }, [beatmap]);

  const dismissValidation = useCallback(() => {
    setValidation(null);
    setValidationSource(null);
  }, []);

  return {
    // state
    beatmap,
    activeTab,
    editorOrientation,
    audioUrl,
    songDuration,
    currentTime,
    isPlaying,
    playbackSpeed,
    snapDivisor,
    zoom,
    activeTool,
    holdDuration,
    metronomeEnabled,
    showRayGuides,
    showWaveform,
    showGrid,
    isDirty,
    timelineScroll,
    viewportSize,
    selectedIndices,
    clipboard,
    history,
    redoStack,
    isDraggingNote,
    validation,
    validationSource,

    // setters
    setBeatmap,
    setActiveTab,
    setEditorOrientation,
    setSnapDivisor,
    setZoom,
    setActiveTool,
    setHoldDuration,
    setMetronomeEnabled,
    setShowRayGuides,
    setShowWaveform,
    setShowGrid,
    markDirty,

    // refs
    canvasRef,
    audioRef,
    timelineRef,
    overviewCanvasRef,
    overviewProgressRef,
    overviewThumbRef,
    playheadLineRef,
    playheadBadgeRef,
    timeDisplayRef,

    // derived
    bpm,
    beatLength,
    meter,
    snapMs,
    maxNoteTime,
    totalDurationMs,
    timeScale,
    totalPixels,
    visibleGridLines,
    visibleNotes,

    // actions
    handleUndo,
    handleRedo,
    handleFlipHorizontal,
    handleFlipVertical,
    handleCycleSnap,
    handleTogglePlay,
    handleSeek,
    handleAudioLoadedMetadata,
    handleAudioEnded,
    handleSpeedChange,
    handleUploadAudio,
    handleSelectAll,
    handleDeleteSelected,
    handleDeleteSingleNote,
    handleCopy,
    handleCut,
    handlePaste,
    handleAddNote,
    handleCanvasClick,
    handleNoteMouseDown,
    handleHoldResizeMouseDown,
    handleTimelineWheel,
    handleOverviewMouseDown,
    handleTimelineScroll,
    handleSaveToDatabase,
    handleSaveDraft,
    handleTestPlay,
    handleExportJSON,
    dismissValidation
  };
}

export { snapTime };
