import React from 'react';
import { useMapEditor } from '../features/editor/useMapEditor.js';
import { formatTime } from '../features/editor/editorModel.js';
import EditorHeader from '../features/editor/EditorHeader.jsx';
import EditorSidePanel from '../features/editor/EditorSidePanel.jsx';
import EditorPreview from '../features/editor/EditorPreview.jsx';
import EditorTimeline from '../features/editor/EditorTimeline.jsx';
import EditorSetupTab from '../features/editor/EditorSetupTab.jsx';
import EditorTimingTab from '../features/editor/EditorTimingTab.jsx';
import EditorVerifyTab from '../features/editor/EditorVerifyTab.jsx';
import EditorValidationPanel from '../features/editor/EditorValidationPanel.jsx';

/**
 * MapEditor - Giao diện Trình biên tập Beatmap chuẩn osu!(lazer).
 * Bao gồm 4 tab chính: SETUP · COMPOSE · TIMING · VERIFY.
 */
export default function MapEditor({ initialBeatmap = null, onClose, onTestPlay }) {
  const editor = useMapEditor({ initialBeatmap, onTestPlay });
  const {
    activeTab, audioRef, audioUrl, overviewCanvasRef, overviewProgressRef,
    overviewThumbRef, currentTime, totalDurationMs
  } = editor;

  return (
    <div className="fixed inset-0 z-50 bg-[#090914] text-white flex flex-col font-sans select-none overflow-hidden animate-fadeIn">
      {/* Audio element ẩn để đồng bộ nhịp */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        preload="auto"
        onLoadedMetadata={editor.handleAudioLoadedMetadata}
        onEnded={editor.handleAudioEnded}
      />

      {/* osu!(lazer) Navigation Header */}
      <EditorHeader editor={editor} onClose={onClose} />

      {/* SONG OVERVIEW SCRUBBER (Hiển thị ở tab Compose và Timing) */}
      {(activeTab === 'compose' || activeTab === 'timing') && (
        <div
          onMouseDown={editor.handleOverviewMouseDown}
          className="h-6 bg-[#0d0d1a] border-b border-white/[0.08] px-4 flex items-center relative cursor-pointer select-none group shrink-0"
          title="Nhấp hoặc kéo chuột để tua nhanh âm thanh"
        >
          <div className="w-full h-2 rounded-full relative overflow-hidden bg-white/[0.06] border border-white/[0.08]">
            <canvas
              ref={overviewCanvasRef}
              width={1200}
              height={8}
              className="w-full h-full block pointer-events-none"
            />
            <div
              ref={overviewProgressRef}
              style={{ width: `${Math.min(100, (currentTime / totalDurationMs) * 100)}%` }}
              className="h-full bg-gradient-to-r from-[#ff66ab]/30 to-[#ff66ab]/60 absolute top-0 left-0 pointer-events-none"
            />
          </div>

          <div
            ref={overviewThumbRef}
            style={{ left: `${Math.min(100, (currentTime / totalDurationMs) * 100)}%` }}
            className="absolute w-3 h-3 bg-[#ff66ab] rounded-full border-2 border-white shadow-[0_0_10px_rgba(255,102,171,0.8)] -translate-x-1/2 pointer-events-none group-hover:scale-125 transition-transform"
          />

          <div className="absolute left-6 text-[9px] font-mono text-[#ff80bf] font-bold pointer-events-none drop-shadow">
            {formatTime(currentTime)}
          </div>
          <div className="absolute right-6 text-[9px] font-mono text-[#8890a4] font-bold pointer-events-none drop-shadow">
            {formatTime(totalDurationMs)}
          </div>
        </div>
      )}

      {/* TAB CONTENT ROUTER */}
      <div className="flex-1 flex overflow-hidden">
        {/* TAB 1: COMPOSE (Sân chơi + Toolbox + Timeline) */}
        {activeTab === 'compose' && (
          <>
            <EditorSidePanel editor={editor} />
            <EditorPreview editor={editor} />
            <EditorTimeline editor={editor} />
          </>
        )}

        {/* TAB 2: SETUP (Metadata + Assets + Ruleset) */}
        {activeTab === 'setup' && (
          <EditorSetupTab editor={editor} />
        )}

        {/* TAB 3: TIMING (Tap BPM + Offset + Timing Points) */}
        {activeTab === 'timing' && (
          <EditorTimingTab editor={editor} />
        )}

        {/* TAB 4: VERIFY (Live Statistics + Star Rating + Validator) */}
        {activeTab === 'verify' && (
          <EditorVerifyTab editor={editor} />
        )}
      </div>

      {/* Floating Validation Modal (nếu bấm lưu hoặc test mà có lỗi) */}
      <EditorValidationPanel
        validation={editor.validation}
        source={editor.validationSource}
        onClose={editor.dismissValidation}
      />
    </div>
  );
}
