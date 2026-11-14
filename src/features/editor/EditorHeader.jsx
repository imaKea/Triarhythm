import React from 'react';
import { formatTime } from './editorModel.js';

export default function EditorHeader({ editor, onClose }) {
  const {
    beatmap, bpm, snapDivisor, snapMs, isPlaying, playbackSpeed, audioUrl,
    currentTime, history, timeDisplayRef,
    handleTogglePlay, handleSpeedChange, handleUploadAudio, handleUndo,
    handleSaveToDatabase, handleSaveDraft, handleTestPlay, handleExportJSON
  } = editor;

  const onExit = () => {
    if (editor.audioRef.current) editor.audioRef.current.pause();
    onClose();
  };

  const onSave = async () => {
    const ok = await handleSaveToDatabase();
    if (ok) alert('Saved beatmap successfully to Database!');
    else alert('Validation error: please check errors panel before saving.');
  };

  const onDraft = async () => {
    const ok = await handleSaveDraft();
    alert(ok ? 'Draft saved!' : 'Failed to save draft.');
  };

  return (
    <div className="h-14 bg-[#16213e] border-b border-white/10 px-5 flex items-center justify-between shrink-0 font-sans select-none">
      <div className="flex items-center gap-4">
        <button
          onClick={onExit}
          className="px-3.5 py-1.5 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-200 font-bold text-xs border border-white/10 cursor-pointer transition-colors"
        >
          ← Exit
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">
              Beatmap Editor
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold">
              {beatmap.metadata?.title || 'Untitled'} [{beatmap.metadata?.difficultyName || 'Normal'}]
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {beatmap.notes.length} notes • BPM {bpm} • 1/{snapDivisor} beat ({Math.round(snapMs)}ms)
          </span>
        </div>
      </div>

      {/* Center: Playback Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTogglePlay}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
            isPlaying
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
              : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 shadow-md'
          }`}
        >
          <span>{isPlaying ? '⏸' : '▶'}</span>
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* Speed selectors */}
        <div className="flex items-center bg-[#2a2a3e] rounded-xl p-0.5 border border-white/10">
          {[0.5, 0.75, 1.0].map((s) => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                playbackSpeed === s ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <span
          ref={timeDisplayRef}
          className="font-mono text-xs font-bold text-white bg-[#2a2a3e] px-3 py-1.5 rounded-xl border border-white/10"
        >
          {formatTime(currentTime)}
        </span>

        <label className="px-3 py-1.5 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-200 text-xs font-semibold border border-white/10 cursor-pointer flex items-center gap-1 transition-colors">
          <span>🎵</span>
          <span>{audioUrl ? 'Change Audio' : 'Upload Audio'}</span>
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
          onClick={handleUndo}
          disabled={history.length === 0}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
            history.length > 0
              ? 'bg-[#2a2a3e] hover:bg-[#3a3a4e] text-indigo-300 border-white/10'
              : 'bg-[#1a1a2e] text-slate-600 border-white/5 cursor-not-allowed'
          }`}
          title="Undo (Ctrl + Z)"
        >
          <span>↩</span>
          <span>Undo</span>
        </button>

        <button
          onClick={onSave}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 text-xs font-bold cursor-pointer transition-colors"
          title="Save to MySQL & IndexedDB"
        >
          💾 Save
        </button>

        <button
          onClick={onDraft}
          className="px-3 py-1.5 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 border border-white/10 text-xs font-semibold cursor-pointer"
        >
          Draft
        </button>

        <button
          onClick={handleTestPlay}
          className="px-4 py-1.5 rounded-xl rt-btn-primary text-xs font-bold cursor-pointer shadow-md"
        >
          🎮 Test Play
        </button>

        <button
          onClick={handleExportJSON}
          className="px-3 py-1.5 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 text-xs border border-white/10 cursor-pointer"
        >
          Export
        </button>
      </div>
    </div>
  );
}
