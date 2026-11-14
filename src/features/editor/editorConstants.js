/**
 * Các hằng số hiển thị của Map Editor (dùng chung cho hook + panel).
 */

export const KEY_TO_LANE = {
  Digit4: 0, Digit5: 0, Numpad4: 0, Numpad5: 0,
  Digit6: 1, Digit7: 1, Numpad6: 1, Numpad7: 1,
  Digit8: 2, Digit9: 2, Numpad8: 2, Numpad9: 2,
  KeyR: 3,
  KeyF: 4,
  KeyV: 5,
  KeyI: 6,
  KeyJ: 7,
  KeyN: 8
};

export const LANES_DEF = [
  { id: 0, label: '0 (4·5)', short: '0: 4·5', col: 'text-amber-300' },
  { id: 1, label: '1 (6·7)', short: '1: 6·7', col: 'text-cyan-300' },
  { id: 2, label: '2 (8·9)', short: '2: 8·9', col: 'text-emerald-300' },
  { id: 3, label: '3 (R)', short: '3: R', col: 'text-pink-300' },
  { id: 4, label: '4 (F)', short: '4: F', col: 'text-rose-300' },
  { id: 5, label: '5 (V)', short: '5: V', col: 'text-orange-300' },
  { id: 6, label: '6 (I)', short: '6: I', col: 'text-blue-300' },
  { id: 7, label: '7 (J)', short: '7: J', col: 'text-indigo-300' },
  { id: 8, label: '8 (N)', short: '8: N', col: 'text-purple-300' },
  { id: 'ring', label: 'RING (SPACE)', short: 'RING', col: 'text-cyan-400 font-bold' }
];

export const TRACK_HEADER_WIDTH = 84;

export const TOOL_OPTIONS = [
  { id: 'tap', label: 'Tap', col: 'bg-[#ff2a70]' },
  { id: 'break', label: 'Break', col: 'bg-[#ff3d00]' },
  { id: 'hold', label: 'Hold', col: 'bg-[#ff9100]' },
  { id: 'ring', label: 'Ring', col: 'bg-[#00e5ff]' }
];

export const SNAP_OPTIONS = [
  { div: 1, label: '1/1', color: '#ffffff' },
  { div: 2, label: '1/2', color: '#ef4444' },
  { div: 3, label: '1/3', color: '#a855f7' },
  { div: 4, label: '1/4', color: '#3b82f6' },
  { div: 6, label: '1/6', color: '#ec4899' },
  { div: 8, label: '1/8', color: '#eab308' },
  { div: 12, label: '1/12', color: '#8b5cf6' },
  { div: 16, label: '1/16', color: '#6366f1' }
];
