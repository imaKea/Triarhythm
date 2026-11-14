/**
 * Các hằng số hiển thị của Map Editor (dùng chung cho hook + panel).
 * Đồng bộ trực tiếp từ TRI_RING_LAYOUT trong layout.config.js (Single Source of Truth).
 */

import { TRI_RING_LAYOUT } from '../../config/layout.config.js';

// Xây dựng bảng tra cứu KEY_TO_LANE tự động từ defaultKeybinds của TRI_RING_LAYOUT
export const KEY_TO_LANE = {};
for (const [laneStr, keys] of Object.entries(TRI_RING_LAYOUT.defaultKeybinds)) {
  if (laneStr === 'ring') continue;
  const laneNum = Number(laneStr);
  for (const k of keys) {
    KEY_TO_LANE[k] = laneNum;
  }
}

// Xây dựng danh sách 9 ô tròn và nút Ring từ TRI_RING_LAYOUT
const LANE_COLORS = [
  'text-amber-300',
  'text-cyan-300',
  'text-emerald-300',
  'text-pink-300',
  'text-rose-300',
  'text-orange-300',
  'text-blue-300',
  'text-indigo-300',
  'text-purple-300'
];

export const LANES_DEF = [
  ...TRI_RING_LAYOUT.tapLanes.map((l) => ({
    id: l.lane,
    label: `${l.lane} (${l.defaultKey})`,
    short: `${l.lane}: ${l.defaultKey}`,
    edge: l.edge,
    col: LANE_COLORS[l.lane] || 'text-white'
  })),
  { id: 'ring', label: 'RING (SPACE/B/ENTER)', short: 'RING', col: 'text-cyan-400 font-bold' }
];

export const TRACK_HEADER_WIDTH = 84;

// Công cụ vẽ note đầy đủ theo chuẩn game: Select, Tap, Hold, Break, Ring, Slide, Typing
export const TOOL_OPTIONS = [
  { id: 'select', label: 'Select', icon: '↖', col: 'bg-[#8890a4]', key: '1' },
  { id: 'tap', label: 'Tap', icon: '●', col: 'bg-[#ff2a70]', key: '2' },
  { id: 'hold', label: 'Hold', icon: '▬', col: 'bg-[#ff9100]', key: '3' },
  { id: 'break', label: 'Break', icon: '★', col: 'bg-[#ff3d00]', key: '4' },
  { id: 'ring', label: 'Ring', icon: '◯', col: 'bg-[#00e5ff]', key: '5' },
  { id: 'slide', label: 'Slide', icon: '⤹', col: 'bg-[#ffe600]', key: '6' },
  { id: 'typing', label: 'Typing', icon: '⌨', col: 'bg-[#a855f7]', key: '7' },
];

// Màu Beat Snap Divisor chuẩn osu! (1/1 trắng/đỏ, 1/2 xanh, 1/3 tím, 1/4 vàng...)
export const SNAP_OPTIONS = [
  { div: 1, label: '1/1', color: '#ffffff' },  // Trắng / Đỏ (1 beat)
  { div: 2, label: '1/2', color: '#e53935' },  // Đỏ (1/2 beat)
  { div: 3, label: '1/3', color: '#8e24aa' },  // Tím (1/3 beat)
  { div: 4, label: '1/4', color: '#1e88e5' },  // Xanh dương (1/4 beat)
  { div: 6, label: '1/6', color: '#ec4899' },  // Hồng (1/6 beat)
  { div: 8, label: '1/8', color: '#fdd835' },  // Vàng (1/8 beat)
  { div: 12, label: '1/12', color: '#00acc1' },// Cyan (1/12 beat)
  { div: 16, label: '1/16', color: '#78909c' } // Xám (1/16 beat)
];
