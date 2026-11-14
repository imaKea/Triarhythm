import React, { useEffect } from 'react';
import { StarRating } from '../ui/index.js';

export default function PlayerLoader({ chart, onReady, durationMs = 1200 }) {
  const metadata = chart?.metadata || chart?.beatmap?.metadata || {};
  const title = chart?.title || metadata.title || 'Untitled';
  const artist = chart?.artist || metadata.artist || 'Unknown Artist';
  const diffName = chart?.difficultyName || metadata.difficultyName || 'Normal';
  const stars = parseFloat(chart?.stars || metadata.stars || chart?.difficultyLevel || 5);
  const creator = chart?.creator || metadata.creator || 'Triarhythm';
  const coverUrl = chart?.backgroundSource || chart?.serverAssets?.coverUrl || null;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onReady) onReady();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [onReady, durationMs]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d1a] flex items-center justify-center select-none overflow-hidden animate-fadeIn">
      {/* Blurred cover background */}
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-25 scale-110"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d1a] via-[#0d0d1a]/80 to-transparent" />

      {/* Center Card */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full px-8 text-center animate-slideDown">
        {/* Cover thumbnail */}
        <div className="w-36 h-36 rounded-2xl overflow-hidden border-2 border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] mb-6 bg-[#1a1a2e] relative group">
          {coverUrl ? (
            <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-[#ff66ab]">
              ▲
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* Title & Artist */}
        <h1 className="text-2xl font-black text-white tracking-wide mb-1 truncate max-w-full font-torus">
          {title}
        </h1>
        <p className="text-sm font-semibold text-[#b8c0d4] mb-3 truncate max-w-full">
          {artist}
        </p>

        {/* Diff badge & Creator */}
        <div className="flex items-center gap-2 mb-8">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ff66ab]/20 text-[#ff66ab] border border-[#ff66ab]/30">
            {diffName}
          </span>
          <StarRating stars={stars} size="sm" />
          <span className="text-xs text-[#7c849c]">
            mapped by <strong className="text-[#b8c0d4]">{creator}</strong>
          </span>
        </div>

        {/* Loading Spinner / Progress Indicator */}
        <div className="w-48 flex flex-col items-center gap-2">
          <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#cc5289] to-[#ff66ab] animate-[pulse_1s_ease-in-out_infinite] w-full" />
          </div>
          <span className="text-[11px] font-mono font-medium text-[#7c849c] tracking-widest uppercase">
            Loading beatmap...
          </span>
        </div>
      </div>
    </div>
  );
}
