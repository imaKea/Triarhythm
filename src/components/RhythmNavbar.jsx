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
    { id: 'SONG_SELECT', label: 'play', icon: '▶' },
    { id: 'LEADERBOARD', label: 'rankings', icon: '★' },
    { id: 'EDITOR', label: 'edit', icon: '✎' },
    ...(currentUser?.role === 'admin' ? [{ id: 'ADMIN', label: 'admin', icon: '🛡️' }] : []),
    { id: 'UI_KIT', label: 'ui kit', icon: '🎨' },
  ];

  return (
    <>
      {/* TOP LAZER NAVBAR */}
      <header className="fixed top-0 left-0 right-0 h-[52px] bg-[#111122]/95 backdrop-blur-xl border-b border-white/[0.08] px-6 flex items-center justify-between z-50 select-none shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        {/* Left: Lazer-style Logo */}
        <div
          onClick={() => {
            playSelect();
            onNavigate('SONG_SELECT');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff66ab] to-[#cc5289] flex items-center justify-center shadow-[0_0_14px_rgba(255,102,171,0.5)] group-hover:shadow-[0_0_22px_rgba(255,102,171,0.8)] group-hover:scale-105 transition-all">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white drop-shadow">
              <polygon points="12,3 22,21 2,21" />
            </svg>
          </div>
          <span className="font-torus font-black text-lg text-white tracking-wider group-hover:text-[#ff66ab] transition-colors">
            triarhythm
          </span>
        </div>

        {/* Center: Navigation Pills */}
        <nav className="flex items-center gap-1 bg-[#1a1a2e]/70 p-1 rounded-full border border-white/[0.04]">
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
                className={`px-5 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_2px_12px_rgba(255,102,171,0.4)]'
                    : 'text-[#8890a4] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => {
              playClick();
              if (onOpenSettings) onOpenSettings();
            }}
            onMouseEnter={() => playHover()}
            className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wide text-[#8890a4] hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>⚙</span>
            <span>settings</span>
          </button>
        </nav>

        {/* Right: User card & controls */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div
                onClick={() => {
                  playClick();
                  if (onOpenProfile) onOpenProfile();
                }}
                className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#ff66ab]/40 transition-all cursor-pointer group"
                title="Xem hồ sơ người chơi"
              >
                <Avatar
                  src={currentUser.avatar}
                  name={currentUser.name || currentUser.username}
                  size="sm"
                  status="online"
                />
                <div className="flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-white group-hover:text-[#ff66ab] transition-colors truncate max-w-[100px]">
                    {currentUser.name || currentUser.username}
                  </span>
                  <span className="text-[10px] text-[#ff66ab] font-mono font-bold mt-0.5">
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
                  className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 flex items-center justify-center text-xs transition-all cursor-pointer shadow-sm"
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
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#ff66ab]/20 hover:bg-[#ff66ab]/30 text-[#ff66ab] border border-[#ff66ab]/30 hover:border-[#ff66ab]/60 transition-all cursor-pointer shadow-[0_0_10px_rgba(255,102,171,0.2)]"
            >
              Đăng nhập / Đăng ký
            </button>
          )}

          {/* Fullscreen Button */}
          <Tooltip content={isFullscreen ? 'Thu nhỏ (F11)' : 'Toàn màn hình (F11)'}>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              {isFullscreen ? '⤢' : '⛶'}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* BOTTOM STATUS BAR */}
      <footer className="fixed bottom-0 left-0 right-0 h-6 bg-[#090914]/90 backdrop-blur-md border-t border-white/[0.04] px-4 flex items-center justify-between text-[10px] text-[#7c849c] z-40 select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#66bb6a] shadow-[0_0_6px_#66bb6a]" />
          <span>Online • Triarhythm v1.2 lazer</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span>TriRing9 Inverted Triangle Layout</span>
          <span>IndexedDB + Web Audio</span>
        </div>
      </footer>
    </>
  );
}
