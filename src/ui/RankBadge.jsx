import React from 'react';

export function getRankBadgeStyle(rank) {
  const r = String(rank || 'D').toUpperCase().trim();
  switch (r) {
    case 'SS+':
    case 'SSH':
      return {
        text: 'text-white',
        bg: 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-400',
        glow: 'shadow-[0_0_18px_rgba(255,255,255,0.7)]',
        color: '#ffffff'
      };
    case 'SS':
    case 'SSS':
    case 'SSS+':
      return {
        text: 'text-amber-950 font-black',
        bg: 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500',
        glow: 'shadow-[0_0_18px_rgba(251,191,36,0.7)]',
        color: '#facc15'
      };
    case 'S+':
    case 'SH':
      return {
        text: 'text-slate-900 font-black',
        bg: 'bg-gradient-to-br from-slate-200 to-slate-300',
        glow: 'shadow-[0_0_14px_rgba(226,232,240,0.5)]',
        color: '#e2e8f0'
      };
    case 'S':
      return {
        text: 'text-amber-950 font-black',
        bg: 'bg-gradient-to-br from-yellow-300 to-amber-400',
        glow: 'shadow-[0_0_14px_rgba(251,191,36,0.5)]',
        color: '#fbbf24'
      };
    case 'A':
      return {
        text: 'text-emerald-950 font-black',
        bg: 'bg-gradient-to-br from-emerald-300 to-green-400',
        glow: 'shadow-[0_0_12px_rgba(52,211,153,0.4)]',
        color: '#34d399'
      };
    case 'B':
      return {
        text: 'text-blue-950 font-black',
        bg: 'bg-gradient-to-br from-blue-300 to-cyan-400',
        glow: 'shadow-[0_0_12px_rgba(96,165,250,0.4)]',
        color: '#60a5fa'
      };
    case 'C':
      return {
        text: 'text-fuchsia-950 font-black',
        bg: 'bg-gradient-to-br from-fuchsia-300 to-pink-400',
        glow: 'shadow-[0_0_12px_rgba(232,121,249,0.4)]',
        color: '#e879f9'
      };
    default:
      return {
        text: 'text-rose-950 font-black',
        bg: 'bg-gradient-to-br from-rose-400 to-red-500',
        glow: 'shadow-[0_0_10px_rgba(244,63,94,0.4)]',
        color: '#f43f5e'
      };
  }
}

export default function RankBadge({
  rank = 'D',
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  className = '',
  ...props
}) {
  const badge = getRankBadgeStyle(rank);

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px] rounded-md',
    md: 'w-8 h-8 text-xs rounded-lg',
    lg: 'w-12 h-12 text-lg rounded-xl',
    xl: 'w-20 h-20 text-3xl rounded-2xl'
  }[size] || 'w-8 h-8 text-xs rounded-lg';

  return (
    <div
      className={`inline-flex items-center justify-center font-black select-none ${badge.bg} ${badge.text} ${badge.glow} ${sizeClasses} ${className}`}
      {...props}
    >
      <span>{rank}</span>
    </div>
  );
}
