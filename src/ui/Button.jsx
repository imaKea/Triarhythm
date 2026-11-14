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
    sm: 'px-4 py-1.5 text-xs gap-1.5',
    md: 'px-6 py-2.5 text-sm gap-2',
    lg: 'px-8 py-3.5 text-base gap-2.5'
  }[size] || 'px-6 py-2.5 text-sm gap-2';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white font-extrabold border border-white/30 shadow-[0_4px_18px_rgba(255,133,162,0.35)] hover:shadow-[0_6px_28px_rgba(255,133,162,0.6)] hover:scale-[1.03] active:scale-[0.97]',
    ghost:
      'bg-white/[0.06] hover:bg-white/[0.14] text-[#fff5f8] hover:text-white font-bold border border-white/[0.1] hover:border-[#ff85a2]/40 active:scale-[0.98]',
    secondary:
      'bg-[#ffd6e0]/15 hover:bg-[#ffd6e0]/30 text-[#ffaec9] hover:text-white font-bold border border-[#ffaec9]/40 hover:border-[#ffaec9]/80 active:scale-[0.98]',
    danger:
      'bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-white font-bold border border-rose-500/30 hover:border-rose-500/60 active:scale-[0.98]'
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
