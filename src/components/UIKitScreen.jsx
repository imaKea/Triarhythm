import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Toggle,
  Slider,
  Dropdown,
  Tabs,
  Modal,
  ConfirmDialog,
  ContextMenu,
  Tooltip,
  Skeleton,
  ProgressBar,
  Avatar,
  StarRating,
  RankBadge,
  toast,
  playHover,
  playClick,
  playBack,
  playSelect,
  playTick,
  isUISoundEnabled,
  setUISoundEnabled
} from '../ui/index.js';

export default function UIKitScreen({ onBack }) {
  // State for interactive widgets
  const [toggleVal1, setToggleVal1] = useState(true);
  const [toggleVal2, setToggleVal2] = useState(false);
  const [sliderVal, setSliderVal] = useState(75);
  const [speedVal, setSpeedVal] = useState(10.5);
  const [selectedDropdown, setSelectedDropdown] = useState('rating');
  const [activeTab, setActiveTab] = useState('general');
  const [soundEnabled, setSoundEnabled] = useState(isUISoundEnabled());

  // Modals & Menus
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [contextMenuState, setContextMenuState] = useState({ isOpen: false, x: 0, y: 0 });

  const handleSoundToggle = (enabled) => {
    setSoundEnabled(enabled);
    setUISoundEnabled(enabled);
    toast.info(`UI Sound: ${enabled ? 'BẬT' : 'TẮT'}`);
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    setContextMenuState({ isOpen: true, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto overscroll-contain custom-scrollbar bg-[#fff5f8] p-3 pb-5 text-[#5b2a47] osu-screen-transition sm:p-4 md:p-5 lg:p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between pb-6 mb-8 border-b border-[#f3dbe4]">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-[#ff4d80] shadow-[0_0_12px_rgba(255,77,128,0.5)]" />
            <h1 className="text-2xl font-black tracking-wider uppercase text-[#5b2a47] font-torus flex items-center gap-2">
              <span>Kawaii Light Design System & UI Kit</span>
              <span className="text-lg">🎀🐰</span>
            </h1>
          </div>
          <p className="text-xs text-[#a8556f] mt-1">
            Thư viện component đồng bộ Kawaii Light Pastel Pink & Bunny cho Triarhythm
          </p>
        </div>

        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} icon="←">
            Quay lại
          </Button>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
        {/* Section 1: Typography & Vietnamese support */}
        <div className="bg-white/80 border border-[#f3dbe4] rounded-2xl p-4 md:p-5 lg:p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold tracking-widest text-[#ff4d80] uppercase flex items-center gap-1.5">
            <span>1. Typography & Phông chữ Tiếng Việt</span>
            <span>🐰</span>
          </h2>
          <div className="flex flex-col gap-2 p-4 rounded-xl bg-[#fff5f8] border border-[#f3dbe4]">
            <p className="text-xs text-[#a8556f]">Font Torus / Nunito / Be Vietnam Pro:</p>
            <p className="text-lg font-bold text-[#5b2a47]">
              Đất nước mặt trời lặn — Triarhythm VSRG Arcade
            </p>
            <p className="text-sm text-[#7e345b]">
              Kiểm tra ký tự có dấu: <span className="text-[#ff4d80] font-bold">“ă ặ â ấ ế ể ề ỗ ơ ở ữ ự đ”</span>
            </p>
            <p className="text-xs text-[#a8556f] leading-relaxed">
              Mọi dấu thanh điệu hiển thị chuẩn mực, không lệch baseline, không vỡ glyph.
            </p>
          </div>
        </div>

        {/* Section 2: WebAudio UI Sounds */}
        <div className="bg-white/80 border border-[#f3dbe4] rounded-2xl p-4 md:p-5 lg:p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-widest text-[#ff4d80] uppercase flex items-center gap-1.5">
              <span>2. Âm thanh Web Audio UI (Không tải file)</span>
              <span>🔔</span>
            </h2>
            <Toggle
              checked={soundEnabled}
              onChange={handleSoundToggle}
              label={soundEnabled ? 'Bật âm UI' : 'Tắt'}
            />
          </div>
          <p className="text-xs text-[#a8556f]">
            Tổng hợp âm thanh nhẹ nhàng bằng bộ dao động tần số Web Audio API.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-2">
            <Button variant="ghost" size="sm" onClick={() => playHover()}>
              Hover (Blip)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => playClick()}>
              Click (Tap)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => playSelect()}>
              Select (Chime)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => playBack()}>
              Back (Descend)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => playTick()}>
              Tick (Notch)
            </Button>
          </div>
        </div>

        {/* Section 3: Buttons & IconButtons */}
        <div className="bg-white/80 border border-[#f3dbe4] rounded-2xl p-4 md:p-5 lg:p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold tracking-widest text-[#ff4d80] uppercase flex items-center gap-1.5">
            <span>3. Buttons & Icon Buttons</span>
            <span>🎀</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md">
              Primary Button
            </Button>
            <Button variant="ghost" size="md">
              Ghost Button
            </Button>
            <Button variant="secondary" size="md">
              Secondary
            </Button>
            <Button variant="danger" size="md">
              Danger
            </Button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs text-[#a8556f]">Kích thước:</span>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="lg">Large</Button>
            <Button variant="primary" size="sm" disabled>Disabled</Button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs text-[#a8556f]">Icon Buttons:</span>
            <Tooltip content="Phát nhạc">
              <IconButton icon="▶" variant="primary" size="md" />
            </Tooltip>
            <Tooltip content="Yêu thích">
              <IconButton icon="★" variant="ghost" size="md" />
            </Tooltip>
            <Tooltip content="Cài đặt">
              <IconButton icon="⚙" variant="ghost" size="md" />
            </Tooltip>
            <Tooltip content="Xoá bản đồ">
              <IconButton icon="🗑" variant="danger" size="md" />
            </Tooltip>
          </div>
        </div>

        {/* Section 4: Form Controls */}
        <div className="bg-white/80 border border-[#f3dbe4] rounded-2xl p-4 md:p-5 lg:p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold tracking-widest text-[#ff4d80] uppercase flex items-center gap-1.5">
            <span>4. Form Controls (Toggles, Sliders, Dropdowns)</span>
            <span>⚙</span>
          </h2>
          <Toggle
            checked={toggleVal1}
            onChange={setToggleVal1}
            label="Đếm ngược 3-2-1 trước khi vào bài"
            description="Tạo sự chuẩn bị trước khi nhịp nốt đầu tiên xuất hiện"
          />
          <Toggle
            checked={toggleVal2}
            onChange={setToggleVal2}
            label="Hiển thị Video nền (Background Video)"
            description="Bật/tắt phát video nền đồng bộ với nhịp beat"
          />

          <Slider
            label="Âm lượng bản nhạc (Music Volume)"
            value={sliderVal}
            min={0}
            max={100}
            unit="%"
            onChange={setSliderVal}
          />

          <Slider
            label="Tốc độ nốt (Note Speed)"
            value={speedVal}
            min={5.0}
            max={15.0}
            step={0.1}
            formatValue={(v) => `${v.toFixed(1)}x`}
            onChange={setSpeedVal}
          />

          <Dropdown
            label="Sắp xếp danh sách (Sort Beatmaps)"
            value={selectedDropdown}
            onChange={setSelectedDropdown}
            options={[
              { value: 'rating', label: 'Xếp hạng cao nhất (Top Rating)', icon: '★' },
              { value: 'title', label: 'Tên bài hát (A-Z)', icon: '♫' },
              { value: 'artist', label: 'Nghệ sĩ (Artist)', icon: '🎤' },
              { value: 'bpm', label: 'Tốc độ nhịp (BPM)', icon: '⏱' },
              { value: 'stars', label: 'Độ khó sao (Difficulty Stars)', icon: '⭐' }
            ]}
          />
        </div>

        {/* Section 5: Tabs & Navigation */}
        <div className="bg-white/80 border border-[#f3dbe4] rounded-2xl p-4 md:p-5 lg:p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold tracking-widest text-[#ff4d80] uppercase flex items-center gap-1.5">
            <span>5. Tabs & Status Indicators</span>
            <span>✨</span>
          </h2>
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'general', label: 'Chung (General)', badge: 4 },
              { id: 'audio', label: 'Âm thanh' },
              { id: 'input', label: 'Phím bấm' },
              { id: 'account', label: 'Tài khoản' }
            ]}
          />

          <div className="pt-2">
            <p className="text-xs text-[#a8556f] mb-2">Thanh tiến trình (Progress Bars):</p>
            <ProgressBar value={72} max={100} color="pink" showLabel />
            <div className="h-2" />
            <ProgressBar value={45} max={100} color="purple" />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs text-[#a8556f]">Avatars:</span>
            <Avatar size="sm" name="Astro" status="online" />
            <Avatar size="md" name="Player" status="online" />
            <Avatar size="lg" name="God" status="offline" />
          </div>
        </div>

        {/* Section 6: StarRating & Rank Badges */}
        <div className="bg-white/80 border border-[#f3dbe4] rounded-2xl p-4 md:p-5 lg:p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold tracking-widest text-[#ff4d80] uppercase flex items-center gap-1.5">
            <span>6. osu! Star Rating & Rank Badges</span>
            <span>⭐</span>
          </h2>
          <div>
            <p className="text-xs text-[#a8556f] mb-2">Màu sao theo độ khó (Star Rating):</p>
            <div className="flex flex-wrap gap-2">
              <StarRating stars={1.42} size="md" />
              <StarRating stars={3.25} size="md" />
              <StarRating stars={4.88} size="md" />
              <StarRating stars={5.95} size="md" />
              <StarRating stars={7.34} size="md" />
              <StarRating stars={9.12} size="md" />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-[#a8556f] mb-2">Cấp bậc xếp hạng (Rank Badges):</p>
            <div className="flex flex-wrap gap-2.5 items-center">
              <RankBadge rank="SS+" size="md" />
              <RankBadge rank="SS" size="md" />
              <RankBadge rank="S+" size="md" />
              <RankBadge rank="S" size="md" />
              <RankBadge rank="A" size="md" />
              <RankBadge rank="B" size="md" />
              <RankBadge rank="C" size="md" />
              <RankBadge rank="D" size="md" />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-[#a8556f] mb-2">Skeletons loading:</p>
            <div className="flex flex-col gap-2">
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="85%" />
            </div>
          </div>
        </div>

        {/* Section 7: Overlays, Modals & Toasts */}
        <div className="bg-white/80 border border-[#f3dbe4] rounded-2xl p-4 md:col-span-2 md:p-5 lg:p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold tracking-widest text-[#ff4d80] uppercase flex items-center gap-1.5">
            <span>7. Modals, Confirm Dialog, Context Menu & Toasts</span>
            <span>🎀</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
              Mở Modal Mẫu
            </Button>
            <Button variant="danger" size="sm" onClick={() => setIsConfirmOpen(true)}>
              Mở Confirm Dialog
            </Button>
            <div
              onContextMenu={handleRightClick}
              className="px-4 py-2 rounded-xl bg-[#fff5f8] border border-dashed border-[#ff85a2] text-xs text-[#a8556f] flex items-center cursor-context-menu"
            >
              Chuột phải vào ô này để mở Context Menu
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toast.success('Đã lưu cài đặt thành công!')}
            >
              Toast Success
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toast.error('Lỗi kết nối máy chủ!')}
            >
              Toast Error
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                toast.undo('Đã xóa beatmap "系ぎて"', () => {
                  toast.success('Đã hoàn tác và khôi phục bài hát!');
                })
              }
            >
              Toast Undo (8s)
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Demo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Kawaii Light Modal Sample"
        description="Lớp kính mờ backdrop-blur-md, viền pastel, đóng bằng phím ESC"
      >
        <p className="text-sm text-[#5b2a47] leading-relaxed my-3">
          Đây là component Modal dùng chung cho mọi tính năng của Triarhythm: Settings, Auth, Map Info, Profile và Admin CRUD.
        </p>
        <div className="flex justify-end pt-4">
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
            Đồng ý
          </Button>
        </div>
      </Modal>

      {/* Confirm Dialog Demo */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          toast.success('Đã thực hiện hành động xác nhận!');
        }}
        title="Xóa Beatmap khỏi máy?"
        message="Hành động này sẽ xóa dữ liệu âm thanh và hình ảnh của beatmap khỏi bộ nhớ IndexedDB."
        confirmText="Xóa vĩnh viễn"
        confirmVariant="danger"
      />

      {/* Context Menu Demo */}
      <ContextMenu
        isOpen={contextMenuState.isOpen}
        x={contextMenuState.x}
        y={contextMenuState.y}
        onClose={() => setContextMenuState({ isOpen: false, x: 0, y: 0 })}
        items={[
          { label: 'Chơi bài này', icon: '▶', shortcut: 'Enter', onClick: () => toast.info('Chơi bài') },
          { label: 'Thêm vào yêu thích', icon: '★', onClick: () => toast.success('Đã thêm vào yêu thích!') },
          { divider: true },
          { label: 'Xóa khỏi máy', icon: '🗑', danger: true, onClick: () => setIsConfirmOpen(true) }
        ]}
      />
    </div>
  );
}
