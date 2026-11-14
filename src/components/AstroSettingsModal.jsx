import React, { useState, useEffect, useMemo } from 'react';
import { TRI_RING_LAYOUT, formatKeyCode } from '../config/layout.config.js';
import {
  Button,
  Toggle,
  Slider,
  Dropdown,
  Modal,
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
  const [activeCategory, setActiveCategory] = useState('gameplay');
  const [searchQuery, setSearchQuery] = useState('');
  const [listeningSlot, setListeningSlot] = useState(null);
  const [uiSoundsActive, setUiSoundsActive] = useState(isUISoundEnabled());

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
      toast.success(`Đã gán phím ${e.code} cho ${laneKey === 'ring' ? 'Ring (Space)' : `Lane ${laneKey}`}`);
    };

    window.addEventListener('keydown', handleKeyCapture, true);
    return () => window.removeEventListener('keydown', handleKeyCapture, true);
  }, [listeningSlot, isOpen, settings, onUpdateSettings]);

  if (!isOpen) return null;

  const update = (key, val) => onUpdateSettings({ ...settings, [key]: val });

  const categories = [
    { id: 'general', label: 'General', icon: '⚙' },
    { id: 'gameplay', label: 'Gameplay', icon: '🎯' },
    { id: 'audio', label: 'Audio', icon: '🔊' },
    { id: 'input', label: 'Input', icon: '⌨' },
    { id: 'graphics', label: 'Graphics', icon: '🖼' },
    { id: 'account', label: 'Account', icon: '👤' }
  ];

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
    toast.success('Đã xuất file cài đặt JSON thành công!');
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
        toast.success('Đã nhập cài đặt từ file thành công!');
      } catch (err) {
        toast.error('File cài đặt không hợp lệ: ' + err.message);
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
      toast.info('Đã khôi phục phím bấm mặc định.');
    } else if (activeCategory === 'audio') {
      onUpdateSettings({
        ...settings,
        masterVol: 100,
        musicVol: 85,
        hitVol: 95,
        uiVol: 80,
        userOffset: 0
      });
      toast.info('Đã khôi phục âm lượng & offset mặc định.');
    } else if (activeCategory === 'graphics') {
      onUpdateSettings({
        ...settings,
        backgroundDim: 0.75,
        backgroundBlur: 0.2,
        showVideo: true,
        showFpsCounter: false
      });
      toast.info('Đã khôi phục đồ họa mặc định.');
    } else if (activeCategory === 'gameplay') {
      onUpdateSettings({
        ...settings,
        noteSpeed: 10.0,
        countdownBeforeStart: true,
        showRayGuides: true,
        showURBar: true,
        showKeyOverlay: true,
        showCombo: true
      });
      toast.info('Đã khôi phục cài đặt gameplay.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="max-w-4xl"
      className="p-0 overflow-hidden h-[620px]"
    >
      <div className="flex h-full select-none">
        {/* LEFT SIDEBAR */}
        <div className="w-56 bg-[#111122] border-r border-white/[0.06] p-4 flex flex-col justify-between shrink-0">
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="px-2 pt-1">
              <span className="text-xs font-black tracking-widest text-[#ff66ab] uppercase">
                Settings
              </span>
              <h2 className="text-lg font-black text-white font-torus">TÙY CHỈNH</h2>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c849c] text-xs">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab]/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#7c849c] outline-none"
              />
            </div>

            {/* Category Navigation Pills */}
            <nav className="flex flex-col gap-1 mt-2">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      playSelect();
                      setActiveCategory(cat.id);
                    }}
                    onMouseEnter={() => !isActive && playHover()}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_2px_10px_rgba(255,102,171,0.35)]'
                        : 'text-[#8890a4] hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Backup & Export actions */}
          <div className="pt-4 border-t border-white/[0.06] flex flex-col gap-2">
            <Button variant="ghost" size="sm" onClick={handleExportSettings} icon="💾">
              Export Settings
            </Button>
            <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-[#b8c0d4] text-xs font-bold cursor-pointer transition-colors">
              <span>📂</span>
              <span>Import Settings</span>
              <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
            </label>
          </div>
        </div>

        {/* RIGHT CONTENT AREA */}
        <div className="flex-1 bg-[#1a1a2e]/90 flex flex-col overflow-hidden">
          {/* Header of Content */}
          <div className="h-14 px-6 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#16162a]/95">
            <div className="flex items-center gap-2">
              <span className="text-base">{categories.find((c) => c.id === activeCategory)?.icon}</span>
              <h3 className="font-torus font-black text-base text-white uppercase tracking-wider">
                {categories.find((c) => c.id === activeCategory)?.label}
              </h3>
            </div>

            <Button variant="ghost" size="sm" onClick={handleResetCategory} icon="↺">
              Reset mục này
            </Button>
          </div>

          {/* Body with controls */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {/* GENERAL */}
            {activeCategory === 'general' && (
              <div className="space-y-4">
                <Toggle
                  checked={uiSoundsActive}
                  onChange={(val) => {
                    setUiSoundsActive(val);
                    setUISoundEnabled(val);
                    toast.info(`Âm thanh UI: ${val ? 'BẬT' : 'TẮT'}`);
                  }}
                  label="Âm thanh giao diện (UI Sounds)"
                  description="Phát hiệu ứng âm thanh tổng hợp Web Audio khi hover, click, gạt toggle hoặc trượt slider"
                />

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-[#b8c0d4] space-y-2">
                  <div className="font-bold text-white">Ngôn ngữ hiển thị (Language)</div>
                  <p>Hệ thống hiện đang hỗ trợ toàn diện Tiếng Việt (Vietnamese) với phông chữ Torus / Nunito / Be Vietnam Pro sắc nét.</p>
                </div>
              </div>
            )}

            {/* GAMEPLAY */}
            {activeCategory === 'gameplay' && (
              <div className="space-y-5">
                <Slider
                  label="Tốc độ nốt bay (Note Speed)"
                  value={settings.noteSpeed || 10.0}
                  min={5.0}
                  max={15.0}
                  step={0.1}
                  formatValue={(v) => `${v.toFixed(1)}x`}
                  onChange={(val) => update('noteSpeed', val)}
                />

                <Toggle
                  checked={settings.countdownBeforeStart !== false}
                  onChange={(val) => update('countdownBeforeStart', val)}
                  label="Đếm ngược 3-2-1 trước khi bắt đầu bài hát"
                  description="Hiển thị đếm nhịp 3-2-1 trước khi nốt nhạc đầu tiên xuất hiện để người chơi chuẩn bị"
                />

                <Toggle
                  checked={settings.showRayGuides !== false}
                  onChange={(val) => update('showRayGuides', val)}
                  label="Hiện vạch tia định hướng (Ray Guides)"
                  description="Hiển thị các đường tia mỏng nối từ tâm ra các ô judgement"
                />

                <Toggle
                  checked={settings.showURBar !== false}
                  onChange={(val) => update('showURBar', val)}
                  label="Hiện thanh Unstable Rate (UR Bar)"
                  description="Hiển thị biểu đồ độ lệch ms phán định ở góc dưới màn hình"
                />

                <Toggle
                  checked={settings.showKeyOverlay !== false}
                  onChange={(val) => update('showKeyOverlay', val)}
                  label="Hiện Key Overlay (Bộ đếm phím bấm)"
                  description="Hiển thị panel dọc đếm số lượt nhấn phím từng lane bên cạnh phải"
                />

                <Toggle
                  checked={settings.showCombo !== false}
                  onChange={(val) => update('showCombo', val)}
                  label="Hiện Combo đếm nhịp ở góc dưới"
                  description="Hiển thị chữ số combo nổi bật khi đánh trúng liên tiếp"
                />
              </div>
            )}

            {/* AUDIO */}
            {activeCategory === 'audio' && (
              <div className="space-y-5">
                <Slider
                  label="Âm lượng tổng (Master Volume)"
                  value={settings.masterVol !== undefined ? settings.masterVol : 100}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => update('masterVol', val)}
                />

                <Slider
                  label="Âm lượng nhạc nền (Music Volume)"
                  value={settings.musicVol !== undefined ? settings.musicVol : 85}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => update('musicVol', val)}
                />

                <Slider
                  label="Âm lượng Hitsound (Hiệu ứng gõ phím)"
                  value={settings.hitVol !== undefined ? settings.hitVol : 95}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => update('hitVol', val)}
                />

                <Slider
                  label="Độ lệch âm thanh cá nhân (Audio Offset)"
                  value={settings.userOffset || 0}
                  min={-200}
                  max={200}
                  step={5}
                  formatValue={(v) => `${v > 0 ? `+${v}` : v} ms`}
                  onChange={(val) => update('userOffset', val)}
                />

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">Hiệu chuẩn độ trễ âm thanh</div>
                    <div className="text-[11px] text-[#7c849c]">Bấm nút kiểm tra để nghe thử nhịp metronome</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => playClick()}>
                    Thử nhịp (Test Tick)
                  </Button>
                </div>
              </div>
            )}

            {/* INPUT / KEYBINDS */}
            {activeCategory === 'input' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#7c849c]">
                    Nhấp vào ô phím để bắt đầu gán phím mới (nhấn Esc để huỷ):
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleResetCategory} icon="↺">
                    Phím mặc định
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
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-[#b8c0d4]">{laneDef.label}</span>
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
                                className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer ${
                                  isThisSlot
                                    ? 'bg-[#ff66ab] text-white animate-pulse shadow-[0_0_10px_#ff66ab]'
                                    : 'bg-[#111122] hover:bg-[#222238] text-white border border-white/[0.1]'
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
                  label="Làm tối hình nền (Background Dim)"
                  value={Math.round((settings.backgroundDim !== undefined ? settings.backgroundDim : 0.75) * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => update('backgroundDim', val / 100)}
                />

                <Slider
                  label="Độ mờ hậu cảnh (Background Blur)"
                  value={Math.round((settings.backgroundBlur !== undefined ? settings.backgroundBlur : 0.2) * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(val) => update('backgroundBlur', val / 100)}
                />

                <Toggle
                  checked={settings.showVideo !== false}
                  onChange={(val) => update('showVideo', val)}
                  label="Bật video nền (Background Video)"
                  description="Tự động đồng bộ và phát video kèm theo map nếu có"
                />

                <Toggle
                  checked={Boolean(settings.showFpsCounter)}
                  onChange={(val) => update('showFpsCounter', val)}
                  label="Hiện bộ đếm FPS & khung hình"
                  description="Hiển thị FPS counter thời gian thực ở góc màn hình"
                />
              </div>
            )}

            {/* ACCOUNT */}
            {activeCategory === 'account' && (
              <div className="space-y-4">
                {currentUser ? (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{currentUser.name || currentUser.username}</div>
                      <div className="text-xs text-[#7c849c] font-mono">{currentUser.email || `@${currentUser.username}`}</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={onLogout}>
                      Đăng xuất
                    </Button>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center space-y-3">
                    <p className="text-xs text-[#b8c0d4]">
                      Đăng nhập để đồng bộ điểm số lên Bảng xếp hạng toàn cầu và lưu cài đặt trên đám mây.
                    </p>
                    <Button variant="primary" size="md" onClick={onOpenAuthModal}>
                      Đăng nhập / Đăng ký
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
