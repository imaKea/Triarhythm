import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbManager } from '../core/storage/db.js';
import { calculatePPBreakdown } from '../core/pp/ppCalculator.js';
import { Button, StarRating, RankBadge, Avatar } from '../ui/index.js';
import { playHover, playClick, playResultFanfare } from '../ui/sound/uiAudio.js';

/**
 * Animated number counter using requestAnimationFrame and easeOutCubic
 */
function useAnimatedNumber(targetValue, durationMs = 1200) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animId = null;
    const startVal = 0;
    const endVal = Number(targetValue) || 0;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      // easeOutCubic: 1 - (1 - progress)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * ease);
      setDisplayValue(current);

      if (progress < 1.0) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [targetValue, durationMs]);

  return displayValue;
}

/**
 * Visual Hit Timing Offset Histogram for Unstable Rate (UR)
 */
function HitTimingHistogram({ hitOffsets = [], ur = 0 }) {
  const { buckets, earlyCount, lateCount, perfectCount, meanOffset, maxBucketCount } = useMemo(() => {
    // Nếu không có mảng offsets (ví dụ test hoặc mock), sinh bucket tượng trưng từ UR
    const offsets = (hitOffsets && hitOffsets.length > 0)
      ? hitOffsets
      : [];

    let early = 0;
    let late = 0;
    let perfect = 0;
    let sum = 0;

    // 21 buckets từ -50ms đến +50ms (mỗi bucket 5ms)
    // bucket[0]: < -45ms ... bucket[10]: [-5ms, +5ms] ... bucket[20]: > +45ms
    const bucketArray = new Array(21).fill(0);

    for (const delta of offsets) {
      sum += delta;
      if (delta < -5) early++;
      else if (delta > 5) late++;
      else perfect++;

      // Map delta vào index 0..20
      const idx = Math.max(0, Math.min(20, Math.floor((delta + 52.5) / 5)));
      bucketArray[idx]++;
    }

    const mean = offsets.length > 0 ? sum / offsets.length : 0;
    const maxCount = Math.max(1, ...bucketArray);

    return {
      buckets: bucketArray,
      earlyCount: early,
      lateCount: late,
      perfectCount: perfect,
      meanOffset: mean,
      maxBucketCount: maxCount
    };
  }, [hitOffsets]);

  return (
    <div className="bg-white/95 border border-[#f3dbe4] rounded-3xl p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#ff4d80] font-mono font-bold tracking-wider uppercase text-[10px]">
            Unstable Rate
          </span>
          <span className="text-[#5b2a47] font-mono font-black text-sm">
            {Number(ur).toFixed(1)}
          </span>
        </div>
        <div className="text-[11px] font-mono text-[#a8556f]">
          Mean: <span className={meanOffset < -2 ? 'text-sky-500 font-bold' : meanOffset > 2 ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
            {meanOffset > 0 ? `+${meanOffset.toFixed(1)}ms` : `${meanOffset.toFixed(1)}ms`}
          </span> ({meanOffset < -3 ? 'Early' : meanOffset > 3 ? 'Late' : 'Balanced'})
        </div>
      </div>

      {/* Histogram Bar Chart */}
      <div className="h-16 w-full flex items-end gap-[3px] px-1 relative border-b border-[#f3dbe4] pt-2">
        {/* Center Target Marker (0ms line) */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-[#ff4d80] shadow-[0_0_8px_#ff4d80] z-10 opacity-70 pointer-events-none" />

        {buckets.map((count, i) => {
          const heightPercent = count > 0 ? Math.max(8, Math.round((count / maxBucketCount) * 100)) : 0;
          const isEarly = i < 10;
          const isCenter = i === 10;
          const barColor = isCenter
            ? 'bg-gradient-to-t from-[#ff85a2] to-[#ff4d80]'
            : isEarly
              ? 'bg-gradient-to-t from-[#7dd3fc] to-[#38bdf8]'
              : 'bg-gradient-to-t from-[#fdba74] to-[#fb923c]';

          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end items-center h-full group relative"
            >
              <div
                className={`w-full rounded-t-sm transition-all duration-300 ${barColor}`}
                style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '4px' : '0px' }}
              />
              {count > 0 && (
                <div className="absolute -top-6 hidden group-hover:flex px-1.5 py-0.5 rounded bg-white text-[9px] text-[#5b2a47] font-bold font-mono whitespace-nowrap z-20 pointer-events-none border border-[#f3dbe4] shadow-md">
                  {count} hits
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-between items-center text-[10px] font-mono text-[#a8556f] px-1">
        <span className="text-[#0284c7] flex items-center gap-1 font-bold">
          ◀ EARLY ({earlyCount})
        </span>
        <span className="text-emerald-600 font-bold">
          PERFECT ({perfectCount})
        </span>
        <span className="text-[#ea580c] flex items-center gap-1 font-bold">
          LATE ({lateCount}) ▶
        </span>
      </div>
    </div>
  );
}

/**
 * Main osu!(lazer) Result Screen Component
 */
export default function AstroResultScreen({
  result,
  beatmap,
  initialChart,
  currentUser,
  isAutoplay = false,
  onRetry,
  onReplay,
  onBack
}) {
  const [personalBest, setPersonalBest] = useState(null);
  const [loadingPB, setLoadingPB] = useState(true);

  // Play fanfare sound on appear
  useEffect(() => {
    const isPass = (result?.achievement || 0) >= 70;
    playResultFanfare(isPass);
  }, []);

  // Fetch Personal Best from IndexedDB
  const beatmapId = beatmap?.metadata?.id || initialChart?.id || 'sample_beatmap';
  useEffect(() => {
    let active = true;
    const fetchPB = async () => {
      try {
        setLoadingPB(true);
        const scores = await dbManager.getScoresByBeatmap(beatmapId);
        if (!active) return;
        // Lấy điểm cao nhất trước lần chơi này (hoặc điểm top 1 trong DB)
        const validScores = (scores || []).filter(
          (s) => s.score !== undefined && !s.isAutoplay
        );
        if (validScores.length > 0) {
          // Điểm cao nhất theo score
          const topScore = [...validScores].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
          setPersonalBest(topScore);
        } else {
          setPersonalBest(null);
        }
      } catch (err) {
        console.warn('Lỗi tải Personal Best:', err);
      } finally {
        if (active) setLoadingPB(false);
      }
    };
    fetchPB();
    return () => {
      active = false;
    };
  }, [beatmapId]);

  // Keyboard navigation shortcuts: chỉ giữ [Esc] để quay lại Song Select,
  // không bắt phím R / P để tránh xung đột với phím gõ lane (phím R là Lane 3) khi vừa kết thúc bài.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        playClick();
        if (onBack) onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const rawScore = result?.score ?? Math.round((result?.achievement || 0) * 10000);
  const animatedScore = useAnimatedNumber(rawScore, 1000);

  const rawAccuracy = Number(result?.achievement || 0);
  const stars = Number(result?.stars || beatmap?.metadata?.stars || 5.0);
  const missCount = result?.counts?.miss || 0;
  const noteCount = beatmap?.notes?.length || initialChart?.beatmap?.notes?.length || 100;

  // PP Breakdown
  const ppData = useMemo(() => {
    if (isAutoplay) return { totalPP: 0, aimPP: 0, speedPP: 0, accPP: 0 };
    return calculatePPBreakdown({
      stars,
      achievement: rawAccuracy,
      missCount,
      noteCount
    });
  }, [stars, rawAccuracy, missCount, noteCount, isAutoplay]);

  // So sánh với Personal Best
  const pbComparison = useMemo(() => {
    if (!personalBest) {
      return { isNewRecord: true, scoreDiff: null, accDiff: null, ppDiff: null };
    }
    const prevScore = Number(personalBest.score || 0);
    const prevAcc = Number(personalBest.achievement || 0);
    const prevPP = Number(personalBest.pp || 0);

    const isNew = rawScore > prevScore;
    return {
      isNewRecord: isNew,
      scoreDiff: rawScore - prevScore,
      accDiff: rawAccuracy - prevAcc,
      ppDiff: ppData.totalPP - prevPP
    };
  }, [personalBest, rawScore, rawAccuracy, ppData.totalPP]);

  const title = initialChart?.title || beatmap?.metadata?.title || 'Beyond The Æxis';
  const artist = initialChart?.artist || beatmap?.metadata?.artist || 'Unknown Artist';
  const diffName = initialChart?.difficultyName || beatmap?.metadata?.difficultyName || 'Normal';
  const creator = beatmap?.metadata?.creator || initialChart?.creator || 'Triarhythm Mapper';
  const coverUrl = initialChart?.backgroundSource || initialChart?.serverAssets?.coverUrl || initialChart?.coverUrl;

  const counts = result?.counts || {
    criticalPerfect: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0
  };

  const isFC = result?.flags?.isFC || (counts.miss === 0 && (result?.maxCombo || 0) > 0);
  const isAP = result?.flags?.isAP || (isFC && counts.great === 0 && counts.good === 0 && counts.perfect === 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fff5f8] text-[#5b2a47] select-none overflow-hidden animate-fadeIn font-sans">
      {/* Background Cover with Blur & Dim */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="background"
            className="w-full h-full object-cover filter blur-3xl scale-110 opacity-15"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#ffd9e5] via-[#fff5f8] to-[#f8a3bb]/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#fff5f8] via-transparent to-[#fff5f8]/80" />
      </div>

      {/* Top Header Wedge: Map Info */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-[#f3dbe4] bg-[#fffafc]/85 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#fff1f5] border border-[#f3dbe4] flex-shrink-0 shadow-sm">
            {coverUrl ? (
              <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl text-[#ff4d80]">🐰</div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-[#5b2a47] truncate tracking-tight flex items-center gap-1.5 font-torus">
                <span>{title}</span>
                <span className="text-sm">🎀</span>
              </h1>
              {isAutoplay && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#ff9800]/20 text-[#e65100] border border-[#ff9800]/40">
                  AUTO PLAY
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#a8556f] font-medium truncate mt-0.5">
              <span>{artist}</span>
              <span>•</span>
              <span className="text-[#ff4d80] font-bold">[{diffName}]</span>
              <span>•</span>
              <StarRating stars={stars} size="sm" />
              <span>•</span>
              <span className="text-[#a8556f]">mapped by {creator} 🐰</span>
            </div>
          </div>
        </div>

        {/* User Card on Right */}
        <div className="flex items-center gap-3 bg-white border border-[#f3dbe4] px-4 py-2 rounded-full shadow-sm">
          <div className="relative">
            <Avatar
              src={currentUser?.avatar}
              alt={currentUser?.name || 'Guest'}
              size="md"
              status={currentUser ? 'online' : 'offline'}
            />
            <span className="absolute -top-1 -right-1 text-[10px]">🎀</span>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-[#5b2a47] leading-tight">
              {currentUser?.name || 'Guest'}
            </div>
            <div className="text-[10px] text-[#ff4d80] font-mono font-bold">
              {currentUser ? `#${currentUser.rank || 1} • ${(currentUser.pp || currentUser.rating || 0).toFixed(0)}pp` : 'Offline Play 🐰'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body: Two-Column osu!(lazer) Layout */}
      <main className="relative z-10 flex-1 grid grid-cols-12 gap-8 px-10 py-6 overflow-y-auto max-w-7xl mx-auto w-full items-center">
        {/* Left Column (5 Cols): Rank Grade, Score, Accuracy, Personal Best */}
        <div className="col-span-12 lg:col-span-5 flex flex-col items-center lg:items-start gap-5">
          {/* Rank Badge with Radiant Halo */}
          <div className="relative group my-2 flex items-center gap-3">
            <span className="text-2xl animate-kawaii-wiggle inline-block select-none">🎀</span>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#ff85a2]/30 via-[#ffaec9]/20 to-[#ffd6e0]/20 blur-2xl transform scale-150 animate-pulse pointer-events-none" />
              <div className="relative transform hover:scale-105 transition-transform duration-300">
                <RankBadge rank={result?.rank || 'D'} size="xl" className="w-28 h-28 text-5xl rounded-3xl shadow-xl" />
              </div>
            </div>
            <span className="text-2xl animate-kawaii-bounce inline-block select-none">🐰</span>
          </div>

          {/* Rolling Score & Accuracy */}
          <div className="w-full text-center lg:text-left">
            <div className="text-[10px] text-[#ff4d80] font-mono font-bold tracking-[0.25em] uppercase">
              TOTAL SCORE
            </div>
            <div className="text-5xl lg:text-6xl font-black text-[#5b2a47] tracking-tight font-mono drop-shadow-sm">
              {animatedScore.toLocaleString('en-US')}
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-4 mt-2">
              <div className="text-2xl lg:text-3xl font-black text-emerald-600 font-mono">
                {rawAccuracy.toFixed(2)}%
              </div>
              <div className="text-sm font-bold text-[#a8556f] font-mono flex items-center gap-1.5">
                <span>MAX COMBO:</span>
                <span className="text-[#5b2a47] font-black">{result?.maxCombo || 0}x</span>
                {isAP && (
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-600 text-[10px] font-black border border-amber-400/50 shadow-sm">
                    AP
                  </span>
                )}
                {isFC && !isAP && (
                  <span className="px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-600 text-[10px] font-black border border-emerald-400/50">
                    FC
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Personal Best Card */}
          <div className="w-full bg-white/95 border border-[#f3dbe4] rounded-3xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#ff4d80] tracking-wider uppercase">
                PERSONAL RECORD
              </span>
              {pbComparison.isNewRecord && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-[#ff4d80] text-white shadow-sm">
                  ★ NEW RECORD!
                </span>
              )}
            </div>

            {loadingPB ? (
              <div className="text-xs text-[#a8556f] font-mono">Checking records...</div>
            ) : personalBest ? (
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[#a8556f]">BEST SCORE</div>
                  <div className="text-[#5b2a47] font-bold truncate">
                    {(personalBest.score || 0).toLocaleString('en-US')}
                  </div>
                  {pbComparison.scoreDiff !== null && (
                    <div className={`text-[10px] font-bold ${pbComparison.scoreDiff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {pbComparison.scoreDiff >= 0 ? `+${pbComparison.scoreDiff.toLocaleString()}` : pbComparison.scoreDiff.toLocaleString()}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] text-[#a8556f]">BEST ACC</div>
                  <div className="text-[#5b2a47] font-bold">
                    {Number(personalBest.achievement || 0).toFixed(2)}%
                  </div>
                  {pbComparison.accDiff !== null && (
                    <div className={`text-[10px] font-bold ${pbComparison.accDiff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {pbComparison.accDiff >= 0 ? `+${pbComparison.accDiff.toFixed(2)}%` : `${pbComparison.accDiff.toFixed(2)}%`}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] text-[#a8556f]">BEST PP</div>
                  <div className="text-[#ff4d80] font-bold">
                    {Number(personalBest.pp || 0).toFixed(0)}pp
                  </div>
                  {pbComparison.ppDiff !== null && !isAutoplay && (
                    <div className={`text-[10px] font-bold ${pbComparison.ppDiff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {pbComparison.ppDiff >= 0 ? `+${pbComparison.ppDiff.toFixed(0)}pp` : `${pbComparison.ppDiff.toFixed(0)}pp`}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#a8556f] font-mono">
                First time clearing this chart! Record saved.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): PP Breakdown, Judgements Grid, UR Histogram */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          {/* PP Breakdown Card */}
          <div className="bg-white/95 border border-[#f3dbe4] rounded-3xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold text-[#ff4d80] tracking-wider uppercase">
                PERFORMANCE POINTS BREAKDOWN
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-[#ff4d80] font-mono">
                  {ppData.totalPP.toFixed(1)}
                </span>
                <span className="text-xs font-bold text-[#a8556f] font-mono">pp</span>
              </div>
            </div>

            {/* PP sub-cards: Aim / Speed / Accuracy */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#fff8fa] border border-[#f3dbe4] rounded-2xl p-3 flex flex-col items-center">
                <span className="text-[10px] text-[#a8556f] font-mono uppercase font-bold">AIM PP</span>
                <span className="text-lg font-black text-sky-500 font-mono mt-0.5">
                  {ppData.aimPP.toFixed(1)}
                </span>
                <div className="w-full bg-[#f3dbe4] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${ppData.totalPP > 0 ? (ppData.aimPP / ppData.totalPP) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#fff8fa] border border-[#f3dbe4] rounded-2xl p-3 flex flex-col items-center">
                <span className="text-[10px] text-[#a8556f] font-mono uppercase font-bold">SPEED PP</span>
                <span className="text-lg font-black text-purple-500 font-mono mt-0.5">
                  {ppData.speedPP.toFixed(1)}
                </span>
                <div className="w-full bg-[#f3dbe4] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${ppData.totalPP > 0 ? (ppData.speedPP / ppData.totalPP) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#fff8fa] border border-[#f3dbe4] rounded-2xl p-3 flex flex-col items-center">
                <span className="text-[10px] text-[#a8556f] font-mono uppercase font-bold">ACCURACY PP</span>
                <span className="text-lg font-black text-emerald-500 font-mono mt-0.5">
                  {ppData.accPP.toFixed(1)}
                </span>
                <div className="w-full bg-[#f3dbe4] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${ppData.totalPP > 0 ? (ppData.accPP / ppData.totalPP) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Judgement Counts osu! Table */}
          <div className="bg-white/95 border border-[#f3dbe4] rounded-3xl p-4 shadow-sm">
            <div className="text-[10px] font-mono font-bold text-[#ff4d80] tracking-wider uppercase mb-3">
              JUDGEMENT BREAKDOWN
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffea00] shadow-[0_0_6px_#ffea00]" />
                  <span className="text-[#b28900] font-bold">CRITICAL</span>
                </div>
                <span className="text-[#5b2a47] font-black text-sm">{counts.criticalPerfect}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffd600] shadow-[0_0_6px_#ffd600]" />
                  <span className="text-[#a67c00] font-bold">PERFECT</span>
                </div>
                <span className="text-[#5b2a47] font-black text-sm">{counts.perfect}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00e676] shadow-[0_0_6px_#00e676]" />
                  <span className="text-[#008f4c] font-bold">GREAT</span>
                </div>
                <span className="text-[#5b2a47] font-black text-sm">{counts.great}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff9100] shadow-[0_0_6px_#ff9100]" />
                  <span className="text-[#c76500] font-bold">GOOD</span>
                </div>
                <span className="text-[#5b2a47] font-black text-sm">{counts.good}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef5350] shadow-[0_0_6px_#ef5350]" />
                  <span className="text-[#c62828] font-bold">MISS</span>
                </div>
                <span className={`font-black text-sm ${counts.miss > 0 ? 'text-[#c62828]' : 'text-[#5b2a47]'}`}>
                  {counts.miss}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.7)]" />
                  <span className="text-purple-600 font-bold">TOTAL NOTES</span>
                </div>
                <span className="text-[#5b2a47] font-black text-sm">{noteCount}</span>
              </div>
            </div>
          </div>

          {/* Hit Timing Offset & UR Histogram */}
          <HitTimingHistogram hitOffsets={result?.hitOffsets || []} ur={result?.ur || 0} />
        </div>
      </main>

      {/* Bottom Action Footer Bar */}
      <footer className="relative z-10 flex items-center justify-between px-8 py-4 border-t border-[#f3dbe4] bg-[#fffafc]/90 backdrop-blur-md shadow-[0_-4px_20px_rgba(126,47,79,0.04)]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#a8556f] font-bold">
          <span className="px-2 py-0.5 rounded-full bg-[#fff1f5] text-[#5b2a47] border border-[#f3dbe4]">Esc</span> Quay lại chọn bài 🐰
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              playClick();
              if (onBack) onBack();
            }}
            icon="←"
          >
            Chọn bài hát 🐰
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              playClick();
              if (onReplay) onReplay();
            }}
            icon="▶"
          >
            Xem lại 🎀
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              playClick();
              if (onRetry) onRetry();
            }}
            icon="↺"
          >
            Chơi lại 🎀
          </Button>
        </div>
      </footer>
    </div>
  );
}
