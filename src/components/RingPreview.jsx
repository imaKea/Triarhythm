import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  TRI_RING_LAYOUT,
  layoutToPixels,
  pixelsToLayout,
  getHexagonVertices,
  getLayoutMetrics,
  getTapLane
} from '../config/layout.config.js';

export default function RingPreview() {
  const canvasRef = useRef(null);
  const [hoveredInfo, setHoveredInfo] = useState({ type: null, id: null, lx: 0, ly: 0 });
  const [activeLanes, setActiveLanes] = useState(new Set());

  // Lắng nghe phím bấm thử nghiệm trực tiếp trên bàn phím
  useEffect(() => {
    const keyMap = {};
    for (const [laneStr, codes] of Object.entries(TRI_RING_LAYOUT.defaultKeybinds)) {
      const lane = Number(laneStr);
      for (const code of codes) {
        keyMap[code] = lane;
      }
    }

    const onKeyDown = (e) => {
      const lane = keyMap[e.code];
      if (lane !== undefined) {
        setActiveLanes((prev) => new Set([...prev, lane]));
      }
    };

    const onKeyUp = (e) => {
      const lane = keyMap[e.code];
      if (lane !== undefined) {
        setActiveLanes((prev) => {
          const next = new Set(prev);
          next.delete(lane);
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const metrics = getLayoutMetrics(width, height);
    const { scale } = metrics;
    const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, width, height);

    const v = TRI_RING_LAYOUT.vertices;
    const tlPix = layoutToPixels(v.TL.x, v.TL.y, width, height);
    const trPix = layoutToPixels(v.TR.x, v.TR.y, width, height);
    const bPix = layoutToPixels(v.B.x, v.B.y, width, height);
    const cc = TRI_RING_LAYOUT.curveControl;
    const cpTopPix = layoutToPixels(cc.top.x, cc.top.y, width, height);
    const cpLeftPix = layoutToPixels(cc.left.x, cc.left.y, width, height);
    const cpRightPix = layoutToPixels(cc.right.x, cc.right.y, width, height);

    // 1. Viền tam giác ngoài cùng (cả 3 cạnh bo cong ra ngoài - Bowed Track)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tlPix.x, tlPix.y);
    ctx.quadraticCurveTo(cpTopPix.x, cpTopPix.y, trPix.x, trPix.y);
    ctx.quadraticCurveTo(cpRightPix.x, cpRightPix.y, bPix.x, bPix.y);
    ctx.quadraticCurveTo(cpLeftPix.x, cpLeftPix.y, tlPix.x, tlPix.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 2. Tia dẫn mờ (Guide lines) từ tâm ra 9 nút
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.0;
    ctx.setLineDash([4, 6]);
    for (const lane of TRI_RING_LAYOUT.tapLanes) {
      const p = layoutToPixels(lane.x, lane.y, width, height);
      ctx.beginPath();
      ctx.moveTo(originPix.x, originPix.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();

    // 3. 9 ô Tap hình tròn (Circular Judgement Targets) & Keycap Hint mờ tại tâm
    for (const lane of TRI_RING_LAYOUT.tapLanes) {
      const p = layoutToPixels(lane.x, lane.y, width, height);
      const isActive = activeLanes.has(lane.lane);
      const isHovered = hoveredInfo.type === 'tap' && hoveredInfo.id === lane.lane;

      const rPix = lane.a * scale; // Hình tròn chuẩn maimai (lane.a === lane.b)

      ctx.save();
      ctx.translate(p.x, p.y);

      // Vòng ngoài hình tròn
      ctx.beginPath();
      ctx.arc(0, 0, rPix, 0, Math.PI * 2);
      ctx.fillStyle = isActive
        ? 'rgba(255, 255, 255, 0.25)'
        : isHovered
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(255, 255, 255, 0.02)';
      ctx.fill();

      ctx.strokeStyle = isActive
        ? '#ffffff'
        : isHovered
        ? '#ffffff'
        : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = isActive ? 2.5 : isHovered ? 2 : 1.2;
      ctx.stroke();

      // Vòng sensor tròn bên trong
      ctx.beginPath();
      ctx.arc(0, 0, rPix * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Hạt định vị Maimai Bead
      const beadRadius = Math.max(4, 5.5 * (scale / 240));
      ctx.beginPath();
      ctx.arc(0, 0, beadRadius, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#ffe082' : '#ffffff';
      if (isActive) {
        ctx.shadowColor = '#ffe082';
        ctx.shadowBlur = 12;
      }
      ctx.fill();
      ctx.restore();

      // Keycap Hint mờ ngay tâm điểm chạm
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, 13 * (scale / 240), 0, Math.PI * 2);
      ctx.fillStyle = isActive ? 'rgba(255, 224, 130, 0.35)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = isActive ? '#ffe082' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      const isWideText = lane.label.length > 2;
      ctx.font = `bold ${Math.round((isWideText ? 9.5 : 11) * (scale / 240))}px Torus, Nunito, 'Be Vietnam Pro', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(`${lane.label}`, 0, 0.5);
      ctx.restore();
    }

    // 6. Vẽ Maimai Center Hub
    ctx.save();
    ctx.beginPath();
    ctx.arc(originPix.x, originPix.y, 22 * (scale / 240), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 15, 22, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(originPix.x, originPix.y, 8 * (scale / 240), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(22, 26, 36, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(originPix.x, originPix.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }, [hoveredInfo, activeLanes]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Xử lý chuyển động chuột: biến đổi pixel sang layout và phát hiện hover
  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const { x: lx, y: ly } = pixelsToLayout(px, py, canvas.width, canvas.height);

    let foundType = null;
    let foundId = null;

    // Kiểm tra các ô Tap (elip)
    for (const lane of TRI_RING_LAYOUT.tapLanes) {
      const dx = lx - lane.x;
      const dy = ly - lane.y;
      const cosA = Math.cos(lane.angle);
      const sinA = Math.sin(lane.angle);
      const localX = dx * cosA + dy * sinA;
      const localY = -dx * sinA + dy * cosA;
      if ((localX * localX) / (lane.a * lane.a) + (localY * localY) / (lane.b * lane.b) <= 1.0) {
        foundType = 'tap';
        foundId = lane.lane;
        break;
      }
    }

    // Kiểm tra các Slide Node (hexagon)
    if (!foundType) {
      for (const node of TRI_RING_LAYOUT.slideNodes) {
        const dist = Math.hypot(lx - node.x, ly - node.y);
        if (dist <= node.radius) {
          foundType = 'node';
          foundId = node.id;
          break;
        }
      }
    }

    setHoveredInfo({
      type: foundType,
      id: foundId,
      lx: Number(lx.toFixed(3)),
      ly: Number(ly.toFixed(3))
    });
  };

  const handlePointerLeave = () => {
    setHoveredInfo({ type: null, id: null, lx: 0, ly: 0 });
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative border border-slate-700/60 rounded-xl overflow-hidden bg-[#090b14] shadow-2xl">
        <canvas
          ref={canvasRef}
          width={640}
          height={560}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className="cursor-crosshair block"
        />

        {/* Tọa độ và Hover Status Bar */}
        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700/50 flex justify-between items-center text-xs font-mono text-slate-300">
          <div>
            Layout: <span className="text-cyan-400 font-semibold">{hoveredInfo.lx}</span>, <span className="text-cyan-400 font-semibold">{hoveredInfo.ly}</span>
          </div>
          <div>
            {hoveredInfo.type === 'tap' && (
              <span className="text-yellow-400 font-bold">
                Tap Lane {hoveredInfo.id} (Key: {getTapLane(hoveredInfo.id)?.label || ''})
              </span>
            )}
            {hoveredInfo.type === 'node' && (
              <span className="text-green-400 font-bold">
                Slide Node S{hoveredInfo.id} ({TRI_RING_LAYOUT.slideNodes[hoveredInfo.id].name})
              </span>
            )}
            {!hoveredInfo.type && <span className="text-slate-500">Hover or press keys to test layout</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
