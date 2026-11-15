import React, { useState, useRef, memo } from 'react';
import { playTick } from './sound/uiAudio.js';

const Slider = memo(function Slider({
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
          {label && <span className="font-bold text-[#5b2a47]">{label}</span>}
          <span className="font-mono font-bold text-[#ff4d80] px-2 py-0.5 rounded bg-[#fff0f4] border border-[#f3dbe4]">
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
        <div className="absolute left-0 right-0 h-2 rounded-full bg-[#ffe5ec] border border-[#f3dbe4] overflow-hidden">
          {/* Fill bar */}
          <div
            className="h-full bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] shadow-[0_2px_8px_rgba(255,77,128,0.25)] transition-all duration-75"
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

        {/* Bubble Thumb - perfectly centered with translateX(-50%) */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#ff4d80] shadow-[0_2px_8px_rgba(255,77,128,0.4)] pointer-events-none transition-transform duration-100 ${
            isHovered ? 'scale-110' : 'scale-100'
          }`}
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
});

export default Slider;
