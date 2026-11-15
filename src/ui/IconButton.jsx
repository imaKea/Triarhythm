import React from 'react';
import { playHover, playClick } from './sound/uiAudio.js';

export default function IconButton({
  icon,
  size = 'md', // 'sm' | 'md' | 'lg'
  variant = 'ghost', // 'ghost' | 'primary' | 'danger'
  disabled = false,
  onClick,
  title = '',
  className = '',
  type = 'button',
  ...props
}) {
  const sizeClasses = {
    sm: 'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-7 sm:h-7 text-xs',
    md: 'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-9 sm:h-9 text-sm',
    lg: 'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-11 sm:h-11 text-base'
  }[size] || 'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-9 sm:h-9 text-sm';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] text-white shadow-[0_2px_12px_rgba(255,77,128,0.25)] hover:shadow-[0_4px_18px_rgba(255,133,162,0.5)] hover:scale-105 active:scale-95',
    ghost:
      'bg-white/80 hover:bg-[#fff0f4] text-[#5b2a47] hover:text-[#ff4d80] border border-[#f3dbe4] hover:border-[#ff85a2] hover:scale-105 active:scale-95 shadow-[0_2px_8px_rgba(126,47,79,0.04)]',
    danger:
      'bg-[#ffeef2] hover:bg-[#ffd9e2] text-[#e94267] border border-[#f5b8c7] hover:scale-105 active:scale-95'
  }[variant] || '';

  const disabledClasses = disabled
    ? 'opacity-40 cursor-not-allowed hover:scale-100 hover:shadow-none'
    : 'cursor-pointer';

  const handleClick = (e) => {
    if (disabled) return;
    playClick();
    if (onClick) onClick(e);
  };

  const handleMouseEnter = () => {
    if (!disabled) playHover();
  };

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-200 select-none ${sizeClasses} ${variantClasses} ${disabledClasses} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
