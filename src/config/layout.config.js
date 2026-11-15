/**
 * Cấu hình hình học vòng tam giác ngược (triRing9)
 * Tất cả tọa độ dựa trên đơn vị lưới: tam giác đều cạnh 2, tâm tại (0,0), trục y hướng xuống.
 */

const PLAYFIELD_ORIGIN_Y = 0.10;
const PLAYFIELD_SPREAD_X = 1.10;
const PLAYFIELD_SPREAD_Y = 1.03;
const spreadFromSpawn = (x, y) => ({
  x: x * PLAYFIELD_SPREAD_X,
  y: PLAYFIELD_ORIGIN_Y + (y - PLAYFIELD_ORIGIN_Y) * PLAYFIELD_SPREAD_Y
});

export const TRI_RING_LAYOUT = {
  id: 'triRing9',
  name: 'Triangle Ring 9',
  origin: { x: 0, y: PLAYFIELD_ORIGIN_Y }, // Tâm xuất hiện nốt được dời xuống một chút (y = 0.10) ở chính giữa tam giác bo cong
  noteRadius: 0.10,
  spawnFrac: 0.18,
  
  // Vùng bao gồm cả hexagon đỉnh
  bounds: {
    minX: -1.25,
    maxX: 1.25,
    minY: -0.92,
    maxY: 1.35,
    width: 2.5,
    height: 2.27,
    centerX: 0.0,
    centerY: 0.16 // Dời nhẹ xuống dưới để cách xa thanh hiện điểm ở mép trên
  },

  // 3 đỉnh của tam giác
  vertices: {
    TL: spreadFromSpawn(-1.0, -0.577), // Trên - Trái
    TR: spreadFromSpawn(1.0, -0.577),  // Trên - Phải
    B:  spreadFromSpawn(0.0, 1.155)    // Đáy
  },

  // Điểm điều khiển uốn cong cho cả 3 cạnh (Bowed Edges - bo tròn khu vực chơi ra nhiều hơn)
  curveControl: {
    top:   spreadFromSpawn(0.0, -0.85),    // Cạnh trên (TL -> TR) bo cong vòm tròn rõ nét lên trên
    left:  spreadFromSpawn(-0.98, 0.48),   // Cạnh trái (TL -> B) bo cong tròn mở rộng ra ngoài
    right: spreadFromSpawn(0.98, 0.48)     // Cạnh phải (TR -> B) bo cong tròn mở rộng ra ngoài
  },

  // 3 Slide Node (lục giác đỉnh hướng lên)
  slideNodes: [
    { id: 0, label: 'S0', name: 'Top-Left', ...spreadFromSpawn(-1.0, -0.577), radius: 0.15 },
    { id: 1, label: 'S1', name: 'Top-Right', ...spreadFromSpawn(1.0, -0.577), radius: 0.15 },
    { id: 2, label: 'S2', name: 'Bottom', ...spreadFromSpawn(0.0, 1.155), radius: 0.15 }
  ],

  // Kích thước ô Tap hình tròn (Circular Judgement Targets)
  tapDimensions: {
    radius: 0.135,
    a: 0.135,
    b: 0.135
  },

  // 9 ô Tap hình tròn trên 3 cạnh tam giác (được sắp xếp đúng theo số thứ tự lane 0..8)
  tapLanes: [
    // Hàng 1 - Cạnh trên: Phím 4/5 (trái), 6/7 (giữa), 8/9 (phải)
    { lane: 0, defaultKey: '4/5', label: '4·5', edge: 'top', t: 0.22, ...spreadFromSpawn(-0.5600, -0.6707), angle: -0.1517, a: 0.135, b: 0.135 },
    { lane: 1, defaultKey: '6/7', label: '6·7', edge: 'top', t: 0.50, ...spreadFromSpawn(0.0000, -0.7135), angle: 0.0000,  a: 0.135, b: 0.135 },
    { lane: 2, defaultKey: '8/9', label: '8·9', edge: 'top', t: 0.78, ...spreadFromSpawn(0.5600, -0.6707), angle: 0.1517, a: 0.135, b: 0.135 },

    // Cạnh trái: R (trên), F (giữa), V (dưới)
    { lane: 3, defaultKey: 'R',   label: 'R',   edge: 'left',  t: 0.22, ...spreadFromSpawn(-0.9447, -0.1304), angle: 1.3375, a: 0.135, b: 0.135 },
    { lane: 4, defaultKey: 'F',   label: 'F',   edge: 'left',  t: 0.50, ...spreadFromSpawn(-0.7400, 0.3845),  angle: 1.0472, a: 0.135, b: 0.135 },
    { lane: 5, defaultKey: 'V',   label: 'V',   edge: 'left',  t: 0.78, ...spreadFromSpawn(-0.3847, 0.8395),  angle: 0.7790, a: 0.135, b: 0.135 },

    // Cạnh phải: I (trên), J (giữa), N (dưới)
    { lane: 6, defaultKey: 'I',   label: 'I',   edge: 'right', t: 0.22, ...spreadFromSpawn(0.9447, -0.1304), angle: 1.8041, a: 0.135, b: 0.135 },
    { lane: 7, defaultKey: 'J',   label: 'J',   edge: 'right', t: 0.50, ...spreadFromSpawn(0.7400, 0.3845),  angle: 2.0944, a: 0.135, b: 0.135 },
    { lane: 8, defaultKey: 'N',   label: 'N',   edge: 'right', t: 0.78, ...spreadFromSpawn(0.3847, 0.8395),  angle: 2.3626, a: 0.135, b: 0.135 }
  ],

  // Perimeter order: V F R (4/5) (6/7) (8/9) I J N
  perimeterOrder: [5, 4, 3, 0, 1, 2, 6, 7, 8],

  // Phân vùng cánh quạt (Radial Sector Hitbox) chuẩn AstroDX / Maimai Mobile
  // Bọc trọn 360 độ quanh tâm origin, mở rộng không giới hạn ra tận mép màn hình.
  sectors: {
    0: { lane: 0, label: '4·5', centerAngle: -2.230727, startAngle: -2.573901, endAngle: -1.900762 },
    1: { lane: 1, label: '6·7', centerAngle: -1.570796, startAngle: -1.900762, endAngle: -1.240831 },
    2: { lane: 2, label: '8·9', centerAngle: -0.910866, startAngle: -1.240831, endAngle: -0.567691 },
    3: { lane: 3, label: 'R',   centerAngle: -2.917076, startAngle: 3.081076,  endAngle: -2.573901 },
    4: { lane: 4, label: 'F',   centerAngle: 2.796043,  startAngle: 2.436975,  endAngle: 3.081076 },
    5: { lane: 5, label: 'V',   centerAngle: 2.077907,  startAngle: 1.570796,  endAngle: 2.436975 },
    6: { lane: 6, label: 'I',   centerAngle: -0.224517, startAngle: -0.567691, endAngle: 0.060517 },
    7: { lane: 7, label: 'J',   centerAngle: 0.345550,  startAngle: 0.060517,  endAngle: 0.704618 },
    8: { lane: 8, label: 'N',   centerAngle: 1.063686,  startAngle: 0.704618,  endAngle: 1.570796 }
  },

  // Keybind mặc định (Hàng 1: 4/5, 6/7, 8/9; Hàng 2: R I; Hàng 3: F J; Hàng 4: V N)
  // Bổ sung các phím phụ công thái học (E, D, C, W, S, X, Numpad...) chống kẹt bộ gõ Unikey Telex
  defaultKeybinds: {
    0: ['Digit4', 'Digit5', 'Numpad4', 'Numpad5'],
    1: ['Digit6', 'Digit7', 'Numpad6', 'Numpad7'],
    2: ['Digit8', 'Digit9', 'Numpad8', 'Numpad9'],
    3: ['KeyR', 'KeyE', 'KeyW', 'KeyA', 'KeyQ'],
    4: ['KeyF', 'KeyD', 'KeyS'],
    5: ['KeyV', 'KeyC', 'KeyX', 'KeyZ'],
    6: ['KeyI', 'KeyU', 'KeyO', 'KeyP', 'Numpad7', 'Numpad8'],
    7: ['KeyJ', 'KeyK', 'KeyL', 'Numpad4', 'Numpad5'],
    8: ['KeyN', 'KeyM', 'Comma', 'Numpad1', 'Numpad2'],
    ring: ['Space', 'KeyB', 'Enter']
  },

  // Bảng màu Maimai Arcade tối giản & chuyên nghiệp
  colors: {
    ring: '#ffffff',                 // Đường viền tam giác trắng tinh khiết chuẩn maimai
    ringGlow: 'rgba(255, 255, 255, 0.18)',
    tapBorder: 'rgba(255, 255, 255, 0.45)',
    tapFill: 'rgba(255, 255, 255, 0.03)',
    tapActive: '#ffffff',
    tapActiveFill: 'rgba(255, 255, 255, 0.3)',
    tapDot: '#ffffff',               // Hạt tròn định vị maimai
    slideNode: '#ffffff',            // Khung lục giác trắng/bạc
    slideNodeFill: 'rgba(20, 24, 32, 0.85)',
    slideNodeActive: '#ffe57f',      // Vàng nhạt khi kích hoạt
    slideStar: '#2979ff',            // Ngôi sao Slide xanh dương
    originHub: '#ffffff',            // Tâm maimai bạc sáng
    innerZoneBorder: 'rgba(255, 255, 255, 0.12)',
    innerZoneFill: 'rgba(255, 255, 255, 0.015)',
    guideRay: 'rgba(255, 255, 255, 0.15)'
  }
};

