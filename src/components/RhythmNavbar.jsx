import React, { useState } from 'react';

export default function RhythmNavbar({
  currentScreen,
  onNavigate,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenSettings,
}) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-black/95 backdrop-blur-md border-b border-white/10 px-5 flex items-center justify-between z-50 select-none font-sans">
      {/* Left: Brand Logo + Online Counter */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => onNavigate('SONG_SELECT')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.5)] group-hover:scale-105 transition-transform">
            <span className="text-white font-black text-sm">▲</span>
          </div>
          <span className="font-bold text-lg text-white tracking-wide group-hover:text-indigo-400 transition-colors">
            Triarhythm
          </span>
        </div>

        {/* Online Status Pill (Matching RhythmTyper _onlineCounter) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-white/90">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Online</span>
        </div>
      </div>

      {/* Center: Main Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-[#1a1a2e]/60 border border-white/10 rounded-xl p-1">
        <button
          onClick={() => onNavigate('SONG_SELECT')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            currentScreen === 'SONG_SELECT'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🎵</span>
          <span>Play</span>
        </button>

        <button
          onClick={() => onNavigate('LEADERBOARD')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            currentScreen === 'LEADERBOARD'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🏆</span>
          <span>Leaderboard</span>
        </button>

        <button
          onClick={() => onNavigate('EDITOR')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            currentScreen === 'EDITOR'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>✏️</span>
          <span>Editor</span>
        </button>
      </nav>

      {/* Right: Quick Action Buttons + User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
          title="Settings"
        >
          ⚙️
        </button>

        {/* User Info / Profile Button */}
        {currentUser ? (
          <div className="relative flex items-center gap-2.5">
            <div className="hidden md:flex flex-col items-end leading-tight text-right">
              <span className="text-xs font-medium text-white/95">
                {currentUser.name || currentUser.username}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                <span>Rank #1</span>
                <span className="text-white/30">|</span>
                <span>★ {Number(currentUser.rating || 0).toFixed(2)} PP</span>
              </div>
            </div>

            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-500/60 hover:border-indigo-400 p-0 cursor-pointer transition-colors shadow-sm"
            >
              <img
                src={currentUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 top-12 mt-1 w-52 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-4 py-2 border-b border-white/10 text-xs">
                  <div className="font-bold text-white">{currentUser.username}</div>
                  <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                  <div className="text-[11px] text-indigo-300 font-bold mt-1">
                    Score: {Number(currentUser.total_score || 0).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 font-semibold"
                >
                  <span>🚪</span>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wide transition-all shadow-[0_0_12px_rgba(99,102,241,0.4)] cursor-pointer"
          >
            <span>👤</span>
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
