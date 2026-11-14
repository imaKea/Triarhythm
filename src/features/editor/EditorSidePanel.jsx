import React from 'react';
import { TOOL_OPTIONS, SNAP_OPTIONS } from './editorConstants.js';

export default function EditorSidePanel({ editor }) {
  const {
    activeTool, setActiveTool, snapDivisor, setSnapDivisor, zoom, setZoom,
    bpm, snapMs, beatmap, selectedIndices, handleDeleteSelected
  } = editor;

  return (
    <div className="w-64 bg-[#16213e] border-r border-white/10 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 font-sans select-none text-white custom-scrollbar">
      {/* Note Tool Selector */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
          Note Tool
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOOL_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTool === t.id
                  ? `${t.col} text-white border-white shadow-lg`
                  : 'bg-[#2a2a3e] text-slate-300 border-white/10 hover:bg-[#3a3a4e]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Snap Divisor Picker */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex justify-between items-center">
          <span>Beat Snap Divisor</span>
          <span className="text-indigo-400 font-bold">1/{snapDivisor}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SNAP_OPTIONS.map((item) => (
            <button
              key={item.div}
              onClick={() => setSnapDivisor(item.div)}
              style={{
                borderColor: snapDivisor === item.div ? item.color : 'rgba(255, 255, 255, 0.1)',
                backgroundColor: snapDivisor === item.div ? item.color : '#2a2a3e',
                color: snapDivisor === item.div ? (item.div === 1 || item.div === 8 ? '#000' : '#fff') : '#cbd5e1'
              }}
              className="py-1.5 px-1 rounded-lg text-xs font-bold cursor-pointer border transition-all flex items-center justify-center gap-1 hover:scale-105"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-400 mt-2 flex justify-between font-mono">
          <span>BPM: <strong>{bpm}</strong></span>
          <span>1/{snapDivisor} = <strong>{Math.round(snapMs)}ms</strong></span>
        </div>
      </div>

      {/* Timeline Zoom */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex justify-between">
          <span>Timeline Zoom</span>
          <span className="text-indigo-400 font-bold">{zoom.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer h-2 bg-[#2a2a3e] rounded-lg"
        />
      </div>

      {/* Note Inspector */}
      {selectedIndices.size > 0 && (
        <div className="p-3.5 rounded-xl bg-[#2a2a3e] border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-xs text-amber-300">
              {selectedIndices.size === 1
                ? `NOTE #${Array.from(selectedIndices)[0]}`
                : `SELECTED ${selectedIndices.size} NOTES`}
            </span>
            <button
              onClick={handleDeleteSelected}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
            >
              Delete (Del)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
