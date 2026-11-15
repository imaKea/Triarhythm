/**
 * Nhóm vẽ sân khấu (layout): nền, viền tam giác, guide lines,
 * 9 ô Tap và Maimai Center Hub.
 *
 * Hàm thuần nhận `renderer` để dùng chung ctx + cấu hình hiển thị,
 * nhờ đó GameplayRenderer chỉ còn vai trò điều phối.
 */

import {
  TRI_RING_LAYOUT,
  layoutToPixels,
  getLaneDisplayLabel
} from '../../../config/layout.config.js';

/**
 * Vẽ toàn bộ nền + sân khấu.
 * @returns {{x:number,y:number}} Toạ độ tâm (origin) theo pixel
 */
export function drawPlayfield(renderer, gameState, width, height, scale, travelTime) {
  const { ctx } = renderer;
  const songTime = gameState.songTime;

  // 1. Nền tối Arcade chuẩn maimai (áp dụng Background Dim mờ khi có Video nền)
  ctx.clearRect(0, 0, width, height);
  if (!gameState.hasBackgroundVideo) {
    ctx.fillStyle = '#040507';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = `rgba(4, 5, 7, ${renderer.backgroundDim})`;
    ctx.fillRect(0, 0, width, height);
  }

  const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, width, height);
  const v = TRI_RING_LAYOUT.vertices;
  const tlPix = layoutToPixels(v.TL.x, v.TL.y, width, height);
  const trPix = layoutToPixels(v.TR.x, v.TR.y, width, height);
  const bPix = layoutToPixels(v.B.x, v.B.y, width, height);
  const cc = TRI_RING_LAYOUT.curveControl;
  const cpTopPix = layoutToPixels(cc.top.x, cc.top.y, width, height);
  const cpLeftPix = layoutToPixels(cc.left.x, cc.left.y, width, height);
  const cpRightPix = layoutToPixels(cc.right.x, cc.right.y, width, height);

  // 2. Viền tam giác ngoài cùng (Dìm mờ xuống 0.25 khi Typing Section đang hoạt động)
  ctx.save();
  if (gameState.isTypingActive) {
    ctx.globalAlpha = 0.25;
  }

  // Vầng hào quang mờ ngoài đường ray (Bo cong cả 3 cạnh tam giác)
  ctx.beginPath();
  ctx.moveTo(tlPix.x, tlPix.y);
  ctx.quadraticCurveTo(cpTopPix.x, cpTopPix.y, trPix.x, trPix.y);
  ctx.quadraticCurveTo(cpRightPix.x, cpRightPix.y, bPix.x, bPix.y);
  ctx.quadraticCurveTo(cpLeftPix.x, cpLeftPix.y, tlPix.x, tlPix.y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Đường ray trắng tinh khiết sắc nét chuẩn SEGA maimai (Bo cong cả 3 cạnh)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 3. Đường dẫn mờ (Guide Lines) cực mảnh nối từ tâm ra 9 nút bấm (opacity ~12%)
  if (renderer.showRayGuides) {
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
  }

  // 3b. Vùng Hitbox cánh quạt (Radial Sector Hitbox) chuẩn AstroDX / Maimai Mobile
  const sectors = TRI_RING_LAYOUT.sectors;
  if (sectors) {
    const innerSectorR = 0.35 * scale;
    const outerSectorR = Math.max(width, height) * 0.95;

    ctx.save();
    // Vẽ đường phân vùng mờ giữa các cánh quạt
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.0;
    for (const key of Object.keys(sectors)) {
      const s = sectors[key];
      const startX = originPix.x + Math.cos(s.startAngle) * innerSectorR;
      const startY = originPix.y + Math.sin(s.startAngle) * innerSectorR;
      const endX = originPix.x + Math.cos(s.startAngle) * outerSectorR;
      const endY = originPix.y + Math.sin(s.startAngle) * outerSectorR;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // Khi chạm hoặc giữ nút: thắp sáng toàn bộ vùng quạt tương ứng (như ảnh AstroDX)
    for (let i = 0; i < TRI_RING_LAYOUT.tapLanes.length; i++) {
      const isKeyDown = gameState.activeLanes[i];
      const isHolding = gameState.holdingLanes[i];
      if (isKeyDown || isHolding) {
        const s = sectors[i];
        if (s) {
          const hitOuterR = Math.min(outerSectorR, 1.45 * scale);
          ctx.beginPath();
          ctx.arc(originPix.x, originPix.y, hitOuterR, s.startAngle, s.endAngle);
          ctx.arc(originPix.x, originPix.y, innerSectorR, s.endAngle, s.startAngle, true);
          ctx.closePath();
          // Vùng màu xanh lơ dịu đặc trưng chuẩn ảnh AstroDX
          ctx.fillStyle = 'rgba(100, 185, 255, 0.20)';
          ctx.fill();

          ctx.strokeStyle = 'rgba(100, 185, 255, 0.70)';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Vòng tròn định vị phụ ở đỉnh ngoài cánh quạt
          const midA = s.centerAngle;
          const dotR = hitOuterR * 0.96;
          ctx.beginPath();
          ctx.arc(originPix.x + Math.cos(midA) * dotR, originPix.y + Math.sin(midA) * dotR, 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // 4. 9 ô Tap hình tròn (Circular Judgement Targets) & Keycap Hint mờ trực tiếp tại tâm
  for (const lane of TRI_RING_LAYOUT.tapLanes) {
    const p = layoutToPixels(lane.x, lane.y, width, height);
    const isKeyDown = gameState.activeLanes[lane.lane];
    const isHolding = gameState.holdingLanes[lane.lane];
    const isActive = isKeyDown || isHolding;

    const rPix = lane.a * scale; // Bán kính hình tròn (lane.a === lane.b)

    // Kiểm tra xem có nốt nào đang bay tới gần (để mờ dần Keycap Hint nhường chỗ cho nốt)
    let noteApproachingAlpha = 1.0;
    if (gameState.activeNotes) {
      for (const note of gameState.activeNotes) {
        if (note.lane === lane.lane) {
          const pHead = (songTime - (note.time - travelTime)) / travelTime;
          if (pHead >= 0.55 && pHead <= 1.08) {
            const fade = Math.max(0, 1.0 - (pHead - 0.55) / 0.32);
            if (fade < noteApproachingAlpha) noteApproachingAlpha = fade;
          }
        }
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    // Vùng cảm ứng hình tròn chuẩn SEGA maimai
    ctx.beginPath();
    ctx.arc(0, 0, rPix, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.015)';
    ctx.fill();
    ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.stroke();

    // Vòng sensor tròn bên trong
    ctx.beginPath();
    ctx.arc(0, 0, rPix * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Hạt định vị Maimai Bead & Keycap Badge hiển thị siêu rõ nét
    const isMaimaiDisabled = lane.lane === 1; // Lane 1 có dấu X đỏ cho Maimai
    const badgeRadius = Math.max(12, 14.0 * (scale / 240));

    // Nền pill tối tương phản cao để chữ phím nổi bật 100%
    ctx.beginPath();
    ctx.arc(0, 0, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = isActive
      ? '#ffe082'
      : (isMaimaiDisabled ? 'rgba(40, 10, 15, 0.85)' : 'rgba(15, 23, 42, 0.90)');
    ctx.fill();

    ctx.strokeStyle = isActive
      ? '#ffffff'
      : (isMaimaiDisabled ? 'rgba(244, 67, 54, 0.7)' : 'rgba(255, 124, 160, 0.8)');
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    if (isActive) {
      ctx.shadowColor = '#ff4d80';
      ctx.shadowBlur = 12;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ký tự phím hiển thị rõ nét ngay tâm
    const displayLabel = getLaneDisplayLabel(lane.lane, renderer.customKeybinds);
    const isWideText = displayLabel.length > 2;
    ctx.font = `bold ${Math.round((isWideText ? 9.5 : 11.5) * (scale / 240))}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isActive
      ? '#0f172a'
      : (isMaimaiDisabled ? '#ef5350' : '#ffffff');
    ctx.fillText(displayLabel, 0, 0.5);

    ctx.restore();
  }

  // 6. Maimai Center Hub (Tâm vòng tròn bạc đồng tâm chuẩn Maimai)
  ctx.save();
  // Vòng ngoài hub
  ctx.beginPath();
  ctx.arc(originPix.x, originPix.y, 22 * (scale / 240), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12, 15, 22, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Vòng trong hub
  ctx.beginPath();
  ctx.arc(originPix.x, originPix.y, 8 * (scale / 240), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(22, 26, 36, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Chốt định vị tâm
  ctx.beginPath();
  ctx.arc(originPix.x, originPix.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ff4d80';
  ctx.fill();
  ctx.restore(); // Kết thúc Hub

  ctx.restore(); // Kết thúc nhóm mờ đường ray & tap lanes khi typing

  return originPix;
}
