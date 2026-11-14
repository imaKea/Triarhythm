import React, { useState } from 'react';

export default function Tooltip({
  content,
  children,
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  delay = 200,
  className = '',
  ...props
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  if (!content) return children;

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
    bottom: 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
    left: 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2',
    right: 'left-[calc(100%+6px)] top-1/2 -translate-y-1/2'
  }[position] || 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2';

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}

      {isVisible && (
        <div
          className={`absolute z-50 pointer-events-none px-2.5 py-1 rounded-lg bg-[#111122]/95 border border-white/[0.12] text-[11px] font-semibold text-white shadow-xl backdrop-blur-md whitespace-nowrap animate-fadeIn ${positionClasses}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
