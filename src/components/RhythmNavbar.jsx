import React, { useState } from 'react';
import { playHover, playSelect } from '../ui/sound/uiAudio.js';

export default function RhythmNavbar({
  currentScreen,
  onNavigate,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenSettings,
}) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const navItems = [
    { id: 'SONG_SELECT', label: 'play', icon: '▶' },
    { id: 'LEADERBOARD', label: 'rankings', icon: '★' },
    { id: 'EDITOR', label: 'edit', icon: '✎' },
    { id: 'UI_KIT', label: 'ui kit', icon: '🎨' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-[52px] bg-[#1a1a2e]/95 backdrop-blur-xl border-b border-white/[0.06] px-6 flex items-center justify-between z-50 select-none">
      {/* Left: Logo */}
      <div
        onClick={() => onNavigate('SONG_SELECT')}
        className="flex items-center gap-2 cursor-pointer group"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ff66ab] to-[#cc5289] flex items-center justify-center shadow-[0_0_12px_rgba(255,102,171,0.5)] group-hover:shadow-[0_0_18px_rgba(255,102,171,0.7)] transition-shadow">
          <span className="text-white font-black text-xs">▲</span>
        </div>
        <span className="font-bold text-base text-white tracking-wide group-hover:text-[#ff66ab] transition-colors">
          triarhythm
        </span>
      </div>

      {/* Center: Navigation */}
      <nav className="flex items-center gap-0.5">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                playSelect();
                onNavigate(item.id);
              }}
              onMouseEnter={() => !isActive && playHover()}
              className={`px-5 py-1.5 text-[13px] font-bold tracking-wide transition-all cursor-pointer relative ${
                isActive
                  ? 'text-white'
                  : 'text-[#8890a4] hover:text-white'
              }`}
            >
              {item.label}
              {isActive && (
                <div className="absolute bottom-[-13px] left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#ff66ab] shadow-[0_0_8px_rgba(255,102,171,0.6)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Actions + User */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white flex items-center justify-center text-sm transition-all cursor-pointer"
          title="Settings"
        >
          ⚙
        </button>

        {currentUser ? (
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <img
                src={currentUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                alt="Avatar"
                className="w-7 h-7 rounded-full border-2 border-[#ff66ab]/50"
              />
              <span className="text-xs font-bold text-white/80 hidden md:block">
                {currentUser.name || currentUser.username}
              </span>
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 top-10 w-48 bg-[#1e1e38] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 animate-slideDown">
                <div className="px-3.5 py-2 border-b border-white/[0.06]">
                  <div className="font-bold text-white text-xs">{currentUser.username}</div>
                  <div className="text-[10px] text-[#8890a4] truncate">{currentUser.email}</div>
                  <div className="text-[10px] text-[#ff66ab] font-bold mt-0.5">
                    {Number(currentUser.rating || 0).toFixed(0)}pp
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer font-semibold"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#ff66ab] hover:bg-[#ff7ab8] text-white font-bold text-xs transition-all shadow-[0_0_12px_rgba(255,102,171,0.3)] hover:shadow-[0_0_18px_rgba(255,102,171,0.5)] cursor-pointer"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
