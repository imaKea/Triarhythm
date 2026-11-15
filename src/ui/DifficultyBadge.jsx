import React from 'react';
import { MAIMAI_CATEGORY_COLORS, normalizeMaimaiCategory } from '../core/beatmap/maimaiDifficulty.js';
import { getStarColor } from './StarRating.jsx';

/**
 * DifficultyBadge: Renders Maimai difficulty badge (Basic, Advanced, Expert, Master, Re:Master)
 * and if `showOsuStars && osuStars` is present, shows osu! star rating side by side.
 */
export default function DifficultyBadge({
  category = 'Master',
  level = '12',
  osuStars = null,
  showOsuStars = false,
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  ...props
}) {
  const normCategory = normalizeMaimaiCategory(category);
  const color = MAIMAI_CATEGORY_COLORS[normCategory] || MAIMAI_CATEGORY_COLORS['Master'];

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold'
  }[size] || 'text-xs px-2.5 py-1 gap-1.5';

  const osuStarNum = parseFloat(osuStars);
  const hasOsuStars = showOsuStars && !isNaN(osuStarNum) && osuStarNum > 0;
  const starColor = hasOsuStars ? getStarColor(osuStarNum) : null;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} {...props}>
      {/* Maimai Difficulty Badge */}
      <div
        className={`inline-flex items-center rounded-full font-mono font-black border select-none ${color.bg} ${color.text} ${color.border} ${sizeClasses} shadow-sm`}
      >
        <span className="uppercase tracking-wider">{color.short}</span>
        <span className="font-extrabold">{level}</span>
      </div>

      {/* osu! Star Rating side by side (if available / osu map) */}
      {hasOsuStars && starColor && (
        <div
          className={`inline-flex items-center rounded-full font-mono font-black border select-none ${starColor.bg} ${starColor.text} ${starColor.border} ${sizeClasses} shadow-sm`}
          title={`osu! Star Rating: ${osuStarNum.toFixed(2)}★`}
        >
          <span className="text-xs">★</span>
          <span>{osuStarNum.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
