import React, { useState, useEffect } from 'react';
import { playHover, playSelect, playClick } from '../ui/sound/uiAudio.js';
import { Avatar, Tooltip } from '../ui/index.js';

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
    { id: 'UI_KIT', label: 'ui kit', icon: '🎨' },
  ];

  return (
    <>
      {/* TOP KAWAII NAVBAR */}
      <header className="fixed top-0 left-0 right-0 h-[50px] sm:h-[52px] bg-[#1a0e21]/95 backdrop-blur-xl border-b border-[#ff85a2]/20 px-2.5 sm:px-6 flex items-center justify-between z-50 select-none shadow-[0_4px_24px_rgba(22,12,26,0.6)]">
        {/* Left: Kawaii Bunny + Ribbon Logo */}
        <div
          onClick={() => {
            playSelect();
            onNavigate('SONG_SELECT');
          }}
          className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#ffaec9] via-[#ff85a2] to-[#ff4d80] flex items-center justify-center shadow-[0_0_16px_rgba(255,133,162,0.6)] group-hover:shadow-[0_0_24px_rgba(255,133,162,0.9)] group-hover:scale-110 transition-all text-xs sm:text-sm select-none">
            🐰
          </div>
          <div className="flex items-center gap-1">
            <span className="font-torus font-black text-sm sm:text-lg text-white tracking-wider group-hover:text-[#ffaec9] transition-colors hidden xs:inline">
              Triarhythm
            </span>
            <span className="text-xs sm:text-sm animate-kawaii-wiggle inline-block">🎀</span>
          </div>
        </div>

        {/* Center: Navigation Pills */}
        <nav className="flex items-center gap-0.5 sm:gap-1 bg-[#28152e]/85 p-0.5 sm:p-1 rounded-full border border-[#ff85a2]/25 shadow-inner">
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
                className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_2px_14px_rgba(255,133,162,0.5)] scale-[1.02]'
                    : 'text-[#d8bfd8] hover:text-white hover:bg-white/[0.08]'
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
            className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold tracking-wide text-[#d8bfd8] hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer flex items-center gap-1"
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
                className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-[#ff85a2]/30 hover:border-[#ff85a2]/70 hover:shadow-[0_0_15px_rgba(255,133,162,0.3)] transition-all cursor-pointer group"
                title="Xem hồ sơ người chơi"
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
                  <span className="text-xs font-bold text-white group-hover:text-[#ffaec9] transition-colors truncate max-w-[70px] sm:max-w-[100px]">
                    {currentUser.name || currentUser.username}
                  </span>
                  <span className="text-[10px] text-[#ffaec9] font-mono font-bold mt-0.5">
                    {currentUser.total_pp ? `${Number(currentUser.total_pp).toLocaleString()}pp` : `${currentUser.rating || 0}★`}
                  </span>
                </div>
              </div>

              {/* Nút Đăng xuất */}
              <Tooltip content="Đăng xuất tài khoản">
                <button
                  onClick={() => {
                    playClick();
                    if (onLogout) onLogout();
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white flex items-center justify-center text-xs transition-all cursor-pointer shadow-sm hover:scale-105"
                  title="Đăng xuất"
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
              className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#ff85a2]/20 to-[#ffaec9]/20 hover:from-[#ff85a2]/35 hover:to-[#ffaec9]/35 text-[#ffaec9] hover:text-white border border-[#ff85a2]/50 hover:border-[#ff85a2]/90 transition-all cursor-pointer shadow-[0_0_14px_rgba(255,133,162,0.3)] flex items-center gap-1 sm:gap-1.5"
            >
              <span>🐰</span>
              <span className="hidden sm:inline">Đăng nhập</span>
              <span className="sm:hidden">Login</span>
              <span>🎀</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <Tooltip content={isFullscreen ? 'Thu nhỏ (F11)' : 'Toàn màn hình (F11)'}>
            <button
              onClick={toggleFullscreen}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-[#ff85a2]/20 text-[#ffaec9] hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              {isFullscreen ? '⤢' : '⛶'}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* BOTTOM STATUS BAR (Ẩn trên mobile để tối ưu màn hình cảm ứng) */}
      <footer className="hidden sm:flex fixed bottom-0 left-0 right-0 h-6 bg-[#120817]/95 backdrop-blur-md border-t border-[#ff85a2]/15 px-4 items-center justify-between text-[10px] text-[#b89cb9] z-40 select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a7f3d0] shadow-[0_0_6px_#a7f3d0]" />
          <span>🐰 Triarhythm ~ Cute Bunny & Ribbon Edition 🎀</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span>TriRing9 Inverted Triangle</span>
          <span>IndexedDB + Web Audio</span>
        </div>
      </footer>
    </>
  );
}
