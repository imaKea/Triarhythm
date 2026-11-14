import React from 'react';
import { formatTime } from './editorModel.js';
import { toast, playClick } from '../../ui/index.js';

export default function EditorHeader({ editor, onClose }) {
  const {
    beatmap, bpm, snapDivisor, snapMs, isPlaying, playbackSpeed, audioUrl,
    currentTime, history, timeDisplayRef,
    handleTogglePlay, handleSpeedChange, handleUploadAudio, handleUndo,
    handleSaveToDatabase, handleSaveDraft, handleTestPlay, handleExportJSON
  } = editor;

  const onExit = () => {
    playClick();
    if (editor.audioRef.current) editor.audioRef.current.pause();
    onClose();
  };

  const onSave = async () => {
    playClick();
    const ok = await handleSaveToDatabase();
    if (ok) toast.success('Đã lưu beatmap thành công vào Database!');
    else toast.error('Lỗi kiểm tra beatmap: vui lòng kiểm tra panel cảnh báo trước khi lưu.');
  };

  const onDraft = async () => {
    playClick();
    const ok = await handleSaveDraft();
    if (ok) toast.info('Đã lưu bản nháp (Draft)!');
    else toast.error('Không thể lưu bản nháp.');
  };

  const onExport = () => {
    playClick();
    handleExportJSON();
    toast.success('Đã xuất file beatmap JSON!');
  };

  const onTest = () => {
    playClick();
    handleTestPlay();
  };

  return (
    <header className="h-14 bg-[#111122]/95 border-b border-white/[0.08] px-5 flex items-center justify-between shrink-0 font-sans select-none backdrop-blur-md z-30 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      {/* Left: Exit + Title + Metadata */}
      <div className="flex items-center gap-4">
        <button
          onClick={onExit}
          className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white font-bold text-xs border border-white/[0.08] cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <span>←</span>
          <span>Thoát</span>
        </button>

        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-2">
            <span className="font-torus font-black text-sm text-white tracking-wide">
              Beatmap Editor
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#ff66ab]/20 text-[#ff66ab] border border-[#ff66ab]/40 font-bold">
              {beatmap.metadata?.title || 'Untitled'} [{beatmap.metadata?.difficultyName || 'Normal'}]
            </span>
          </div>
          <span className="text-[11px] text-[#7c849c] font-mono mt-1">
            {beatmap.notes?.length || 0} notes • BPM {bpm} • 1/{snapDivisor} beat ({Math.round(snapMs)}ms)
          </span>
        </div>
      </div>

      {/* Center: Playback Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            playClick();
            handleTogglePlay();
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
            isPlaying
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white border-transparent hover:brightness-110 shadow-[0_0_12px_rgba(255,102,171,0.4)]'
          }`}
          title="Play / Pause (Phím Space)"
        >
          <span>{isPlaying ? '⏸' : '▶'}</span>
          <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
        </button>

        {/* Speed selectors */}
        <div className="flex items-center bg-[#1a1a2e] rounded-full p-0.5 border border-white/[0.08]">
          {[0.5, 0.75, 1.0].map((s) => (
            <button
              key={s}
              onClick={() => {
                playClick();
                handleSpeedChange(s);
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                playbackSpeed === s
                  ? 'bg-[#ff66ab] text-white shadow-sm'
                  : 'text-[#8890a4] hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Current Time Display */}
        <span
          ref={timeDisplayRef}
          className="font-mono text-xs font-bold text-white bg-[#1a1a2e] px-3.5 py-1.5 rounded-full border border-white/[0.08]"
        >
          {formatTime(currentTime)}
        </span>

        {/* Audio upload */}
        <label className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white text-xs font-bold border border-white/[0.08] cursor-pointer flex items-center gap-1.5 transition-colors">
          <span>🎵</span>
          <span>{audioUrl ? 'Đổi nhạc' : 'Tải file nhạc'}</span>
          <input
            type="file"
            accept="audio/*,.mp3,.ogg,.wav"
            onChange={handleUploadAudio}
            className="hidden"
          />
        </label>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            playClick();
            handleUndo();
          }}
          disabled={history.length === 0}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${
            history.length > 0
              ? 'bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white border-white/[0.08] cursor-pointer'
              : 'bg-white/[0.02] text-[#555a6d] border-transparent cursor-not-allowed'
          }`}
          title="Hoàn tác (Ctrl + Z)"
        >
          <span>↩</span>
          <span>Undo</span>
        </button>

        <button
          onClick={onSave}
          className="px-3.5 py-1.5 rounded-full bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer transition-colors"
          title="Lưu vào MySQL & IndexedDB (Ctrl + S)"
        >
          💾 Lưu map
        </button>

        <button
          onClick={onDraft}
          className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer transition-colors"
          title="Lưu bản nháp"
        >
          Bản nháp
        </button>

        <button
          onClick={onTest}
          className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white text-xs font-bold cursor-pointer shadow-[0_0_12px_rgba(255,102,171,0.4)] hover:brightness-110 transition-all flex items-center gap-1.5"
          title="Chơi thử map (F5 - Đếm ngược 3-2-1)"
        >
          <span>🎮</span>
          <span>Test Play</span>
        </button>

        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white text-xs border border-white/[0.08] cursor-pointer transition-colors"
          title="Xuất file JSON"
        >
          Export
        </button>
      </div>
    </header>
  );
}
