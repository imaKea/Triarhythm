import React from 'react';
import { playHover, playClick } from './sound/uiAudio.js';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'ghost' | 'danger' | 'secondary'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = null,
  disabled = false,
  glow = true,
  onClick,
  className = '',
  type = 'button',
  ...props
}) {
  const sizeClasses = {
    sm: 'min-h-[44px] sm:min-h-0 px-3.5 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-xs gap-1.5',
    md: 'min-h-[44px] sm:min-h-0 px-4 sm:px-6 py-2.5 sm:py-2.5 text-sm sm:text-sm gap-2',
    lg: 'min-h-[48px] sm:min-h-0 px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base gap-2.5'
  }[size] || 'min-h-[44px] sm:min-h-0 px-4 sm:px-6 py-2.5 sm:py-2.5 text-sm sm:text-sm gap-2';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white font-extrabold border border-white/40 shadow-[0_4px_18px_rgba(255,77,128,0.25)] hover:shadow-[0_6px_28px_rgba(255,133,162,0.5)] hover:scale-[1.03] active:scale-[0.97]',
    ghost:
      'bg-white/80 hover:bg-[#fff0f4] text-[#5b2a47] hover:text-[#ff4d80] font-extrabold border border-[#f3dbe4] hover:border-[#ff85a2] shadow-[0_2px_8px_rgba(126,47,79,0.04)] active:scale-[0.98]',
    secondary:
      'bg-[#fff1f5] hover:bg-[#ffe5ec] text-[#e94267] font-extrabold border border-[#f3dbe4] hover:border-[#ff85a2] shadow-[0_2px_8px_rgba(126,47,79,0.04)] active:scale-[0.98]',
    danger:
      'bg-[#ffeef2] hover:bg-[#ffd9e2] text-[#e94267] font-extrabold border border-[#f5b8c7] active:scale-[0.98]'
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
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-200 select-none tracking-wide ${sizeClasses} ${variantClasses} ${disabledClasses} ${className}`}
      {...props}
    >
      {icon && <span className="inline-flex items-center">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
