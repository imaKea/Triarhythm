import React, { memo } from 'react';
import { playClick } from './sound/uiAudio.js';

const Toggle = memo(function Toggle({
  checked = false,
  onChange,
  label = '',
  description = '',
  disabled = false,
  className = '',
  id,
  ...props
}) {
  const handleToggle = () => {
    if (disabled) return;
    playClick();
    if (onChange) onChange(!checked);
  };

  // Track dimensions (px): width 48, height 26
  // Thumb: 20x20 circle, starts at 4px, ends at 48-20-4 = 24px
  const thumbOffset = checked ? 'translate-x-[26px]' : 'translate-x-[4px]';

  return (
    <div
      onClick={handleToggle}
      className={`flex items-center justify-between gap-3 select-none min-w-[70px] ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'
      } ${className}`}
      {...props}
    >
      {(label || description) && (
        <div className="flex flex-col min-w-0">
          {label && (
            <span className="text-sm font-bold text-[#5b2a47] group-hover:text-[#ff4d80] transition-colors truncate">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[#a8556f] truncate">{description}</span>
          )}
        </div>
      )}

      {/* Track container - fixed size to prevent shrinking */}
      <div className="flex-shrink-0 w-12 h-7 relative">
        {/* Track background */}
        <div
          className={`absolute inset-0 rounded-full border transition-all duration-200 ${
            checked
              ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] border-[#ff4d80] shadow-[0_2px_8px_rgba(255,77,128,0.3)]'
              : 'bg-[#fff0f4] border-[#e2b8c8] group-hover:border-[#ff85a2]'
          }`}
        />
        {/* Thumb - white circle with shadow */}
        <div
          className={`absolute left-[4px] top-[3px] w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${thumbOffset}`}
        />
      </div>
    </div>
  );
});

export default Toggle;
