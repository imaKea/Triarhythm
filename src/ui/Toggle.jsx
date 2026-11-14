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
            <span className="text-sm font-bold text-white group-hover:text-[#ff66ab] transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[#7c849c]">{description}</span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className={`relative w-12 h-6.5 rounded-full transition-colors duration-200 border ${
          checked
            ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] border-[#ff66ab]/40 shadow-[0_0_12px_rgba(255,102,171,0.35)]'
            : 'bg-[#111122] border-white/[0.1] group-hover:border-white/[0.2]'
        }`}
      >
        {/* Thumb */}
        <div
          className={`absolute top-[2px] w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-md ${
            checked
              ? 'translate-x-[24px] shadow-[0_0_8px_rgba(255,255,255,0.8)]'
              : 'translate-x-[2px] bg-slate-300'
          }`}
        />
      </div>
    </div>
  );
}