/**
 * Chuẩn hóa góc về khoảng [-PI, PI]
 */
export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Tính toán ma trận biến đổi fit vào vùng bao [-1.2, 1.2] x [-0.8, 1.35]
 * Giữ nguyên tỉ lệ khung hình (aspect ratio)
 */
export function getLayoutMetrics(width, height) {
  const b = TRI_RING_LAYOUT.bounds;
  const scale = Math.min(width / b.width, height / b.height);
  const offsetX = width / 2;
  const offsetY = height / 2 - b.centerY * scale;

  return {
    scale,
    offsetX,
    offsetY,
    width,
    height
  };
}

/**
 * Chuyển tọa độ layout (đơn vị lưới) sang tọa độ pixel màn hình
 */
export function layoutToPixels(x, y, width, height) {
  const { scale, offsetX, offsetY } = getLayoutMetrics(width, height);
  return {
    x: offsetX + x * scale,
    y: offsetY + y * scale,
    scale
  };
}

/**
 * Chuyển tọa độ pixel màn hình (ví dụ vị trí chuột) về tọa độ layout
 */
export function pixelsToLayout(px, py, width, height) {
  const { scale, offsetX, offsetY } = getLayoutMetrics(width, height);
  return {
    x: (px - offsetX) / scale,
    y: (py - offsetY) / scale
  };
}

