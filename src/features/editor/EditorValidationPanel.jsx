import React from 'react';

/**
 * Bảng kết quả validateBeatmap: lỗi chặn lưu, cảnh báo chỉ nhắc nhở.
 */
export default function EditorValidationPanel({ validation, source, onClose }) {
  if (!validation) return null;

  const { valid, errors = [], warnings = [] } = validation;
  const sourceLabel = {
    save: 'Lưu chính thức',
    draft: 'Lưu nháp',
    test: 'Test Play'
  }[source] || 'Kiểm tra';

  return (
    <div className="absolute bottom-4 right-4 z-[60] w-[420px] max-h-[55vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden bg-[#0b0f18]/98 border-[#2b354a]">
      <div className={`px-4 py-2 flex items-center justify-between border-b ${
        valid ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-red-500/15 border-red-500/40'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{valid ? '✅' : '⛔'}</span>
          <div className="flex flex-col">
            <span className={`font-sans font-bold text-sm ${valid ? 'text-emerald-300' : 'text-red-300'}`}>
              {valid ? 'Beatmap hợp lệ' : `Không thể ${sourceLabel.toLowerCase()}`}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {sourceLabel} • {errors.length} lỗi • {warnings.length} cảnh báo
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-mono cursor-pointer"
        >
          Đóng
        </button>
      </div>

      <div className="p-3 overflow-y-auto space-y-2 font-mono text-[11px]">
        {errors.length > 0 && (
          <div>
            <div className="text-red-400 font-bold uppercase tracking-wider mb-1">Lỗi (chặn lưu)</div>
            <ul className="space-y-1">
              {errors.map((err, i) => (
                <li key={`err_${i}`} className="flex gap-2 text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                  <span className="text-red-400 shrink-0">✕</span>
                  <span>{err}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <div className="text-amber-400 font-bold uppercase tracking-wider mb-1">Cảnh báo (vẫn lưu được)</div>
            <ul className="space-y-1">
              {warnings.map((warn, i) => (
                <li key={`warn_${i}`} className="flex gap-2 text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
                  <span className="text-amber-400 shrink-0">!</span>
                  <span>{warn}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {valid && errors.length === 0 && warnings.length === 0 && (
          <div className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5">
            Không phát hiện vấn đề nào. Bạn có thể lưu hoặc Test Play.
          </div>
        )}
      </div>
    </div>
  );
}
