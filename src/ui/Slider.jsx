import React, { useState, useRef } from 'react';
import { playTick } from './sound/uiAudio.js';

export default function Slider({
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label = '',
  unit = '',
  formatValue,
  disabled = false,
  className = '',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);
  const lastTickVal = useRef(value);

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const displayVal = formatValue ? formatValue(value) : `${value}${unit ? ` ${unit}` : ''}`;

  const handleChange = (e) => {
    if (disabled) return;
    const newVal = parseFloat(e.target.value);
    if (Math.abs(newVal - lastTickVal.current) >= step) {
      playTick();
      lastTickVal.current = newVal;
    }
    if (onChange) onChange(newVal);
  };

  return (
    <div className={`flex flex-col gap-1.5 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`} {...props}>
      {(label || displayVal) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-bold text-[#b8c0d4]">{label}</span>}
          <span className="font-mono font-bold text-[#ff66ab] px-2 py-0.5 rounded bg-[#ff66ab]/10 border border-[#ff66ab]/20">
            {displayVal}
          </span>
        </div>
      )}

      <div
        className="relative flex items-center h-6 cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Track background */}
        <div className="absolute left-0 right-0 h-2 rounded-full bg-[#111122] border border-white/[0.08] overflow-hidden">
          {/* Fill bar */}
          <div
            className="h-full bg-gradient-to-r from-[#cc5289] to-[#ff66ab] shadow-[0_0_10px_rgba(255,102,171,0.5)] transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Hidden native input for accessible drag/touch */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
        />

        {/* Bubble Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-white border-2 border-[#ff66ab] shadow-[0_0_10px_rgba(255,102,171,0.8)] pointer-events-none transition-transform duration-100 ${
            isHovered ? 'scale-125' : 'scale-100'
          }`}
          style={{ left: `calc(${percentage}% - 9px)` }}
        />
      </div>
    </div>
  );
}
