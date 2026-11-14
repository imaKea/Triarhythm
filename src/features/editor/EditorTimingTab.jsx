import React, { useState, useRef } from 'react';
import { formatTime } from './editorModel.js';
import { playClick } from '../../ui/index.js';

export default function EditorTimingTab({ editor }) {
  const {
    beatmap, setBeatmap, currentTime, handleSeek,
    metronomeEnabled, setMetronomeEnabled, bpm
  } = editor;

  // Tap BPM internal state
  const [tapTimes, setTapTimes] = useState([]);
  const [computedBpm, setComputedBpm] = useState(null);

  const handleTap = () => {
    playClick();
    const now = performance.now();
    setTapTimes((prev) => {
      const filtered = prev.filter((t) => now - t < 3000);
      const next = [...filtered, now];
      if (next.length >= 2) {
        let totalDiff = 0;
        for (let i = 1; i < next.length; i++) {
          totalDiff += next[i] - next[i - 1];
        }
        const avgDiff = totalDiff / (next.length - 1);
        if (avgDiff > 0) {
          const calculated = Math.round((60000 / avgDiff) * 10) / 10;
          setComputedBpm(calculated);
        }
      }
      return next;
    });
  };

  const handleApplyTapBpm = () => {
    if (!computedBpm) return;
    playClick();
    editor.markDirty();
    setBeatmap((prev) => {
      const timingPoints = Array.isArray(prev.timingPoints) && prev.timingPoints.length > 0
        ? [...prev.timingPoints]
        : [{ time: 0, bpm: 120, beatLength: 500, meter: 4, uninherited: true }];

      timingPoints[0] = {
        ...timingPoints[0],
        bpm: computedBpm,
        beatLength: 60000 / computedBpm
      };
      return { ...prev, timingPoints };
    });
  };

  const handleSetOffsetAtCursor = () => {
    playClick();
    editor.markDirty();
    setBeatmap((prev) => {
      const timingPoints = Array.isArray(prev.timingPoints) && prev.timingPoints.length > 0
        ? [...prev.timingPoints]
        : [{ time: 0, bpm: 120, beatLength: 500, meter: 4, uninherited: true }];

      timingPoints[0] = {
        ...timingPoints[0],
        time: Math.round(currentTime)
      };
      return { ...prev, timingPoints };
    });
  };

  const handleAddTimingPoint = () => {
    playClick();
    editor.markDirty();
    setBeatmap((prev) => {
      const list = [...(prev.timingPoints || [])];
      list.push({
        time: Math.round(currentTime),
        bpm: bpm || 120,
        beatLength: 60000 / (bpm || 120),
        meter: 4,
        uninherited: true
      });
      list.sort((a, b) => a.time - b.time);
      return { ...prev, timingPoints: list };
    });
  };

  const handleDeleteTimingPoint = (idx) => {
    if ((beatmap.timingPoints || []).length <= 1) {
      alert('Beatmap cần có ít nhất 1 Timing Point gốc!');
      return;
    }
    playClick();
    editor.markDirty();
    setBeatmap((prev) => {
      const list = prev.timingPoints.filter((_, i) => i !== idx);
      return { ...prev, timingPoints: list };
    });
  };

  const handleUpdateTimingPoint = (idx, field, value) => {
    editor.markDirty();
    setBeatmap((prev) => {
      const list = [...prev.timingPoints];
      const updated = { ...list[idx], [field]: value };
      if (field === 'bpm' && Number(value) > 0) {
        updated.beatLength = 60000 / Number(value);
      }
      list[idx] = updated;
      return { ...prev, timingPoints: list };
    });
  };

  const timingPoints = beatmap.timingPoints || [];

  return (
    <div className="flex-1 bg-[#0d0d1a] overflow-y-auto p-8 flex justify-center custom-scrollbar font-sans select-none text-white animate-fadeIn">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-xl font-torus font-black tracking-wide text-white flex items-center gap-2">
              <span className="text-[#ff66ab]">⏱</span> Thiết lập Nhịp độ & Phách (Timing)
            </h2>
            <p className="text-xs text-[#8890a4] mt-1">
              Đo BPM chính xác bằng Tap BPM, căn chỉnh Offset và quản lý các điểm đổi nhịp.
            </p>
          </div>

          {/* Metronome Toggle */}
          <button
            onClick={() => {
              playClick();
              setMetronomeEnabled((prev) => !prev);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
              metronomeEnabled
                ? 'bg-amber-500/25 text-amber-300 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-white/[0.06] text-[#8890a4] border-white/[0.08] hover:bg-white/[0.12] hover:text-white'
            }`}
          >
            <span>🔔</span>
            <span>Metronome: {metronomeEnabled ? 'BẬT' : 'TẮT'}</span>
          </button>
        </div>

        {/* 1. Tap BPM & Quick Offset */}
        <div className="grid grid-cols-2 gap-6">
          {/* Tap BPM Card */}
          <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col items-center text-center gap-4">
            <h3 className="text-xs font-bold text-[#ffdd57] uppercase tracking-wider font-mono">
              CÔNG CỤ ĐO NHỊP (TAP BPM)
            </h3>
            <p className="text-[11px] text-[#8890a4]">
              Nhấn nút theo nhịp điệu của bài hát (khoảng 4-8 lần) để tính BPM tự động.
            </p>

            <button
              onClick={handleTap}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-[#ff66ab] to-[#cc5289] text-white font-torus font-black text-2xl shadow-[0_0_25px_rgba(255,102,171,0.5)] active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer"
            >
              <span>TAP!</span>
              <span className="text-[10px] font-sans font-normal opacity-80 mt-1">
                {tapTimes.length} lần nhấn
              </span>
            </button>

            {computedBpm && (
              <div className="flex flex-col items-center gap-2 animate-fadeIn">
                <span className="text-sm font-mono text-[#66bb6a] font-bold">
                  BPM đo được: <strong>{computedBpm}</strong>
                </span>
                <button
                  onClick={handleApplyTapBpm}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  Áp dụng BPM này
                </button>
              </div>
            )}
          </div>

          {/* Quick Offset Alignment Card */}
          <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-[#4fc3f7] uppercase tracking-wider font-mono mb-2">
                CĂN CHỈNH VỊ TRÍ OFFSET (FIRST BEAT)
              </h3>
              <p className="text-[11px] text-[#8890a4] leading-relaxed">
                Tua âm thanh đến tiếng trống/nốt đầu tiên của bài hát, sau đó bấm nút bên dưới để gán mốc thời gian bắt đầu bài.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-[#8890a4]">Vị trí con trỏ hiện tại:</span>
              <span className="font-mono font-bold text-sm text-[#ff66ab]">
                {formatTime(currentTime)} ({Math.round(currentTime)}ms)
              </span>
            </div>

            <button
              onClick={handleSetOffsetAtCursor}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#4fc3f7] to-[#0288d1] text-black font-bold text-xs shadow-[0_0_15px_rgba(79,195,247,0.4)] hover:brightness-110 transition-all cursor-pointer"
            >
              Đặt Offset tại vị trí này ({Math.round(currentTime)}ms)
            </button>
          </div>
        </div>

        {/* 2. Timing Points Table */}
        <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <span>📋</span> Danh sách Timing Points ({timingPoints.length})
            </h3>
            <button
              onClick={handleAddTimingPoint}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white text-xs font-bold shadow-sm hover:brightness-110 transition-all cursor-pointer"
            >
              + Thêm Timing Point tại con trỏ
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-[#8890a4] font-mono">
                  <th className="py-2 px-3">Thời gian (Offset)</th>
                  <th className="py-2 px-3">BPM</th>
                  <th className="py-2 px-3">Meter (Nhịp)</th>
                  <th className="py-2 px-3">Độ dài phách (ms)</th>
                  <th className="py-2 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {timingPoints.map((tp, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-mono">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={Math.round(tp.time)}
                          onChange={(e) => handleUpdateTimingPoint(idx, 'time', parseInt(e.target.value) || 0)}
                          className="w-20 bg-[#1a1a2e] border border-white/[0.1] rounded px-2 py-0.5 text-white outline-none"
                        />
                        <button
                          onClick={() => handleSeek(tp.time)}
                          className="text-[10px] text-[#4fc3f7] hover:underline cursor-pointer"
                          title="Nhảy tới thời điểm này"
                        >
                          Tua tới
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <input
                        type="number"
                        step="0.1"
                        value={tp.bpm}
                        onChange={(e) => handleUpdateTimingPoint(idx, 'bpm', parseFloat(e.target.value) || 120)}
                        className="w-20 bg-[#1a1a2e] border border-white/[0.1] rounded px-2 py-0.5 text-white outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <select
                        value={tp.meter || 4}
                        onChange={(e) => handleUpdateTimingPoint(idx, 'meter', parseInt(e.target.value) || 4)}
                        className="bg-[#1a1a2e] border border-white/[0.1] rounded px-2 py-0.5 text-white outline-none cursor-pointer"
                      >
                        <option value={4}>4/4</option>
                        <option value={3}>3/4</option>
                        <option value={6}>6/8</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#8890a4]">
                      {Math.round(tp.beatLength || (60000 / tp.bpm))} ms
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteTimingPoint(idx)}
                        className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
