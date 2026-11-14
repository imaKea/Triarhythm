/**
 * Vẽ canvas của Map Editor (thuần Canvas 2D, không phụ thuộc React).
 * Tách khỏi component để hook và panel dùng chung.
 */

import { TRI_RING_LAYOUT, layoutToPixels } from '../../config/layout.config.js';

/**
 * Vẽ preview nốt đang bay tại thời điểm curTime.
 */
export function drawEditorPreview(ctx, width, height, beatmap, selectedIndices, curTime) {
  ctx.clearRect(0, 0, width, height);

  // 1. Nền
  ctx.fillStyle = '#06080e';
  ctx.fillRect(0, 0, width, height);

  const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, width, height);
  const v = TRI_RING_LAYOUT.vertices;
  const tlPix = layoutToPixels(v.TL.x, v.TL.y, width, height);
  const trPix = layoutToPixels(v.TR.x, v.TR.y, width, height);
  const bPix = layoutToPixels(v.B.x, v.B.y, width, height);
  const cc = TRI_RING_LAYOUT.curveControl;
  const cpTopPix = layoutToPixels(cc.top.x, cc.top.y, width, height);
  const cpLeftPix = layoutToPixels(cc.left.x, cc.left.y, width, height);
  const cpRightPix = layoutToPixels(cc.right.x, cc.right.y, width, height);

  // 2. Viền ngoài tam giác bo cong
  ctx.beginPath();
  ctx.moveTo(tlPix.x, tlPix.y);
  ctx.quadraticCurveTo(cpTopPix.x, cpTopPix.y, trPix.x, trPix.y);
  ctx.quadraticCurveTo(cpRightPix.x, cpRightPix.y, bPix.x, bPix.y);
  ctx.quadraticCurveTo(cpLeftPix.x, cpLeftPix.y, tlPix.x, tlPix.y);
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // 3. 9 điểm nhận diện hình tròn & tia dẫn
  const scale = Math.min(width / TRI_RING_LAYOUT.bounds.width, height / TRI_RING_LAYOUT.bounds.height);
  for (const lane of TRI_RING_LAYOUT.tapLanes) {
    const p = layoutToPixels(lane.x, lane.y, width, height);

    // Tia dẫn
    ctx.beginPath();
    ctx.moveTo(originPix.x, originPix.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vòng tròn nút
    const rPix = lane.a * scale;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rPix, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Nhãn phím
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(lane.label, p.x, p.y);
  }

  // 4. Tâm Hub
  ctx.beginPath();
  ctx.arc(originPix.x, originPix.y, 16 * (scale / 240), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(25, 30, 45, 0.9)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 5. Nốt đang bay tới tại curTime (Live Preview)
  const travelTime = 450;
  for (let i = 0; i < beatmap.notes.length; i++) {
    const note = beatmap.notes[i];
    const pHead = (curTime - (note.time - travelTime)) / travelTime;
    const isSelected = selectedIndices.has(i);

    // Nốt Ring tam giác
    if (note.type === 'ring') {
      const isHoldRing = Boolean(note.isHold && note.endTime && note.endTime > note.time);
      if (pHead >= 0 && pHead <= 1.1) {
        const currentScale = Math.max(0.01, pHead);
        ctx.save();
        ctx.translate(originPix.x, originPix.y);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-originPix.x, -originPix.y);

        ctx.beginPath();
        ctx.moveTo(tlPix.x, tlPix.y);
        ctx.quadraticCurveTo(cpTopPix.x, cpTopPix.y, trPix.x, trPix.y);
        ctx.quadraticCurveTo(cpRightPix.x, cpRightPix.y, bPix.x, bPix.y);
        ctx.quadraticCurveTo(cpLeftPix.x, cpLeftPix.y, tlPix.x, tlPix.y);
        ctx.closePath();
        ctx.strokeStyle = isSelected ? '#ffea00' : (isHoldRing ? '#00e676' : '#00e5ff');
        ctx.lineWidth = Math.max(2, 4 / currentScale);
        ctx.stroke();
        ctx.restore();
      } else if (isHoldRing && curTime >= note.time && curTime <= note.endTime) {
        // Giai đoạn đang giữ nốt hold ring: phần thân giữa đầu và đuôi có opacity thấp, phía trong đuôi không có màu
        const holdElapsed = curTime - note.time;
        const totalHold = note.endTime - note.time;
        const expandScale = Math.max(0.01, Math.min(1.0, holdElapsed / totalHold));
        const ox = originPix.x;
        const oy = originPix.y;

        // 1. Phần thân: Vùng giữa đầu ngoài (1.0) và đuôi trong (expandScale) có opacity thấp (dùng evenodd)
        if (expandScale < 1.0) {
          ctx.save();
          ctx.beginPath();
          // Subpath 1: Outer head
          ctx.moveTo(tlPix.x, tlPix.y);
          ctx.quadraticCurveTo(cpTopPix.x, cpTopPix.y, trPix.x, trPix.y);
          ctx.quadraticCurveTo(cpRightPix.x, cpRightPix.y, bPix.x, bPix.y);
          ctx.quadraticCurveTo(cpLeftPix.x, cpLeftPix.y, tlPix.x, tlPix.y);
          ctx.closePath();

          // Subpath 2: Inner tail
          ctx.moveTo(ox + (tlPix.x - ox) * expandScale, oy + (tlPix.y - oy) * expandScale);
          ctx.quadraticCurveTo(ox + (cpTopPix.x - ox) * expandScale, oy + (cpTopPix.y - oy) * expandScale, ox + (trPix.x - ox) * expandScale, oy + (trPix.y - oy) * expandScale);
          ctx.quadraticCurveTo(ox + (cpRightPix.x - ox) * expandScale, oy + (cpRightPix.y - oy) * expandScale, ox + (bPix.x - ox) * expandScale, oy + (bPix.y - oy) * expandScale);
          ctx.quadraticCurveTo(ox + (cpLeftPix.x - ox) * expandScale, oy + (cpLeftPix.y - oy) * expandScale, ox + (tlPix.x - ox) * expandScale, oy + (tlPix.y - oy) * expandScale);
          ctx.closePath();

          ctx.fillStyle = 'rgba(0, 230, 118, 0.18)';
          ctx.fill('evenodd');
          ctx.restore();
        }

        // 2. Viền phần đầu ngoài
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tlPix.x, tlPix.y);
        ctx.quadraticCurveTo(cpTopPix.x, cpTopPix.y, trPix.x, trPix.y);
        ctx.quadraticCurveTo(cpRightPix.x, cpRightPix.y, bPix.x, bPix.y);
        ctx.quadraticCurveTo(cpLeftPix.x, cpLeftPix.y, tlPix.x, tlPix.y);
        ctx.closePath();
        ctx.strokeStyle = isSelected ? '#ffea00' : '#00e676';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.restore();

        // 3. Viền phần đuôi trong (nở từ tâm ra, phía trong hoàn toàn rỗng / không màu)
        if (expandScale > 0 && expandScale <= 1.0) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(ox + (tlPix.x - ox) * expandScale, oy + (tlPix.y - oy) * expandScale);
          ctx.quadraticCurveTo(ox + (cpTopPix.x - ox) * expandScale, oy + (cpTopPix.y - oy) * expandScale, ox + (trPix.x - ox) * expandScale, oy + (trPix.y - oy) * expandScale);
          ctx.quadraticCurveTo(ox + (cpRightPix.x - ox) * expandScale, oy + (cpRightPix.y - oy) * expandScale, ox + (bPix.x - ox) * expandScale, oy + (bPix.y - oy) * expandScale);
          ctx.quadraticCurveTo(ox + (cpLeftPix.x - ox) * expandScale, oy + (cpLeftPix.y - oy) * expandScale, ox + (tlPix.x - ox) * expandScale, oy + (tlPix.y - oy) * expandScale);
          ctx.closePath();
          ctx.strokeStyle = '#00e676';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }
      }
      continue;
    }

    // Nốt Tap / Hold / Break
    const lane = TRI_RING_LAYOUT.tapLanes[note.lane];
    if (!lane) continue;
    const targetPix = layoutToPixels(lane.x, lane.y, width, height);

    if (pHead >= 0 && pHead <= 1.1) {
      const curX = originPix.x + (targetPix.x - originPix.x) * pHead;
      const curY = originPix.y + (targetPix.y - originPix.y) * pHead;
      const radius = 18 * (scale / 240);

      ctx.save();
      ctx.beginPath();
      ctx.arc(curX, curY, radius, 0, Math.PI * 2);

      let color = '#ff2a70';
      if (note.type === 'break') color = '#ff3d00';
      if (note.type === 'hold') color = '#ff9100';
      if (isSelected) color = '#ffea00';

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffea00' : '#ffffff';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Vẽ dải mật độ nốt của bài hát trên overview scrubber.
 */
export function drawOverview(ctx, width, height, notes, totalDurationMs) {
  ctx.clearRect(0, 0, width, height);

  // Nền
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, width, height);

  // Vẽ từng note dưới dạng vạch màu
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const x = (n.time / totalDurationMs) * width;
    if (x < 0 || x > width) continue;

    let col = (n.isHold && n.endTime > n.time) ? '#00e676' : '#00e5ff'; // Ring Tap: cyan, Ring Hold: green
    if (n.type === 'tap') col = '#ff2a70';
    else if (n.type === 'break') col = '#ff3d00';
    else if (n.type === 'hold') col = '#ff9100';

    ctx.fillStyle = col;
    ctx.fillRect(Math.floor(x), 0, 1.5, height);
  }
}
