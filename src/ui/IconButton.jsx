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
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base'
  }[size] || 'w-9 h-9 text-sm';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_2px_12px_rgba(255,102,171,0.3)] hover:shadow-[0_2px_18px_rgba(255,102,171,0.6)] hover:scale-105 active:scale-95',
    ghost:
      'bg-white/[0.06] hover:bg-white/[0.14] text-[#b8c0d4] hover:text-white border border-white/[0.08] hover:border-white/[0.2] hover:scale-105 active:scale-95',
    danger:
      'bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-white border border-red-500/25 hover:border-red-500/50 hover:scale-105 active:scale-95'
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
