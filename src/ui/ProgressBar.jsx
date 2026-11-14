import React from 'react';

export default function ProgressBar({
  value = 0,
  max = 100,
  showLabel = false,
  height = 'h-2',
  color = 'pink', // 'pink' | 'purple' | 'green' | 'blue'
  className = '',
  ...props
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  const colorGradients = {
    pink: 'from-[#cc5289] to-[#ff66ab] shadow-[0_0_10px_rgba(255,102,171,0.5)]',
    purple: 'from-[#4834d4] to-[#6c5ce7] shadow-[0_0_10px_rgba(108,92,231,0.5)]',
    green: 'from-[#43a047] to-[#66bb6a] shadow-[0_0_10px_rgba(102,187,106,0.5)]',
    blue: 'from-[#1e88e5] to-[#4fc3f7] shadow-[0_0_10px_rgba(79,195,247,0.5)]'
  }[color] || 'from-[#cc5289] to-[#ff66ab]';

  return (
    <div className={`flex flex-col gap-1 w-full select-none ${className}`} {...props}>
      {showLabel && (
        <div className="flex justify-between text-[11px] font-mono text-[#b8c0d4]">
          <span>Progress</span>
          <span>{percent.toFixed(1)}%</span>
        </div>
      )}
      <div className={`w-full ${height} bg-[#111122] rounded-full border border-white/[0.08] overflow-hidden`}>
        <div
          className={`h-full bg-gradient-to-r ${colorGradients} transition-all duration-150 rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
