import React, { useState, useEffect } from 'react';
import { playHover, playSelect, playClick } from '../ui/sound/uiAudio.js';
import { Avatar, Tooltip } from '../ui/index.js';
import Bow from '../ui/kawaii/Bow.jsx';

export default function RhythmNavbar({
  currentScreen,
  onNavigate,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onOpenSettings,
  onLogout,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const navItems = [
    { id: 'SONG_SELECT', label: 'play', icon: '🐰' },
    { id: 'LEADERBOARD', label: 'rankings', icon: '★' },
    ...(currentUser?.role === 'admin' ? [{ id: 'ADMIN', label: 'admin', icon: '🛡️' }] : []),
  ];

  return (
    <>
      {/* TOP KAWAII NAVBAR */}
      <header className="fixed top-0 left-0 right-0 h-[50px] sm:h-[54px] bg-[#fffafc]/85 backdrop-blur-xl border-b border-[#f3dbe4] px-2.5 sm:px-6 flex items-center justify-between z-50 select-none shadow-[0_4px_20px_rgba(126,47,79,0.06)]">
        {/* Left: Kawaii Bunny + Ribbon Logo */}
        <div
          onClick={() => {
            playSelect();
            onNavigate('SONG_SELECT');
          }}
          className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#ffaec9] via-[#ff85a2] to-[#ff4d80] flex items-center justify-center shadow-[0_2px_12px_rgba(255,133,162,0.5)] group-hover:shadow-[0_4px_18px_rgba(255,133,162,0.8)] group-hover:scale-110 transition-all text-xs sm:text-sm select-none">
            🐰
          </div>
          <div className="flex items-center gap-1">
            <span className="font-torus font-black text-sm sm:text-lg text-[#5b2a47] tracking-wider group-hover:text-[#ff4d80] transition-colors hidden xs:inline">
              Triarhythm
            </span>
            <Bow className="scale-75" />
          </div>
        </div>

        {/* Center: Navigation Pills */}
        <nav className="min-w-0 overflow-x-auto flex items-center gap-0.5 sm:gap-1 bg-[#fff1f5] p-0.5 sm:p-1 rounded-full border border-[#f3dbe4] shadow-inner">
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
                className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_2px_12px_rgba(255,77,128,0.25)] scale-[1.02]'
                    : 'text-[#5b2a47] hover:text-[#ff4d80] hover:bg-white'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => {
              playClick();
              if (onOpenSettings) onOpenSettings();
            }}
            onMouseEnter={() => playHover()}
            className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold tracking-wide text-[#5b2a47] hover:text-[#ff4d80] hover:bg-white transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>⚙</span>
            <span className="hidden sm:inline">settings</span>
          </button>
        </nav>

        {/* Right: User card & controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                onClick={() => {
                  playClick();
                  if (onOpenProfile) onOpenProfile();
                }}
                className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 rounded-full bg-white hover:bg-[#fff0f4] border border-[#f3dbe4] hover:border-[#ff85a2] hover:shadow-[0_2px_12px_rgba(255,133,162,0.2)] transition-all cursor-pointer group"
                title="View player profile"
              >
                <div className="relative">
                  <Avatar
                    src={currentUser.avatar}
                    name={currentUser.name || currentUser.username}
                    size="sm"
                    status="online"
                  />
                  <span className="absolute -top-1 -right-1 text-[10px]">🎀</span>
                </div>
                <div className="hidden xs:flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-[#5b2a47] group-hover:text-[#ff4d80] transition-colors truncate max-w-[70px] sm:max-w-[100px]">
                    {currentUser.name || currentUser.username}
                  </span>
                  <span className="text-[10px] text-[#ff4d80] font-mono font-bold mt-0.5">
                    {currentUser.total_pp ? `${Number(currentUser.total_pp).toLocaleString()}pp` : `${currentUser.rating || 0}★`}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <Tooltip content="Sign Out">
                <button
                  onClick={() => {
                    playClick();
                    if (onLogout) onLogout();
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#ffeef2] hover:bg-[#ffd9e2] border border-[#f5b8c7] text-[#e94267] flex items-center justify-center text-xs transition-all cursor-pointer shadow-sm hover:scale-105"
                  title="Sign Out"
                >
                  ⎋
                </button>
              </Tooltip>
            </div>
          ) : (
            <button
              onClick={() => {
                playClick();
                if (onOpenAuth) onOpenAuth();
              }}
              className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] hover:from-[#ffaec9] hover:to-[#ff6b93] text-white transition-all cursor-pointer shadow-[0_2px_12px_rgba(255,77,128,0.25)] flex items-center gap-1 sm:gap-1.5"
            >
              <span>🐰</span>
              <span className="hidden sm:inline">Sign In</span>
              <span className="sm:hidden">Login</span>
              <span>🎀</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <Tooltip content={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}>
            <button
              onClick={toggleFullscreen}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-[#fff0f4] border border-[#f3dbe4] text-[#5b2a47] hover:text-[#ff4d80] flex items-center justify-center text-xs transition-colors cursor-pointer shadow-sm"
            >
              {isFullscreen ? '⤢' : '⛶'}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* BOTTOM STATUS BAR (Ẩn trên mobile để tối ưu màn hình cảm ứng) */}
      <footer className="hidden sm:flex fixed bottom-0 left-0 right-0 h-6 bg-[#fffafc]/90 backdrop-blur-md border-t border-[#f3dbe4] px-4 items-center justify-between text-[10px] text-[#a8556f] z-40 select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shadow-[0_0_6px_#34d399]" />
          <span className="font-bold text-[#5b2a47]">🐰 Triarhythm ~ Kawaii Edition 🎀</span>
        </div>
        <div className="flex items-center gap-3 font-mono font-medium">
          <span>TriRing9 Inverted Triangle</span>
          <span>IndexedDB + Web Audio</span>
        </div>
      </footer>
    </>
  );
}
