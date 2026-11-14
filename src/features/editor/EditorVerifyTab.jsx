import React, { useMemo } from 'react';
import { validateBeatmap } from '../../core/beatmap/validator.js';
import { calculateStars } from '../../core/pp/ppCalculator.js';
import { formatTime } from './editorModel.js';
import { playClick } from '../../ui/index.js';

export default function EditorVerifyTab({ editor }) {
  const { beatmap, setBeatmap, handleSeek, songDuration } = editor;

  // 1. Live Validation
  const validationResult = useMemo(() => {
    try {
      return validateBeatmap(beatmap);
    } catch (err) {
      return { valid: false, errors: [err.message], warnings: [] };
    }
  }, [beatmap]);

  // 2. Live Statistics
  const stats = useMemo(() => {
    const notes = beatmap.notes || [];
    let tap = 0;
    let hold = 0;
    let breakCount = 0;
    let ring = 0;
    let slide = 0;
    let typing = 0;

    for (const n of notes) {
      if (n.type === 'tap') tap++;
      else if (n.type === 'hold') hold++;
      else if (n.type === 'break') breakCount++;
      else if (n.type === 'ring') ring++;
      else if (n.type === 'slide') slide++;
      else if (n.type === 'typing') typing++;
    }

    let stars = 0;
    try {
      stars = calculateStars(beatmap);
    } catch (_) {
      stars = 0;
    }

    const durationSec = Math.max(1, (songDuration || 180000) / 1000);
    const nps = (notes.length / durationSec).toFixed(2);

    return {
      total: notes.length,
      tap,
      hold,
      breakCount,
      ring,
      slide,
      typing,
      stars,
      nps
    };
  }, [beatmap, songDuration]);

  // Sắp xếp lại nốt theo thời gian
  const handleSortNotes = () => {
    playClick();
    editor.markDirty();
    setBeatmap((prev) => ({
      ...prev,
      notes: [...(prev.notes || [])].sort((a, b) => a.time - b.time)
    }));
  };

  // Dọn dẹp nốt trùng lane tại cùng thời điểm
  const handleRemoveDuplicates = () => {
    playClick();
    editor.markDirty();
    setBeatmap((prev) => {
      const seen = new Set();
      const clean = [];
      for (const n of prev.notes || []) {
        const key = `${Math.round(n.time)}_${n.type}_${n.lane ?? 'ring'}`;
        if (!seen.has(key)) {
          seen.add(key);
          clean.push(n);
        }
      }
      return { ...prev, notes: clean };
    });
  };

  // Trích xuất timestamp từ chuỗi thông báo lỗi (nếu có ms)
  const extractTimeFromMessage = (msg) => {
    const match = msg.match(/(\d+)\s*ms/);
    return match ? parseInt(match[1]) : null;
  };

  return (
    <div className="flex-1 bg-[#0d0d1a] overflow-y-auto p-8 flex justify-center custom-scrollbar font-sans select-none text-white animate-fadeIn">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-xl font-torus font-black tracking-wide text-white flex items-center gap-2">
              <span className="text-[#ff66ab]">🛡</span> Kiểm tra & Thống kê Beatmap (Verify)
            </h2>
            <p className="text-xs text-[#8890a4] mt-1">
              Phát hiện lỗi logic phách, nốt chồng chéo và theo dõi độ khó Star Rating trực tiếp.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-black font-mono border ${
                validationResult.valid
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}
            >
              {validationResult.valid ? '✓ BEATMAP HỢP LỆ' : '⚠ CẦN KHẮC PHỤC'}
            </span>
          </div>
        </div>

        {/* 1. Live Statistics Panel */}
        <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
            <span>📊</span> Thống kê chi tiết & Độ khó
          </h3>

          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col">
              <span className="text-[10px] text-[#8890a4] uppercase font-bold">Star Rating</span>
              <span className="text-2xl font-torus font-black text-[#ffdd57] mt-1">
                ⭐ {stats.stars}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col">
              <span className="text-[10px] text-[#8890a4] uppercase font-bold">Tổng số nốt</span>
              <span className="text-2xl font-torus font-black text-white mt-1">
                {stats.total}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col">
              <span className="text-[10px] text-[#8890a4] uppercase font-bold">Mật độ nốt (NPS)</span>
              <span className="text-2xl font-torus font-black text-[#4fc3f7] mt-1">
                {stats.nps}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col">
              <span className="text-[10px] text-[#8890a4] uppercase font-bold">Độ dài bản đồ</span>
              <span className="text-2xl font-torus font-black text-[#66bb6a] mt-1">
                {formatTime(songDuration)}
              </span>
            </div>
          </div>

          {/* Breakdown notes */}
          <div className="grid grid-cols-6 gap-2 text-center text-xs mt-1">
            <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300">
              <div className="text-[9px] font-bold">TAP</div>
              <div className="text-sm font-black font-mono">{stats.tap}</div>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <div className="text-[9px] font-bold">HOLD</div>
              <div className="text-sm font-black font-mono">{stats.hold}</div>
            </div>
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
              <div className="text-[9px] font-bold">BREAK</div>
              <div className="text-sm font-black font-mono">{stats.breakCount}</div>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <div className="text-[9px] font-bold">RING</div>
              <div className="text-sm font-black font-mono">{stats.ring}</div>
            </div>
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300">
              <div className="text-[9px] font-bold">SLIDE</div>
              <div className="text-sm font-black font-mono">{stats.slide}</div>
            </div>
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300">
              <div className="text-[9px] font-bold">TYPING</div>
              <div className="text-sm font-black font-mono">{stats.typing}</div>
            </div>
          </div>
        </div>

        {/* 2. Quick Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSortNotes}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1] text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Sắp xếp lại nốt theo thời gian</span>
          </button>

          <button
            onClick={handleRemoveDuplicates}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1] text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
          >
            <span>🧹</span>
            <span>Loại bỏ nốt trùng lane cùng thời điểm</span>
          </button>
        </div>

        {/* 3. Validation Issues List */}
        <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
            <span>📋</span> Danh sách Cảnh báo & Lỗi phát hiện ({validationResult.errors.length + validationResult.warnings.length})
          </h3>

          {validationResult.errors.length === 0 && validationResult.warnings.length === 0 ? (
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center flex flex-col items-center gap-2">
              <span className="text-3xl">✓</span>
              <p className="font-bold text-sm">Tuyệt vời! Không phát hiện bất kỳ lỗi hoặc cảnh báo nào.</p>
              <span className="text-xs text-emerald-400/80">Beatmap đã sẵn sàng để lưu và chơi thử!</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* Errors */}
              {validationResult.errors.map((err, idx) => {
                const time = extractTimeFromMessage(err);
                return (
                  <div
                    key={`err_${idx}`}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-500/30 text-red-400 font-bold flex items-center justify-center text-[10px]">
                        ✕
                      </span>
                      <span className="text-red-200 font-medium">{err}</span>
                    </div>

                    {time !== null && (
                      <button
                        onClick={() => {
                          playClick();
                          handleSeek(time);
                        }}
                        className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 font-mono text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Nhảy tới {formatTime(time)}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Warnings */}
              {validationResult.warnings.map((warn, idx) => {
                const time = extractTimeFromMessage(warn);
                return (
                  <div
                    key={`warn_${idx}`}
                    className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/30 text-yellow-400 font-bold flex items-center justify-center text-[10px]">
                        ⚠
                      </span>
                      <span className="text-yellow-200 font-medium">{warn}</span>
                    </div>

                    {time !== null && (
                      <button
                        onClick={() => {
                          playClick();
                          handleSeek(time);
                        }}
                        className="px-2.5 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 font-mono text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Nhảy tới {formatTime(time)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
