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
  const [listeningSlot, setListeningSlot] = useState(null);

  const currentKeybinds = settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds;

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
      const updated = { ...(settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds) };
      const existing = [...(updated[laneKey] || [])];
      existing[index] = e.code;
      updated[laneKey] = [...new Set(existing)];
      onUpdateSettings({ ...settings, customKeybinds: updated });
      setListeningSlot(null);
    };

    window.addEventListener('keydown', handleKeyCapture, true);
    return () => window.removeEventListener('keydown', handleKeyCapture, true);
  }, [listeningSlot, isOpen, settings, onUpdateSettings]);

  if (!isOpen) return null;

  const update = (key, val) => onUpdateSettings({ ...settings, [key]: val });

  const handleResetKeybinds = () => {
    onUpdateSettings({ ...settings, customKeybinds: { ...TRI_RING_LAYOUT.defaultKeybinds } });
    setListeningSlot(null);
  };

  const tabs = [
    { id: 'gameplay', label: 'Gameplay' },
    { id: 'audio', label: 'Audio' },
    { id: 'keybinds', label: 'Input' },
    { id: 'account', label: 'Account' }
  ];

  const SliderRow = ({ label, value, displayValue, min, max, step, onChange }) => (
    <div className="py-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-sm text-[#ff66ab] font-bold font-mono">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ff66ab] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,102,171,0.5)] [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="w-full max-w-xl bg-[#111122] border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[560px]">
        {/* Header */}
        <div className="h-14 px-5 bg-[#0d0d1a] border-b border-white/[0.04] flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-white">Settings</h2>

          <div className="flex items-center gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setListeningSlot(null); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#ff66ab] text-white shadow-[0_0_10px_rgba(255,102,171,0.3)]'
                    : 'text-[#6b7280] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#6b7280] hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {/* GAMEPLAY */}
          {activeTab === 'gameplay' && (
            <div className="flex flex-col divide-y divide-white/[0.04]">
              <SliderRow
                label="Scroll Speed"
                value={settings.noteSpeed || 10}
                displayValue={Number(settings.noteSpeed || 10).toFixed(1)}
                min="2.0" max="15.0" step="0.5"
                onChange={(e) => update('noteSpeed', parseFloat(e.target.value))}
              />
              <SliderRow
                label="Background Dim"
                value={settings.backgroundDim || 0.75}
                displayValue={`${Math.round((settings.backgroundDim || 0.75) * 100)}%`}
                min="0.0" max="1.0" step="0.05"
                onChange={(e) => update('backgroundDim', parseFloat(e.target.value))}
              />
              <SliderRow
                label="Audio Offset"
                value={settings.userOffset || 0}
                displayValue={`${(settings.userOffset || 0) > 0 ? '+' : ''}${settings.userOffset || 0}ms`}
                min="-200" max="200" step="5"
                onChange={(e) => update('userOffset', parseInt(e.target.value, 10))}
              />

              <div className="py-3 flex gap-3">
                <label className="flex-1 flex items-center justify-between p-3 rounded-xl bg-white/[0.03] cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <span className="text-xs font-semibold text-white">Visual Guides</span>
                  <input
                    type="checkbox"
                    checked={settings.showRayGuides !== false}
                    onChange={(e) => update('showRayGuides', e.target.checked)}
                    className="w-4 h-4 accent-[#ff66ab] cursor-pointer"
                  />
                </label>

                <label className="flex-1 flex items-center justify-between p-3 rounded-xl bg-white/[0.03] cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <span className="text-xs font-semibold text-white">Autoplay</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.isAutoplay)}
                    onChange={(e) => update('isAutoplay', e.target.checked)}
                    className="w-4 h-4 accent-[#ff66ab] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* AUDIO */}
          {activeTab === 'audio' && (
            <div className="flex flex-col divide-y divide-white/[0.04]">
              <SliderRow
                label="Music Volume"
                value={settings.musicVol ?? 85}
                displayValue={`${settings.musicVol ?? 85}%`}
                min="0" max="100" step="1"
                onChange={(e) => update('musicVol', parseInt(e.target.value, 10))}
              />
              <SliderRow
                label="Hitsound Volume"
                value={settings.hitVol ?? 95}
                displayValue={`${settings.hitVol ?? 95}%`}
                min="0" max="100" step="1"
                onChange={(e) => update('hitVol', parseInt(e.target.value, 10))}
              />
            </div>
          )}

          {/* KEYBINDS */}
          {activeTab === 'keybinds' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6b7280]">Click a key to rebind, press Escape to cancel</span>
                <button
                  onClick={handleResetKeybinds}
                  className="px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-[#b8c0d4] transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>

              {listeningSlot && (
                <div className="p-2.5 rounded-xl bg-[#ff66ab]/10 border border-[#ff66ab]/30 text-center text-xs font-semibold text-[#ff66ab] animate-pulse">
                  Press any key for {listeningSlot.laneKey === 'ring' ? 'Ring' : `Lane ${listeningSlot.laneKey}`}...
                </div>
              )}

              {/* Keybind Groups */}
              {[
                { title: 'Top Row', lanes: [
                  { key: '0', label: 'Lane 0' }, { key: '1', label: 'Lane 1' }, { key: '2', label: 'Lane 2' }
                ]},
                { title: 'Side Keys', lanes: [
                  { key: '3', label: 'Lane 3' }, { key: '6', label: 'Lane 6' },
                  { key: '4', label: 'Lane 4' }, { key: '7', label: 'Lane 7' },
                  { key: '5', label: 'Lane 5' }, { key: '8', label: 'Lane 8' }
                ]},
                { title: 'Center Ring', lanes: [
                  { key: 'ring', label: 'Ring / Slides' }
                ]}
              ].map((group) => (
                <div key={group.title}>
                  <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">{group.title}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.lanes.map(({ key, label }) => {
                      const codes = currentKeybinds[key] || [];
                      return (
                        <div key={key} className={`p-2.5 bg-white/[0.02] rounded-lg flex items-center justify-between ${group.lanes.length === 1 ? 'col-span-2' : ''}`}>
                          <span className="text-xs text-[#b8c0d4]">{label}</span>
                          <div className="flex items-center gap-1">
                            {codes.slice(0, 2).map((code, idx) => {
                              const isListening = listeningSlot?.laneKey === key && listeningSlot?.index === idx;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setListeningSlot({ laneKey: key, index: idx })}
                                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                                    isListening
                                      ? 'bg-[#ff66ab] text-white border-[#ff66ab] shadow-[0_0_8px_rgba(255,102,171,0.5)]'
                                      : 'bg-white/[0.04] text-white/80 border-white/[0.06] hover:border-[#ff66ab]/50'
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACCOUNT */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=guest'}
                    alt=""
                    className="w-11 h-11 rounded-full border-2 border-[#ff66ab]/30"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {currentUser?.name || currentUser?.username || 'Guest'}
                    </h4>
                    <p className="text-[11px] text-[#6b7280]">
                      {currentUser?.email || 'Not signed in'}
                    </p>
                    {currentUser && (
                      <p className="text-[11px] text-[#ff66ab] font-bold mt-0.5">
                        {Number(currentUser?.rating || 0).toFixed(0)}pp
                      </p>
                    )}
                  </div>
                </div>

                {currentUser ? (
                  <button
                    onClick={onLogout}
                    className="px-4 py-1.5 rounded-full bg-[#ef5350]/10 hover:bg-[#ef5350]/20 text-[#ef5350] border border-[#ef5350]/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuthModal}
                    className="px-4 py-1.5 rounded-full osu-btn text-xs font-bold cursor-pointer"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-5 bg-[#0d0d1a] border-t border-white/[0.04] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-full osu-btn text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
