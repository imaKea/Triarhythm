import React, { useState, useRef, useEffect } from 'react';
import { playHover, playClick, playSelect } from './sound/uiAudio.js';

export default function Dropdown({
  options = [], // [{ value, label, icon }]
  value,
  onChange,
  placeholder = 'Select option...',
  label = '',
  disabled = false,
  className = '',
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOpt = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    playClick();
    setIsOpen(!isOpen);
  };

  const handleSelect = (val) => {
    playSelect();
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 select-none ${className}`} {...props}>
      {label && <label className="text-xs font-bold text-[#b8c0d4]">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onMouseEnter={() => !disabled && playHover()}
        className={`w-full h-10 px-4 rounded-xl bg-[#1a1a2e]/90 hover:bg-[#222238] border border-white/[0.08] hover:border-[#ff66ab]/40 transition-all flex items-center justify-between text-sm ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
        } ${isOpen ? 'border-[#ff66ab] shadow-[0_0_12px_rgba(255,102,171,0.25)]' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOpt?.icon && <span>{selectedOpt.icon}</span>}
          <span className={selectedOpt ? 'text-white font-medium' : 'text-[#7c849c]'}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
        </div>
        <span
          className={`text-xs text-[#7c849c] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#ff66ab]' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* Menu Options */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 p-1.5 rounded-xl bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.6)] animate-slideDown max-h-60 overflow-y-auto custom-scrollbar">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => playHover()}
                className={`px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#ff66ab]/20 text-[#ff66ab] font-bold'
                    : 'text-[#b8c0d4] hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && <span>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </div>
                {isSelected && <span className="text-[#ff66ab] text-xs">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
