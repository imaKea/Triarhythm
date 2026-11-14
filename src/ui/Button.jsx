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
      'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white font-bold border-none shadow-[0_4px_16px_rgba(255,102,171,0.25)] hover:shadow-[0_4px_24px_rgba(255,102,171,0.5)] hover:scale-[1.02] active:scale-[0.98]',
    ghost:
      'bg-white/[0.06] hover:bg-white/[0.12] text-[#b8c0d4] hover:text-white font-semibold border border-white/[0.08] hover:border-white/[0.2] active:scale-[0.98]',
    secondary:
      'bg-[#6c5ce7]/20 hover:bg-[#6c5ce7]/30 text-[#a29bfe] hover:text-white font-bold border border-[#6c5ce7]/30 hover:border-[#6c5ce7]/60 active:scale-[0.98]',
    danger:
      'bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white font-bold border border-red-500/30 hover:border-red-500/60 active:scale-[0.98]'
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