/**
 * Trả về danh sách đỉnh của lục giác (đỉnh hướng lên: point-topped)
 */
export function getHexagonVertices(centerX, centerY, radius = TRI_RING_LAYOUT.slideNodes[0].radius) {
  const vertices = [];
  // Điểm nhọn hướng lên: góc ban đầu là -π/2 (-90°)
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3;
    vertices.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }
  return vertices;
}

/**
 * Lấy mẫu các điểm bao quanh elip để tính toán hình học hoặc vẽ
 */
export function getEllipseBoundaryPoints(lane, samples = 36) {
  const points = [];
  const cosA = Math.cos(lane.angle);
  const sinA = Math.sin(lane.angle);
  for (let i = 0; i < samples; i++) {
    const phi = (i / samples) * 2 * Math.PI;
    const ex = lane.a * Math.cos(phi);
    const ey = lane.b * Math.sin(phi);
    // Xoay theo góc của cạnh
    points.push({
      x: lane.x + (ex * cosA - ey * sinA),
      y: lane.y + (ex * sinA + ey * cosA)
    });
  }
  return points;
}

/**
 * Định dạng mã phím (KeyboardEvent.code) sang nhãn ngắn gọn, thân thiện
 */
export function formatKeyCode(code) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6);
  if (code === 'Space') return 'SPACE';
  if (code === 'Backspace') return '⌫';
  if (code === 'Enter') return '↵';
  if (code === 'Tab') return 'TAB';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'Semicolon') return ';';
  if (code === 'Quote') return "'";
  if (code === 'Comma') return ',';
  if (code === 'Period') return '.';
  if (code === 'Slash') return '/';
  if (code === 'Backslash') return '\\';
  if (code === 'BracketLeft') return '[';
  if (code === 'BracketRight') return ']';
  if (code === 'Backquote') return '`';
  if (code === 'Minus') return '-';
  if (code === 'Equal') return '=';
  return code.slice(0, 5).toUpperCase();
}

/**
 * Lấy nhãn hiển thị trực quan cho lane (hoặc nốt ring) dựa trên customKeybinds
 */
export function getLaneDisplayLabel(laneIndex, customKeybinds) {
  if (laneIndex === 'ring' || laneIndex === 'Ring') {
    const ringCodes = customKeybinds?.ring || TRI_RING_LAYOUT.defaultKeybinds.ring;
    return ringCodes && ringCodes.length > 0 ? formatKeyCode(ringCodes[0]) : 'SPC';
  }
  if (customKeybinds && customKeybinds[laneIndex] && customKeybinds[laneIndex].length > 0) {
    return customKeybinds[laneIndex].slice(0, 2).map(formatKeyCode).join('·');
  }
  const defaultLabels = {
    0: '4·5',
    1: '6·7',
    2: '8·9',
    3: 'R',
    4: 'F',
    5: 'V',
    6: 'I',
    7: 'J',
    8: 'N'
  };
  return defaultLabels[laneIndex] || '';
}

/**
 * Lấy đối tượng tapLane tương ứng với số thứ tự lane (0..8) một cách an toàn tuyệt đối
 */
export function getTapLane(laneId) {
  const num = Number(laneId);
  return TRI_RING_LAYOUT.tapLanes.find(l => l.lane === num) || TRI_RING_LAYOUT.tapLanes[num];
}
