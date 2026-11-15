import React, { useEffect } from 'react';
import { DifficultyBadge, StarRating } from '../ui/index.js';
import { normalizeMaimaiCategory, calculateMaimaiRating } from '../core/beatmap/maimaiDifficulty.js';

export default function PlayerLoader({ chart, onReady, durationMs = 1200 }) {
  const metadata = chart?.metadata || chart?.beatmap?.metadata || {};
  const title = chart?.title || metadata.title || 'Untitled';
  const artist = chart?.artist || metadata.artist || 'Unknown Artist';
  const diffName = chart?.difficultyName || metadata.difficultyName || 'Normal';
  const stars = parseFloat(chart?.stars || metadata.stars || chart?.difficultyLevel || 5);
  const creator = chart?.creator || metadata.creator || 'Triarhythm';
  const coverUrl = chart?.backgroundSource || chart?.serverAssets?.coverUrl || null;
  const isOsu = Boolean(chart?.source === 'osu' || chart?.keys || chart?.rawOsu || metadata?.source === 'osu');
  const maimaiLevel = chart?.difficultyLevel || metadata.difficultyLevel || calculateMaimaiRating(chart?.beatmap || chart).levelString;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onReady) onReady();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [onReady, durationMs]);

  return (
    <div className="fixed inset-0 z-50 bg-[#fff5f8] flex items-center justify-center select-none overflow-hidden animate-fadeIn">
      {/* Blurred cover background */}
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-20 scale-110"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#ffd9e5]/60 via-[#fff5f8]/80 to-[#ffdce7]/50" />

      {/* Center Card */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full px-8 py-8 rounded-3xl bg-white/85 backdrop-blur-md border border-[#f3dbe4] shadow-[0_16px_40px_rgba(255,133,162,0.2)] text-center animate-slideDown">
        {/* Cover thumbnail */}
        <div className="w-36 h-36 rounded-3xl overflow-hidden border-2 border-[#f3dbe4] shadow-md mb-5 bg-[#fff0f4] relative group">
          {coverUrl ? (
            <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              🐰
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#5b2a47]/30 to-transparent" />
        </div>

        {/* Title & Artist */}
        <h1 className="text-2xl font-black text-[#5b2a47] tracking-wide mb-1 truncate max-w-full font-torus flex items-center gap-2">
          <span>{title}</span>
          <span className="text-lg">🎀</span>
        </h1>
        <p className="text-sm font-semibold text-[#a8556f] mb-3 truncate max-w-full">
          {artist}
        </p>

        {/* Diff badge & Creator */}
        <div className="flex items-center gap-2 mb-8 flex-wrap justify-center">
          <DifficultyBadge
            category={normalizeMaimaiCategory(diffName)}
            level={maimaiLevel}
            osuStars={stars}
            showOsuStars={isOsu}
            size="sm"
          />
          <span className="text-xs text-[#a8556f]">
            mapped by <strong className="text-[#5b2a47]">{creator}</strong>
          </span>
        </div>

        {/* Loading Spinner / Progress Indicator */}
        <div className="w-48 flex flex-col items-center gap-2">
          <div className="w-full h-2 rounded-full bg-[#ffd9e5] overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] animate-[pulse_1s_ease-in-out_infinite] w-full" />
          </div>
          <span className="text-[11px] font-mono font-bold text-[#a8556f] tracking-widest uppercase flex items-center gap-1.5">
            <span>Preparing stage...</span>
            <span>🐰</span>
          </span>
        </div>
      </div>
    </div>
  );
}
