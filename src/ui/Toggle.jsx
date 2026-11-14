import React from 'react';
import { playClick } from './sound/uiAudio.js';

export default function Toggle({
  checked = false,
  onChange,
  label = '',
  description = '',
  disabled = false,
  className = '',
  id,
  ...props
}) {
  const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

  const handleToggle = () => {
    if (disabled) return;
    playClick();
    if (onChange) onChange(!checked);
  };

  return (
    <div
      onClick={handleToggle}
      className={`flex items-center justify-between gap-4 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer group'
      } ${className}`}
      {...props}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-bold text-[#5b2a47] group-hover:text-[#ff4d80] transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[#a8556f]">{description}</span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className={`relative w-12 h-6.5 rounded-full transition-colors duration-200 border ${
          checked
            ? 'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] border-[#ff85a2] shadow-[0_2px_12px_rgba(255,77,128,0.35)]'
            : 'bg-[#ffe5ec] border-[#f3dbe4] group-hover:border-[#ff85a2]'
        }`}
      >
        {/* Thumb */}
        <div
          className={`absolute top-[2px] w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-md ${
            checked
              ? 'translate-x-[24px] shadow-[0_2px_8px_rgba(255,77,128,0.3)]'
              : 'translate-x-[2px]'
          }`}
        />
      </div>
    </div>
  );
}
