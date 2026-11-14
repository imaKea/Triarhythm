import React from 'react';
import { LANES_DEF } from './editorConstants.js';

/**
 * Cột phải: timeline dọc (vertical roll) với grid ảo hoá, playhead và note.
 */
export default function EditorTimeline({ editor }) {
  const {
    timelineRef, playheadLineRef, playheadBadgeRef,
    currentTime, timeScale, totalPixels, visibleGridLines, visibleNotes,
    selectedIndices, snapMs, handleTimelineScroll, handleTimelineWheel,
    handleSeek, handleAddNote, handleNoteMouseDown, handleDeleteSingleNote,
    handleHoldResizeMouseDown
  } = editor;

  return (
    <div className="flex-1 bg-[#0d0d1a] flex flex-col overflow-hidden relative">
      {/* Header các cột Lane */}
      <div className="h-8 bg-[#111122]/95 border-b border-white/[0.08] flex items-center px-2 text-[10px] font-mono font-bold shrink-0">
        <div className="w-9 text-slate-400 text-center">TIME</div>
        <div className="flex-1 grid grid-cols-10 h-full">
          {LANES_DEF.map((l) => (
            <div
              key={l.id}
              className={`border-r border-white/10 flex items-center justify-center text-center ${l.col}`}
              title={l.label}
            >
              {l.short}
            </div>
          ))}
        </div>
      </div>

      {/* Khung cuộn Timeline dọc (Vertical Roll) */}
      <div
        ref={timelineRef}
        onScroll={handleTimelineScroll}
        onWheel={handleTimelineWheel}
        className="flex-1 overflow-y-auto overflow-x-hidden relative select-none"
        style={{ contain: 'strict' }}
      >
        <div
          style={{ height: `${totalPixels + 600}px` }}
          className="relative w-full"
          onClick={(e) => {
            const rect = timelineRef.current.getBoundingClientRect();
            const clickY = e.clientY - rect.top + timelineRef.current.scrollTop;
            const time = Math.max(0, clickY / timeScale);

            if (e.altKey || e.button === 1) {
              handleSeek(Math.round(time / snapMs) * snapMs);
              return;
            }

            const clickX = e.clientX - rect.left - 36;
            const colWidth = Math.max(34, (rect.width - 36) / 10);
            const laneIdx = Math.max(0, Math.min(9, Math.floor(clickX / colWidth)));
            const laneId = laneIdx === 9 ? 'ring' : laneIdx;
            handleAddNote(laneId, time);
          }}
        >
          {/* Cột thước thời gian bên trái */}
          <div className="absolute top-0 bottom-0 left-0 w-9 bg-[#0b0e17] border-r border-[#1e2538] z-10 pointer-events-none">
            {visibleGridLines.filter((l) => l.isMeasure).map((l) => (
              <div
                key={`ruler_${l.key}`}
                style={{ top: `${l.pos}px` }}
                className="absolute left-0 right-0 -translate-y-1/2 text-[9px] font-mono font-bold text-white/70 text-center bg-slate-900/80 border-y border-white/20"
              >
                {l.label}
              </div>
            ))}
          </div>

          {/* 10 đường cột Lane phân cách dọc */}
          <div className="absolute top-0 bottom-0 left-9 right-0 grid grid-cols-10 pointer-events-none z-0">
            {LANES_DEF.map((l, idx) => (
              <div
                key={`col_${l.id}`}
                className={`border-r border-[#141b2b] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}`}
              />
            ))}
          </div>

          {/* Vạch Beat Grid ngang */}
          <div className="absolute top-0 bottom-0 left-9 right-0 pointer-events-none z-0">
            {visibleGridLines.map((line) => (
              <div
                key={line.key}
                style={{
                  top: `${line.pos}px`,
                  height: `${line.width}px`,
                  backgroundColor: line.color,
                  opacity: line.opacity
                }}
                className="absolute left-0 right-0"
              />
            ))}
          </div>

          {/* Playhead đỏ */}
          <div
            ref={playheadLineRef}
            style={{ top: `${currentTime * timeScale}px` }}
            className="absolute left-0 right-0 h-0.5 bg-red-500 z-30 pointer-events-none shadow-[0_0_10px_#ef4444]"
          >
            <div className="w-2.5 h-2.5 bg-red-500 rotate-45 -ml-1 -top-1 absolute shadow-[0_0_8px_#ef4444]" />
          </div>

          <div
            ref={playheadBadgeRef}
            style={{ top: `${currentTime * timeScale}px` }}
            className="absolute left-0 -translate-y-1/2 z-40 bg-red-600 text-white font-mono font-bold text-[8px] px-1 py-0.2 rounded shadow pointer-events-none"
          >
            {(currentTime / 1000).toFixed(2)}s
          </div>

          {/* Render các nốt ảo hóa (Virtualization) */}
          <div className="absolute top-0 bottom-0 left-9 right-0 z-20 pointer-events-none">
            {visibleNotes.map(({ note, index }) => {
              const isRing = note.type === 'ring';
              const laneIndex = isRing ? 9 : (note.lane ?? 0);
              const topPix = note.time * timeScale;
              const isSelected = selectedIndices.has(index);

              let bgColor = 'bg-[#ff2a70] text-white';
              if (note.type === 'break') bgColor = 'bg-[#ff3d00] text-white';
              if (note.type === 'hold') bgColor = 'bg-[#ff9100] text-white';
              if (note.type === 'ring') bgColor = 'bg-[#00e5ff] text-black font-black';
              if (note.type === 'slide') bgColor = 'bg-[#ffe600] text-black font-black';
              if (note.type === 'typing') bgColor = 'bg-[#a855f7] text-white font-black';

              const holdHeight = note.endTime ? (note.endTime - note.time) * timeScale : 0;

              return (
                <div
                  key={`note_${index}`}
                  style={{
                    top: `${topPix}px`,
                    left: `${(laneIndex / 10) * 100}%`,
                    width: `${100 / 10}%`
                  }}
                  className="absolute -translate-y-1/2 p-0.5 pointer-events-auto cursor-move select-none"
                  onMouseDown={(e) => handleNoteMouseDown(e, index, note)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteSingleNote(index);
                  }}
                >
                  {/* Hold Body */}
                  {(note.type === 'hold' || (note.type === 'ring' && note.isHold)) && holdHeight > 0 && (
                    <div
                      style={{ height: `${holdHeight}px` }}
                      className={`absolute top-1/2 left-1.5 right-1.5 rounded-b border-x border-b ${
                        isRing
                          ? 'bg-cyan-500/30 border-cyan-400/80'
                          : 'bg-amber-500/40 border-amber-400/80'
                      }`}
                    >
                      <div
                        onMouseDown={(e) => handleHoldResizeMouseDown(e, index, note)}
                        className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize rounded-b flex items-center justify-center text-[7px] text-black font-bold ${
                          isRing ? 'bg-cyan-400 hover:bg-cyan-300' : 'bg-amber-400 hover:bg-yellow-300'
                        }`}
                      >
                        =
                      </div>
                    </div>
                  )}

                  {/* Note Head */}
                  <div
                    className={`h-5 rounded-lg flex items-center justify-center font-mono text-[9px] font-bold shadow-md transition-transform hover:scale-105 ${bgColor} ${
                      isSelected ? 'ring-2 ring-yellow-400 shadow-[0_0_10px_#facc15]' : ''
                    }`}
                  >
                    {isRing ? 'R' : note.lane}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
