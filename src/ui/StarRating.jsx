import React from 'react';

/**
 * Lấy mã màu chuẩn osu! theo số sao (Star Rating)
 * 0.00 - 1.99: Xanh dương nhạt (Easy)
 * 2.00 - 3.99: Vàng lục (Normal / Hard)
 * 4.00 - 5.29: Cam đỏ (Insane)
 * 5.30 - 6.49: Đỏ hồng (Expert)
 * 6.50 - 7.99: Tím hồng (Master)
 * 8.00+: Đen / Tím đậm hào quang vàng (Grandmaster / Hell)
 */
export function getStarColor(stars) {
  const s = parseFloat(stars) || 0;
  if (s < 2.0) return { bg: 'bg-[#4fc3f7]/15', text: 'text-[#4fc3f7]', border: 'border-[#4fc3f7]/30', hex: '#4fc3f7' };
  if (s < 4.0) return { bg: 'bg-[#ffdd57]/15', text: 'text-[#ffdd57]', border: 'border-[#ffdd57]/30', hex: '#ffdd57' };
  if (s < 5.3) return { bg: 'bg-[#ff9100]/15', text: 'text-[#ff9100]', border: 'border-[#ff9100]/30', hex: '#ff9100' };
  if (s < 6.5) return { bg: 'bg-[#ff2a70]/15', text: 'text-[#ff2a70]', border: 'border-[#ff2a70]/30', hex: '#ff2a70' };
  if (s < 8.0) return { bg: 'bg-[#ab47bc]/15', text: 'text-[#ce93d8]', border: 'border-[#ab47bc]/30', hex: '#ab47bc' };
  return { bg: 'bg-[#1a0033]/90', text: 'text-[#ffd700]', border: 'border-[#ffd700]/50 shadow-[0_0_10px_rgba(255,215,0,0.4)]', hex: '#ffd700' };
}

export default function StarRating({
  stars = 0,
  size = 'md', // 'sm' | 'md' | 'lg'
  showIcon = true,
  className = '',
  ...props
}) {
  const sNum = parseFloat(stars) || 0;
  const color = getStarColor(sNum);

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold'
  }[size] || 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <div
      className={`inline-flex items-center rounded-full font-mono font-black border select-none ${color.bg} ${color.text} ${color.border} ${sizeClasses} ${className}`}
      {...props}
    >
      {showIcon && <span className="text-xs">★</span>}
      <span>{sNum.toFixed(2)}</span>
    </div>
  );
}
