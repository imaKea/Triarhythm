import React, { useState, useEffect } from 'react';
import { TRI_RING_LAYOUT, formatKeyCode } from '../config/layout.config.js';

export default function AstroSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentUser,
  onOpenAuthModal,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('gameplay');
  const [listeningSlot, setListeningSlot] = useState(null); // { laneKey: '0', index: 0 }

  const currentKeybinds = settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds;

  // Lắng nghe phím gán mới khi đang ở trạng thái listeningSlot
  useEffect(() => {
    if (!listeningSlot || !isOpen) return;

    const handleKeyCapture = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setListeningSlot(null);
        return;
      }

      const { laneKey, index } = listeningSlot;
      const updated = {
        ...(settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds)
      };
      const existing = [...(updated[laneKey] || [])];

      existing[index] = e.code;
      updated[laneKey] = [...new Set(existing)];

      onUpdateSettings({ ...settings, customKeybinds: updated });
      setListeningSlot(null);
    };

    window.addEventListener('keydown', handleKeyCapture, true);
    return () => {
      window.removeEventListener('keydown', handleKeyCapture, true);
    };
  }, [listeningSlot, isOpen, settings, onUpdateSettings]);

  if (!isOpen) return null;

  const update = (key, val) => {
    onUpdateSettings({ ...settings, [key]: val });
  };

  const handleResetKeybinds = () => {
    onUpdateSettings({
      ...settings,
      customKeybinds: { ...TRI_RING_LAYOUT.defaultKeybinds }
    });
    setListeningSlot(null);
  };

  const handleAddSlot = (laneKey) => {
    const updated = { ...(settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds) };
    const existing = [...(updated[laneKey] || [])];
    existing.push('KeyZ');
    updated[laneKey] = existing;
    onUpdateSettings({ ...settings, customKeybinds: updated });
    setListeningSlot({ laneKey, index: existing.length - 1 });
  };

  const handleRemoveKey = (e, laneKey, idx) => {
    e.stopPropagation();
    const updated = { ...(settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds) };
    const existing = [...(updated[laneKey] || [])];
    if (existing.length > 1) {
      existing.splice(idx, 1);
      updated[laneKey] = existing;
      onUpdateSettings({ ...settings, customKeybinds: updated });
    }
  };

  const tabs = [
    { id: 'gameplay', label: 'Gameplay', icon: '🎮' },
    { id: 'audio', label: 'Audio', icon: '🎵' },
    { id: 'keybinds', label: 'Keybinds', icon: '⌨️' },
    { id: 'account', label: 'Account', icon: '👤' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none font-sans">
      <div className="w-full max-w-2xl bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[580px]">
        {/* RhythmTyper Settings Header */}
        <div className="h-16 px-6 bg-[#0f172a] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Settings
            </h2>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-[#1e293b] p-1 rounded-xl border border-white/10 text-xs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setListeningSlot(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-sm">
          {/* TAB 1: GAMEPLAY */}
          {activeTab === 'gameplay' && (
            <div className="flex flex-col gap-5">
              {/* Note Speed */}
              <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-white">Scroll Speed (Note Speed)</span>
                  <span className="text-indigo-400 font-mono font-bold text-base">
                    {Number(settings.noteSpeed || 10).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="15.0"
                  step="0.5"
                  value={settings.noteSpeed || 10}
                  onChange={(e) => update('noteSpeed', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span>2.0 (Slow)</span>
                  <span>10.0 (Standard)</span>
                  <span>15.0 (Extreme)</span>
                </div>
              </div>

              {/* Background Dim */}
              <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-white">Background Dim</span>
                  <span className="text-indigo-400 font-mono font-bold text-base">
                    {Math.round((settings.backgroundDim || 0.75) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.backgroundDim || 0.75}
                  onChange={(e) => update('backgroundDim', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* User Audio Offset */}
              <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-white">Audio Offset Calibration</span>
                  <span className="text-indigo-400 font-mono font-bold text-base">
                    {(settings.userOffset || 0) > 0 ? `+${settings.userOffset}ms` : `${settings.userOffset || 0}ms`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={settings.userOffset || 0}
                  onChange={(e) => update('userOffset', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span>-200ms (Earlier)</span>
                  <span>0ms</span>
                  <span>+200ms (Later)</span>
                </div>
              </div>

              {/* Visual Ray Guides & Autoplay */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#0f172a]/60 border border-white/10 cursor-pointer hover:bg-[#0f172a] transition-colors">
                  <span className="font-semibold text-white text-xs">Visual Ray Guides</span>
                  <input
                    type="checkbox"
                    checked={settings.showRayGuides !== false}
                    onChange={(e) => update('showRayGuides', e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#0f172a]/60 border border-white/10 cursor-pointer hover:bg-[#0f172a] transition-colors">
                  <span className="font-semibold text-white text-xs">Autoplay Mode</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.isAutoplay)}
                    onChange={(e) => update('isAutoplay', e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIO */}
          {activeTab === 'audio' && (
            <div className="flex flex-col gap-5">
              {/* Music Volume */}
              <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-white">Music Volume</span>
                  <span className="text-indigo-400 font-mono font-bold text-base">
                    {settings.musicVol ?? 85}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.musicVol ?? 85}
                  onChange={(e) => update('musicVol', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Hit Sound Volume */}
              <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-white">Hitsound Volume</span>
                  <span className="text-indigo-400 font-mono font-bold text-base">
                    {settings.hitVol ?? 95}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.hitVol ?? 95}
                  onChange={(e) => update('hitVol', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Hitsounds notice */}
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 leading-relaxed">
                ℹ️ <strong>Sound Effects:</strong> Note Ring phát âm thanh chuẩn <code className="text-white">SE_GAME_BREAKSLIDE</code>, Note Ring Hold phát <code className="text-white">SE_GAME_SCR_TOUCH_CENTER</code> (chỉ phát khi chạm đầu, không lặp lại khi kết thúc).
              </div>
            </div>
          )}

          {/* TAB 3: KEYBINDS */}
          {activeTab === 'keybinds' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">Keybindings (9 Lanes + Center Ring)</h4>
                  <p className="text-xs text-slate-400">Click a button, then press the desired keyboard key to remap.</p>
                </div>
                <button
                  onClick={handleResetKeybinds}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              {listeningSlot && (
                <div className="p-3 rounded-xl bg-indigo-600/30 border border-indigo-400 text-center text-xs font-semibold text-indigo-200 animate-pulse">
                  Press any key to assign to {listeningSlot.laneKey === 'ring' ? 'Center Ring (Space)' : `Lane ${listeningSlot.laneKey}`}... (Press Esc to cancel)
                </div>
              )}

              {/* Keybinds Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Hàng 1 (Top Edge) */}
                <div className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Top Edge (Hàng số)
                </div>
                {['0', '1', '2'].map((laneKey) => {
                  const codes = currentKeybinds[laneKey] || [];
                  const label = laneKey === '0' ? 'Lane 0 (Phím 4·5)' : laneKey === '1' ? 'Lane 1 (Phím 6·7)' : 'Lane 2 (Phím 8·9)';
                  return (
                    <div key={laneKey} className="p-3 bg-[#0f172a]/60 rounded-xl border border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end max-w-[200px]">
                        {codes.slice(0, 2).map((code, idx) => {
                          const isListening = listeningSlot?.laneKey === laneKey && listeningSlot?.index === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => setListeningSlot({ laneKey, index: idx })}
                              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                                isListening
                                  ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/50'
                                  : 'bg-[#2a2a3e] text-white border-white/10 hover:border-indigo-400'
                              }`}
                            >
                              {formatKeyCode(code)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Phím Chữ 2 Cạnh Bên */}
                <div className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                  Side Buttons (Phím chữ R, I, F, J, V, N)
                </div>
                {[
                  { key: '3', label: 'Lane 3 (Phím R)' },
                  { key: '6', label: 'Lane 6 (Phím I)' },
                  { key: '4', label: 'Lane 4 (Phím F)' },
                  { key: '7', label: 'Lane 7 (Phím J)' },
                  { key: '5', label: 'Lane 5 (Phím V)' },
                  { key: '8', label: 'Lane 8 (Phím N)' }
                ].map(({ key, label }) => {
                  const codes = currentKeybinds[key] || [];
                  return (
                    <div key={key} className="p-3 bg-[#0f172a]/60 rounded-xl border border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end max-w-[200px]">
                        {codes.slice(0, 2).map((code, idx) => {
                          const isListening = listeningSlot?.laneKey === key && listeningSlot?.index === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => setListeningSlot({ laneKey: key, index: idx })}
                              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                                isListening
                                  ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/50'
                                  : 'bg-[#2a2a3e] text-white border-white/10 hover:border-indigo-400'
                              }`}
                            >
                              {formatKeyCode(code)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Center Ring (Spacebar) */}
                <div className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                  Center Ring &amp; Slides (Spacebar)
                </div>
                <div className="col-span-2 p-3 bg-[#0f172a]/60 rounded-xl border border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Nốt Ring / Slides / Touch</span>
                  <div className="flex items-center gap-1.5">
                    {(currentKeybinds.ring || ['Space']).map((code, idx) => {
                      const isListening = listeningSlot?.laneKey === 'ring' && listeningSlot?.index === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setListeningSlot({ laneKey: 'ring', index: idx })}
                          className={`px-4 py-1 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                            isListening
                              ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/50'
                              : 'bg-[#2a2a3e] text-white border-white/10 hover:border-indigo-400'
                          }`}
                        >
                          {formatKeyCode(code)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-4">
              <div className="bg-[#0f172a]/60 p-5 rounded-xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=guest'}
                    alt=""
                    className="w-12 h-12 rounded-full border border-white/10"
                  />
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {currentUser?.name || currentUser?.username || 'Guest Player'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {currentUser?.email || 'Not signed in'}
                    </p>
                    <p className="text-xs text-indigo-400 font-bold mt-0.5">
                      ★ Rating: {Number(currentUser?.rating || 0).toFixed(2)} PP
                    </p>
                  </div>
                </div>

                {currentUser ? (
                  <button
                    onClick={onLogout}
                    className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuthModal}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Sign In / Register
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#0f172a]/40 border border-white/10 text-xs text-slate-400 leading-relaxed">
                Đăng nhập tài khoản giúp bạn lưu toàn bộ điểm số, độ chính xác (accuracy), combo và bảng xếp hạng trực tiếp vào <strong>MySQL Database</strong>.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-6 bg-[#0f172a] border-t border-white/10 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
