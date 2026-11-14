import React from 'react';
import { TOOL_OPTIONS, SNAP_OPTIONS, LANES_DEF } from './editorConstants.js';
import { playClick } from '../../ui/index.js';

export default function EditorSidePanel({ editor }) {
  const {
    activeTool, setActiveTool, snapDivisor, setSnapDivisor, zoom, setZoom,
    bpm, snapMs, beatmap, setBeatmap, selectedIndices, handleDeleteSelected
  } = editor;

  // Selected note helper
  const selectedList = Array.from(selectedIndices).map((idx) => beatmap.notes[idx]).filter(Boolean);
  const singleNote = selectedList.length === 1 ? selectedList[0] : null;
  const singleIndex = selectedList.length === 1 ? Array.from(selectedIndices)[0] : null;

  const handleUpdateSingleNote = (field, value) => {
    if (singleIndex === null) return;
    setBeatmap((prev) => {
      const nextNotes = [...prev.notes];
      nextNotes[singleIndex] = {
        ...nextNotes[singleIndex],
        [field]: value
      };
      return { ...prev, notes: nextNotes };
    });
  };

  return (
    <div className="w-72 bg-[#111122]/90 border-r border-white/[0.08] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 font-sans select-none text-white custom-scrollbar backdrop-blur-md">
      {/* 1. Note Tool Selector */}
      <div>
        <div className="text-[11px] font-bold text-[#8890a4] uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Công cụ (Note Tools)</span>
          <span className="text-[10px] text-[#ff66ab] font-mono">Phím 1-7</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {TOOL_OPTIONS.map((t) => {
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  playClick();
                  setActiveTool(t.id);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? `${t.col} text-white border-white shadow-[0_0_12px_rgba(255,102,171,0.3)]`
                    : 'bg-white/[0.04] text-[#8890a4] border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </div>
                <span className="text-[10px] opacity-60 font-mono">[{t.key}]</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Beat Snap Divisor Picker */}
      <div>
        <div className="text-[11px] font-bold text-[#8890a4] uppercase tracking-wider mb-2 flex justify-between items-center">
          <span>Beat Snap Divisor</span>
          <span className="text-[#ff66ab] font-mono font-bold">1/{snapDivisor}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SNAP_OPTIONS.map((item) => (
            <button
              key={item.div}
              onClick={() => {
                playClick();
                setSnapDivisor(item.div);
              }}
              style={{
                borderColor: snapDivisor === item.div ? item.color : 'rgba(255, 255, 255, 0.08)',
                backgroundColor: snapDivisor === item.div ? item.color : 'rgba(255, 255, 255, 0.04)',
                color: snapDivisor === item.div ? (item.div === 1 || item.div === 8 ? '#000' : '#fff') : '#8890a4'
              }}
              className="py-1.5 px-1 rounded-lg text-xs font-bold cursor-pointer border transition-all flex items-center justify-center gap-1 hover:scale-105"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-[#7c849c] mt-2 flex justify-between font-mono bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
          <span>BPM: <strong className="text-white">{bpm}</strong></span>
          <span>1/{snapDivisor} = <strong className="text-[#ff66ab]">{Math.round(snapMs)}ms</strong></span>
        </div>
      </div>

      {/* 3. Timeline Zoom */}
      <div>
        <div className="text-[11px] font-bold text-[#8890a4] uppercase tracking-wider mb-1.5 flex justify-between">
          <span>Timeline Zoom</span>
          <span className="text-[#ff66ab] font-mono font-bold">{zoom.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-full accent-[#ff66ab] cursor-pointer h-1.5 bg-[#1a1a2e] rounded-lg"
        />
      </div>

      {/* 4. Note Inspector Panel */}
      {selectedIndices.size > 0 && (
        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-2.5 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
            <span className="font-bold text-xs text-[#ffdd57] uppercase font-mono">
              {singleNote ? `NOTE #${singleIndex} [${singleNote.type.toUpperCase()}]` : `ĐÃ CHỌN ${selectedIndices.size} NOTES`}
            </span>
            <button
              onClick={() => {
                playClick();
                handleDeleteSelected();
              }}
              className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] font-bold transition-colors cursor-pointer"
              title="Xóa nốt đã chọn (Phím Delete)"
            >
              ✕ Xóa (Del)
            </button>
          </div>

          {singleNote && (
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8890a4]">Thời gian (ms):</span>
                <input
                  type="number"
                  value={Math.round(singleNote.time)}
                  onChange={(e) => handleUpdateSingleNote('time', parseInt(e.target.value) || 0)}
                  className="w-24 bg-[#1a1a2e] border border-white/[0.08] rounded px-2 py-0.5 text-right font-mono text-white outline-none"
                />
              </div>

              {singleNote.type !== 'ring' && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8890a4]">Lane đích:</span>
                  <select
                    value={singleNote.lane ?? 0}
                    onChange={(e) => handleUpdateSingleNote('lane', parseInt(e.target.value))}
                    className="w-28 bg-[#1a1a2e] border border-white/[0.08] rounded px-2 py-0.5 font-mono text-xs text-white outline-none cursor-pointer"
                  >
                    {LANES_DEF.filter((l) => l.id !== 'ring').map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Hold Duration */}
              {singleNote.type === 'hold' && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8890a4]">Kết thúc (ms):</span>
                  <input
                    type="number"
                    value={Math.round(singleNote.endTime || singleNote.time + 1000)}
                    onChange={(e) => handleUpdateSingleNote('endTime', parseInt(e.target.value) || singleNote.time + 500)}
                    className="w-24 bg-[#1a1a2e] border border-white/[0.08] rounded px-2 py-0.5 text-right font-mono text-white outline-none"
                  />
                </div>
              )}

              {/* Slide End Lane */}
              {singleNote.type === 'slide' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8890a4]">Lane kết thúc:</span>
                    <select
                      value={singleNote.endLane ?? 1}
                      onChange={(e) => handleUpdateSingleNote('endLane', parseInt(e.target.value))}
                      className="w-28 bg-[#1a1a2e] border border-white/[0.08] rounded px-2 py-0.5 font-mono text-xs text-white outline-none cursor-pointer"
                    >
                      {LANES_DEF.filter((l) => l.id !== 'ring').map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8890a4]">Kết thúc (ms):</span>
                    <input
                      type="number"
                      value={Math.round(singleNote.endTime || singleNote.time + 1000)}
                      onChange={(e) => handleUpdateSingleNote('endTime', parseInt(e.target.value) || singleNote.time + 500)}
                      className="w-24 bg-[#1a1a2e] border border-white/[0.08] rounded px-2 py-0.5 text-right font-mono text-white outline-none"
                    />
                  </div>
                </>
              )}

              {/* Typing Text */}
              {singleNote.type === 'typing' && (
                <div className="flex flex-col gap-1">
                  <span className="text-[#8890a4]">Từ khóa typing:</span>
                  <input
                    type="text"
                    value={singleNote.text || ''}
                    onChange={(e) => handleUpdateSingleNote('text', e.target.value.toUpperCase())}
                    className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded px-2.5 py-1 font-mono text-xs text-white outline-none"
                    placeholder="TRIARHYTHM..."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
