import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TRI_RING_LAYOUT, formatKeyCode } from '../config/layout.config.js';
import {
  Button,
  Toggle,
  Slider,
  Dropdown,
  Modal,
  SlideBar,
  toast,
  playHover,
  playClick,
  playSelect,
  isUISoundEnabled,
  setUISoundEnabled
} from '../ui/index.js';

export default function AstroSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentUser,
  onOpenAuthModal,
  onLogout
}) {
  if (!isOpen) return null;

  const [activeCategory, setActiveCategory] = useState('gameplay');
  const [searchQuery, setSearchQuery] = useState('');
  const [listeningSlot, setListeningSlot] = useState(null);
  const [uiSoundsActive, setUiSoundsActive] = useState(isUISoundEnabled());
  const sliderDebounceRef = useRef(null);

  // Keybind capturing logic
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
      const updatedKeybinds = { ...(settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds) };
      const existing = [...(updatedKeybinds[laneKey] || [])];
      existing[index] = e.code;
      updatedKeybinds[laneKey] = [...new Set(existing)];

      onUpdateSettings({ ...settings, customKeybinds: updatedKeybinds });
      setListeningSlot(null);
      toast.success(`Assigned key ${e.code} to ${laneKey === 'ring' ? 'Ring (Space)' : `Lane ${laneKey}`}`);
    };

    window.addEventListener('keydown', handleKeyCapture, true);
    return () => window.removeEventListener('keydown', handleKeyCapture, true);
  }, [listeningSlot, isOpen, settings, onUpdateSettings]);

  const update = useCallback((key, val) => {
    onUpdateSettings({ ...settings, [key]: val });
  }, [settings, onUpdateSettings]);

  // Debounced update for sliders (chỉ gọi khi dừng kéo 150ms)
  const updateDebounced = useCallback((key, val) => {
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    sliderDebounceRef.current = setTimeout(() => {
      onUpdateSettings({ ...settings, [key]: val });
    }, 150);
  }, [settings, onUpdateSettings]);

  const categories = useMemo(
    () => [
    { id: 'general', label: 'General', icon: '⚙' },
    { id: 'gameplay', label: 'Gameplay', icon: '🎯' },
    { id: 'audio', label: 'Audio', icon: '🔊' },
    { id: 'input', label: 'Input', icon: '⌨' },
    { id: 'graphics', label: 'Graphics', icon: '🖼' },
    { id: 'account', label: 'Account', icon: '👤' }
  ],
    []
  );

  // Export settings to JSON
  const handleExportSettings = () => {
    playClick();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'triarhythm-settings.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Exported settings JSON successfully!');
  };

  // Import settings from JSON
  const handleImportSettings = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        onUpdateSettings({ ...settings, ...imported });
        toast.success('Imported settings from file successfully!');
      } catch (err) {
        toast.error('Invalid settings file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset category defaults
  const handleResetCategory = () => {
    playClick();
    if (activeCategory === 'input') {
      onUpdateSettings({ ...settings, customKeybinds: { ...TRI_RING_LAYOUT.defaultKeybinds } });
      toast.info('Restored default keybinds.');
    } else if (activeCategory === 'audio') {
      onUpdateSettings({
        ...settings,
        masterVol: 100,
        musicVol: 85,
        hitVol: 95,
        uiVol: 80,
        userOffset: 0
      });
      toast.info('Restored default audio volumes & offset.');
    } else if (activeCategory === 'graphics') {
      onUpdateSettings({
        ...settings,
        backgroundDim: 0.75,
        backgroundBlur: 0.2,
        showVideo: true,
        showFpsCounter: false
      });
      toast.info('Restored graphics defaults.');
    } else if (activeCategory === 'gameplay') {
      onUpdateSettings({
        ...settings,
        noteSpeed: 10.0,
        ringNoteSpeed: 10.0,
        maimaiSpinAssist: true,
        countdownBeforeStart: true,
        showRayGuides: true,
        showURBar: true,
        showKeyOverlay: true,
        showCombo: true
      });
      toast.info('Restored gameplay settings defaults.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      maxWidth="max-w-5xl"
      className="p-0 overflow-hidden max-h-[calc(100dvh-2rem)]"
    >
      <div className="flex h-full min-h-0 flex-col sm:flex-row select-none bg-white">
        {/* LEFT SIDEBAR */}
        <div className="w-full sm:w-60 max-h-none sm:max-h-full overflow-y-auto sm:overflow-visible bg-[#fffafc] border-b sm:border-b-0 sm:border-r border-[#f3dbe4] p-4 sm:p-6 flex flex-col shrink-0">
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="px-2 pt-1">
              <span className="text-xs font-black tracking-widest text-[#ff4d80] uppercase flex items-center gap-1">
                <span>🎀</span>
                <span>Settings</span>
              </span>
              <h2 className="text-lg font-black text-[#5b2a47] font-torus flex items-center gap-1.5">
                <span>🐰 SETTINGS</span>
              </h2>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ff4d80] text-xs">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings... 🎀"
                className="w-full bg-white border border-[#f3dbe4] focus:border-[#ff4d80] focus:shadow-[0_2px_10px_rgba(255,77,128,0.2)] rounded-2xl pl-8 pr-3 py-1.5 text-xs text-[#5b2a47] placeholder-[#a8556f] outline-none transition-all font-bold"
              />
            </div>

            {/* Category Navigation: Vertical on desktop, Smooth SlideBar on mobile */}
            <div className="w-full min-w-0 mt-2">
              <div className="sm:hidden w-full">
                <SlideBar itemGap="gap-1.5" autoCenterActive={true}>
                  {categories.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        data-active={isActive ? "true" : "false"}
                        onClick={() => {
                          playSelect();
                          setActiveCategory(cat.id);
                        }}
                        className={`min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                          isActive
                            ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_2px_10px_rgba(255,77,128,0.25)] scale-[1.02]'
                            : 'text-[#5b2a47] bg-white border border-[#f3dbe4] hover:bg-[#fff0f4] hover:text-[#ff4d80]'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </SlideBar>
              </div>

              <nav className="hidden sm:flex sm:flex-col gap-1">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      data-active={isActive ? "true" : "false"}
                      onClick={() => {
                        playSelect();
                        setActiveCategory(cat.id);
                      }}
                      onMouseEnter={() => !isActive && playHover()}
                      className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                        isActive
                          ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_2px_10px_rgba(255,77,128,0.25)] scale-[1.02]'
                          : 'text-[#5b2a47] hover:bg-[#fff0f4] hover:text-[#ff4d80]'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom Backup & Export actions */}
          <div className="pt-4 border-t border-[#f3dbe4] flex flex-col gap-2">
            <Button variant="ghost" size="sm" onClick={handleExportSettings} icon="💾">
              Export Settings
            </Button>
            <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#fff0f4] text-[#5b2a47] border border-[#f3dbe4] text-xs font-bold cursor-pointer transition-colors shadow-sm">
              <span>📂</span>
              <span>Import Settings</span>
              <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
            </label>
          </div>
        </div>

        {/* RIGHT CONTENT AREA */}
        <div className="flex-1 min-w-0 min-h-0 bg-white/95 flex flex-col overflow-hidden">
          {/* Header of Content */}
          <div className="h-14 px-6 border-b border-[#f3dbe4] flex items-center justify-between shrink-0 bg-[#fff8fa]">
            <div className="flex items-center gap-2">
              <span className="text-base">{categories.find((c) => c.id === activeCategory)?.icon}</span>
              <h3 className="font-torus font-black text-base text-[#5b2a47] uppercase tracking-wider">
                {categories.find((c) => c.id === activeCategory)?.label}
              </h3>
            </div>

            <Button variant="ghost" size="sm" onClick={handleResetCategory} icon="↺">
              Reset this section
            </Button>
          </div>

          {/* Body with controls */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
            {/* GENERAL */}
            {activeCategory === 'general' && (
              <div className="space-y-4">
                <Toggle
                  checked={uiSoundsActive}
                  onChange={(val) => {
                    setUiSoundsActive(val);
                    setUISoundEnabled(val);
                    toast.info(`UI Sounds: ${val ? 'ON' : 'OFF'}`);
                  }}
                  label="UI Sound Effects (UI Sounds)"
                  description="Play Web Audio sound effects on hover, click, toggle, and slider actions"
                />

                <div className="p-4 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] text-xs text-[#5b2a47] space-y-2">
                  <div className="font-bold text-[#5b2a47]">Display Language</div>
                  <p>English is currently active across the application.</p>
                </div>
              </div>
            )}

            {/* GAMEPLAY */}
            {activeCategory === 'gameplay' && (
              <div className="space-y-5">
                <Slider
                  label="Note Speed"
                  value={settings.noteSpeed || 10.0}
                  min={5.0}
                  max={15.0}
                  step={0.1}
                  formatValue={(v) => `${v.toFixed(1)}x`}
                  onChange={(val) => update('noteSpeed', val)}
                />

                <Slider
                  label="Ring Note Speed"
                  value={settings.ringNoteSpeed || settings.noteSpeed || 10.0}
                  min={1.0}
                  max={15.0}
                  step={0.1}
                  formatValue={(v) => `${v.toFixed(1)}x`}
                  onChange={(val) => update('ringNoteSpeed', val)}
                />

                <Toggle
                  checked={settings.maimaiSpinAssist !== false}
                  onChange={(val) => update('maimaiSpinAssist', val)}
                  label="Maimai Spin Assist"
                  description="When playing Maimai charts, middle keys 6 & 7 can activate keys 5 & 8 (Lanes 0 & 2) for smooth spin patterns"
                />

                <Toggle
                  checked={(settings.enableStartCountdown ?? settings.countdownBeforeStart) !== false}
                  onChange={(val) => {
                    update('enableStartCountdown', val);
                    update('countdownBeforeStart', val);
                  }}
                  label="3-2-1 Countdown before track starts"
                  description="Display a 3-2-1 count-in before the first note appears so you can prepare"
                />

                <Toggle
                  checked={settings.showRayGuides !== false}
                  onChange={(val) => update('showRayGuides', val)}
                  label="Show Ray Guides"
                  description="Display thin ray lines connecting from origin to judgement zones"
                />

                <Toggle
                  checked={settings.showURBar !== false}
                  onChange={(val) => update('showURBar', val)}
                  label="Show Unstable Rate (UR Bar)"
                  description="Display judgement timing offset distribution at bottom of screen"
                />

                <Toggle
                  checked={settings.showKeyOverlay !== false}
                  onChange={(val) => update('showKeyOverlay', val)}
                  label="Show Key Overlay"
                  description="Display vertical panel counting key presses per lane on the right"
                />

                <Toggle
                  checked={settings.showCombo !== false}
                  onChange={(val) => update('showCombo', val)}
                  label="Show Combo Counter"
                  description="Display combo counter when landing consecutive hits"
                />
              </div>
            )}

            {/* AUDIO */}
            {activeCategory === 'audio' && (
              <div className="space-y-5">
                <Slider
                  label="Master Volume"
                  value={settings.masterVol !== undefined ? settings.masterVol : 100}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => updateDebounced('masterVol', val)}
                />

                <Slider
                  label="Music Volume"
                  value={settings.musicVol !== undefined ? settings.musicVol : 85}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => updateDebounced('musicVol', val)}
                />

                <Slider
                  label="Hitsound Volume"
                  value={settings.hitVol !== undefined ? settings.hitVol : 95}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => updateDebounced('hitVol', val)}
                />

                <Slider
                  label="Audio Offset"
                  value={settings.userOffset || 0}
                  min={-200}
                  max={200}
                  step={5}
                  formatValue={(v) => `${v > 0 ? `+${v}` : v} ms`}
                  onChange={(val) => updateDebounced('userOffset', val)}
                />

                <div className="p-3.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-[#5b2a47]">Audio Latency Calibration</div>
                    <div className="text-[11px] text-[#a8556f]">Click test button to hear metronome tick</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => playClick()}>
                    Test Tick
                  </Button>
                </div>
              </div>
            )}

            {/* INPUT / KEYBINDS */}
            {activeCategory === 'input' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#a8556f] font-bold">
                    Click a slot to rebind (press Esc to cancel):
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleResetCategory} icon="↺">
                    Default Keys
                  </Button>
                </div>

                {/* Lanes Table */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { key: 0, label: 'Lane 0 (Top-Left)' },
                    { key: 1, label: 'Lane 1 (Top-Mid)' },
                    { key: 2, label: 'Lane 2 (Top-Right)' },
                    { key: 3, label: 'Lane 3 (Left-Upper)' },
                    { key: 4, label: 'Lane 4 (Left-Mid)' },
                    { key: 5, label: 'Lane 5 (Left-Lower)' },
                    { key: 6, label: 'Lane 6 (Right-Upper)' },
                    { key: 7, label: 'Lane 7 (Right-Mid)' },
                    { key: 8, label: 'Lane 8 (Right-Lower)' },
                    { key: 'ring', label: 'Ring Note (Space)' }
                  ].map((laneDef) => {
                    const currentKeys = (settings.customKeybinds || TRI_RING_LAYOUT.defaultKeybinds)[laneDef.key] || [];
                    const isCapturing = listeningSlot?.laneKey === laneDef.key;

                    return (
                      <div
                        key={laneDef.key}
                        className="p-3 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-[#5b2a47]">{laneDef.label}</span>
                        <div className="flex gap-1.5">
                          {currentKeys.slice(0, 2).map((kCode, kIdx) => {
                            const isThisSlot = isCapturing && listeningSlot?.index === kIdx;
                            return (
                              <button
                                key={kIdx}
                                type="button"
                                onClick={() => {
                                  playClick();
                                  setListeningSlot({ laneKey: laneDef.key, index: kIdx });
                                }}
                                className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${
                                  isThisSlot
                                    ? 'bg-[#ff4d80] text-white animate-pulse shadow-[0_0_10px_#ff4d80]'
                                    : 'bg-white hover:bg-[#fff0f4] text-[#5b2a47] border border-[#f3dbe4]'
                                }`}
                              >
                                {isThisSlot ? 'Press key...' : formatKeyCode(kCode)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GRAPHICS */}
            {activeCategory === 'graphics' && (
              <div className="space-y-5">
                <Slider
                  label="Background Dim"
                  value={Math.round((settings.backgroundDim !== undefined ? settings.backgroundDim : 0.75) * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => updateDebounced('backgroundDim', val / 100)}
                />

                <Slider
                  label="Background Blur"
                  value={Math.round((settings.backgroundBlur !== undefined ? settings.backgroundBlur : 0.2) * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => updateDebounced('backgroundBlur', val / 100)}
                />

                <Toggle
                  checked={settings.showVideo !== false}
                  onChange={(val) => update('showVideo', val)}
                  label="Background Video"
                  description="Automatically synchronize and play background video if available"
                />

                <Toggle
                  checked={Boolean(settings.showFpsCounter)}
                  onChange={(val) => update('showFpsCounter', val)}
                  label="Show FPS Counter"
                  description="Display real-time frame rate in corner of screen"
                />
              </div>
            )}

            {/* ACCOUNT */}
            {activeCategory === 'account' && (
              <div className="space-y-4">
                {currentUser ? (
                  <div className="p-4 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-[#5b2a47]">{currentUser.name || currentUser.username}</div>
                      <div className="text-xs text-[#a8556f] font-mono">{currentUser.email || `@${currentUser.username}`}</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={onLogout}>
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] text-center space-y-3">
                    <p className="text-xs text-[#5b2a47]">
                      Sign in to sync your scores to the Global Leaderboard and store cloud settings.
                    </p>
                    <Button variant="primary" size="md" onClick={onOpenAuthModal}>
                      Sign In / Register
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
