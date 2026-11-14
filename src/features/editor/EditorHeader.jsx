import React, { useState } from 'react';
import { formatTime } from './editorModel.js';
import { SNAP_OPTIONS } from './editorConstants.js';
import { toast, playClick } from '../../ui/index.js';

export default function EditorHeader({ editor, onClose }) {
  const {
    beatmap, bpm, snapDivisor, snapMs, isPlaying, playbackSpeed,
    currentTime, history, redoStack, timeDisplayRef, isDirty,
    activeTab, setActiveTab, metronomeEnabled, setMetronomeEnabled,
    showRayGuides, setShowRayGuides, showWaveform, setShowWaveform, showGrid, setShowGrid,
    handleTogglePlay, handleSpeedChange, handleUndo, handleRedo,
    handleSelectAll, handleCopy, handleCut, handlePaste,
    handleFlipHorizontal, handleFlipVertical, handleCycleSnap,
    handleSaveToDatabase, handleSaveDraft, handleTestPlay, handleExportJSON
  } = editor;

  // Dropdown menus state
  const [openMenu, setOpenMenu] = useState(null); // 'file' | 'edit' | 'view' | null

  const toggleMenu = (menu) => {
    playClick();
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const closeMenu = () => setOpenMenu(null);

  const onExit = () => {
    playClick();
    if (editor.audioRef.current) editor.audioRef.current.pause();
    if (isDirty) {
      if (!window.confirm('Bạn có thay đổi chưa lưu trong beatmap. Bạn có chắc muốn thoát?')) {
        return;
      }
    }
    onClose();
  };

  const onSave = async () => {
    playClick();
    closeMenu();
    const ok = await handleSaveToDatabase();
    if (ok) toast.success('Đã lưu beatmap thành công vào Database!');
    else toast.error('Lỗi kiểm tra beatmap: vui lòng kiểm tra tab Verify trước khi lưu.');
  };

  const onDraft = async () => {
    playClick();
    closeMenu();
    const ok = await handleSaveDraft();
    if (ok) toast.info('Đã lưu bản nháp (Draft)!');
    else toast.error('Không thể lưu bản nháp.');
  };

  const onExport = () => {
    playClick();
    closeMenu();
    handleExportJSON();
    toast.success('Đã xuất file beatmap JSON!');
  };

  const onTest = () => {
    playClick();
    handleTestPlay();
  };

  const currentSnapItem = SNAP_OPTIONS.find((s) => s.div === snapDivisor) || SNAP_OPTIONS[3];

  return (
    <header className="h-14 bg-[#111122]/95 border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0 font-sans select-none backdrop-blur-md z-30 shadow-[0_4px_20px_rgba(0,0,0,0.4)] relative">
      {/* LEFT: Exit + Title + Menus */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExit}
          className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white font-bold text-xs border border-white/[0.08] cursor-pointer transition-colors flex items-center gap-1.5"
          title="Thoát khỏi Editor"
        >
          <span>←</span>
          <span>Thoát</span>
        </button>

        {/* Dropdown menus: File, Edit, View */}
        <div className="flex items-center gap-1 relative">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('file')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                openMenu === 'file' ? 'bg-[#ff66ab] text-white' : 'text-[#b8c0d4] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              File
            </button>
            {openMenu === 'file' && (
              <div
                className="absolute left-0 top-full mt-1.5 w-48 rounded-xl bg-[#181828] border border-white/[0.1] shadow-2xl p-1.5 flex flex-col gap-0.5 z-50 text-xs animate-fadeIn"
                onMouseLeave={closeMenu}
              >
                <button
                  onClick={onSave}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-[#ff66ab]/20 hover:text-[#ff66ab] font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>💾 Lưu map</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+S</span>
                </button>
                <button
                  onClick={onDraft}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>📝 Lưu nháp</span>
                </button>
                <button
                  onClick={onExport}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>📤 Xuất file JSON</span>
                </button>
                <div className="h-px bg-white/[0.08] my-1" />
                <button
                  onClick={onExit}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-red-500/20 text-red-400 font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>✕ Thoát</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Esc</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('edit')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                openMenu === 'edit' ? 'bg-[#ff66ab] text-white' : 'text-[#b8c0d4] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              Edit
            </button>
            {openMenu === 'edit' && (
              <div
                className="absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-[#181828] border border-white/[0.1] shadow-2xl p-1.5 flex flex-col gap-0.5 z-50 text-xs animate-fadeIn"
                onMouseLeave={closeMenu}
              >
                <button
                  onClick={() => { closeMenu(); handleUndo(); }}
                  disabled={history.length === 0}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] disabled:opacity-40 text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>↩ Hoàn tác</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+Z</span>
                </button>
                <button
                  onClick={() => { closeMenu(); handleRedo(); }}
                  disabled={redoStack.length === 0}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] disabled:opacity-40 text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>↪ Làm lại</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+Y</span>
                </button>
                <div className="h-px bg-white/[0.08] my-1" />
                <button
                  onClick={() => { closeMenu(); handleCut(); }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>✂ Cắt</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+X</span>
                </button>
                <button
                  onClick={() => { closeMenu(); handleCopy(); }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>📋 Sao chép</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+C</span>
                </button>
                <button
                  onClick={() => { closeMenu(); handlePaste(); }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>📥 Dán</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+V</span>
                </button>
                <button
                  onClick={() => { closeMenu(); handleSelectAll(); }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>☑ Chọn tất cả</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+A</span>
                </button>
                <div className="h-px bg-white/[0.08] my-1" />
                <button
                  onClick={() => { closeMenu(); handleFlipHorizontal(); toast.info('Đã lật đối xứng ngang!'); }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>↔ Lật đối xứng ngang</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+H</span>
                </button>
                <button
                  onClick={() => { closeMenu(); handleFlipVertical(); toast.info('Đã lật đối xứng dọc!'); }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>↕ Lật đối xứng dọc</span>
                  <span className="text-[10px] text-[#7c849c] font-mono">Ctrl+J</span>
                </button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('view')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                openMenu === 'view' ? 'bg-[#ff66ab] text-white' : 'text-[#b8c0d4] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              View
            </button>
            {openMenu === 'view' && (
              <div
                className="absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-[#181828] border border-white/[0.1] shadow-2xl p-1.5 flex flex-col gap-0.5 z-50 text-xs animate-fadeIn"
                onMouseLeave={closeMenu}
              >
                <button
                  onClick={() => setShowRayGuides((v) => !v)}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Tia dẫn hướng</span>
                  <span>{showRayGuides ? '✓' : ''}</span>
                </button>
                <button
                  onClick={() => setShowWaveform((v) => !v)}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Sóng âm Waveform</span>
                  <span>{showWaveform ? '✓' : ''}</span>
                </button>
                <button
                  onClick={() => setShowGrid((v) => !v)}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-white/[0.06] text-[#b8c0d4] hover:text-white font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Lưới Beat Grid</span>
                  <span>{showGrid ? '✓' : ''}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title & Dirty indicator */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
          <span className="font-torus font-black text-xs text-white tracking-wide">
            {beatmap.metadata?.title || 'Untitled'}
          </span>
          {isDirty ? (
            <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Chưa lưu
            </span>
          ) : (
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
              ✓ Đã lưu
            </span>
          )}
        </div>
      </div>

      {/* CENTER: 4 osu!(lazer) Tabs */}
      <div className="flex items-center bg-[#18182c] rounded-full p-1 border border-white/[0.08]">
        {[
          { id: 'setup', label: 'SETUP', icon: '⚙' },
          { id: 'compose', label: 'COMPOSE', icon: '🎵' },
          { id: 'timing', label: 'TIMING', icon: '⏱' },
          { id: 'verify', label: 'VERIFY', icon: '🛡' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playClick();
                setActiveTab(tab.id);
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-torus font-black tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_0_12px_rgba(255,102,171,0.4)]'
                  : 'text-[#8890a4] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* RIGHT: Playhead, Snap, Metronome & Test Play */}
      <div className="flex items-center gap-2.5">
        {/* Play / Pause Button */}
        <button
          onClick={() => {
            playClick();
            handleTogglePlay();
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
            isPlaying
              ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 hover:bg-amber-500/35'
              : 'bg-white/[0.08] hover:bg-white/[0.15] text-white border-white/[0.12]'
          }`}
          title="Play / Pause (Phím Space)"
        >
          <span>{isPlaying ? '⏸' : '▶'}</span>
          <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
        </button>

        {/* Speed selectors */}
        <div className="flex items-center bg-[#1a1a2e] rounded-full p-0.5 border border-white/[0.08]">
          {[0.25, 0.5, 0.75, 1.0].map((s) => (
            <button
              key={s}
              onClick={() => {
                playClick();
                handleSpeedChange(s);
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                playbackSpeed === s
                  ? 'bg-[#ff66ab] text-white shadow-sm'
                  : 'text-[#8890a4] hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Current Time Display mm:ss.ms */}
        <span
          ref={timeDisplayRef}
          className="font-mono text-xs font-bold text-white bg-[#1a1a2e] px-3 py-1 rounded-full border border-white/[0.08]"
        >
          {formatTime(currentTime)}
        </span>

        {/* Beat Snap Divisor Stepper (◀ 1/X ▶) */}
        <div className="flex items-center bg-[#1a1a2e] rounded-full px-1.5 py-0.5 border border-white/[0.08] gap-1">
          <button
            onClick={() => {
              playClick();
              handleCycleSnap(-1);
            }}
            className="w-5 h-5 rounded-full hover:bg-white/[0.1] text-xs text-[#8890a4] hover:text-white flex items-center justify-center cursor-pointer"
            title="Giảm snap divisor (Phím ,)"
          >
            ◀
          </button>

          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1"
            style={{
              backgroundColor: currentSnapItem.color,
              color: currentSnapItem.div === 1 || currentSnapItem.div === 8 ? '#000' : '#fff'
            }}
            title={`Beat Snap: 1/${snapDivisor} beat (${Math.round(snapMs)}ms)`}
          >
            1/{snapDivisor}
          </span>

          <button
            onClick={() => {
              playClick();
              handleCycleSnap(1);
            }}
            className="w-5 h-5 rounded-full hover:bg-white/[0.1] text-xs text-[#8890a4] hover:text-white flex items-center justify-center cursor-pointer"
            title="Tăng snap divisor (Phím .)"
          >
            ▶
          </button>
        </div>

        {/* Metronome Toggle Button */}
        <button
          onClick={() => {
            playClick();
            setMetronomeEnabled((v) => !v);
          }}
          className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs transition-colors cursor-pointer ${
            metronomeEnabled
              ? 'bg-amber-500/30 text-amber-300 border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
              : 'bg-white/[0.04] text-[#8890a4] border-white/[0.08] hover:text-white'
          }`}
          title={`Metronome nhịp: ${metronomeEnabled ? 'Đang BẬT' : 'Đang TẮT'}`}
        >
          🔔
        </button>

        {/* Test Play (Ctrl+T / F5) */}
        <button
          onClick={onTest}
          className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white text-xs font-bold cursor-pointer shadow-[0_0_12px_rgba(255,102,171,0.4)] hover:brightness-110 transition-all flex items-center gap-1.5"
          title="Chơi thử map từ vị trí hiện tại (F5 / Ctrl+T)"
        >
          <span>🎮</span>
          <span>Test</span>
        </button>
      </div>
    </header>
  );
}
