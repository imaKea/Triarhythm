/**
 * Nhóm vẽ note: Tap / Hold / Break / Ring / Slide / Typing.
 * Tách khỏi GameplayRenderer để dễ đọc và test riêng phần hình học.
 */

import { TRI_RING_LAYOUT, layoutToPixels, getTapLane } from '../../../config/layout.config.js';

/**
 * Vẽ toàn bộ note đang hoạt động.
 */
export function drawNotes(renderer, notes, songTime, travelTime, scale, width, height) {
  const { ctx } = renderer;
  const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, width, height);
  const spawnFrac = TRI_RING_LAYOUT.spawnFrac;
  const baseNoteRadius = TRI_RING_LAYOUT.noteRadius * scale * renderer.noteRadiusScale;

  // 1. Dựng hình các nốt Ring có kích thước bằng cả outline game (từ nhỏ thành lớn, bấm phím SPACE)
  for (const note of notes) {
    if (note.type === 'ring' || note.type === 'slide') {
      drawRingNote(ctx, note, songTime, travelTime, scale, width, height);
    }
  }

  // Sắp xếp thứ tự vẽ: note xa vẽ trước, note gần đích (p lớn hơn) đè lên; time sớm hơn nằm trên
  const sorted = [...notes].sort((a, b) => {
    const pa = (songTime - (a.time - travelTime)) / travelTime;
    const pb = (songTime - (b.time - travelTime)) / travelTime;
    if (Math.abs(pa - pb) > 0.001) return pa - pb;
    return b.time - a.time;
  });

  // 2. Dựng hình chi tiết các nốt Tap, Hold, Break (Không vẽ đường ray nối giữa các note)
  for (const note of sorted) {
    if (note.type === 'typing' || note.type === 'slide' || note.type === 'ring') continue;

    const targetLane = getTapLane(note.lane);
    if (!targetLane) continue;

    const targetPix = layoutToPixels(targetLane.x, targetLane.y, width, height);

    // Điểm xuất phát (S) trên tia từ tâm ra đích
    const startX = originPix.x + (targetPix.x - originPix.x) * spawnFrac;
    const startY = originPix.y + (targetPix.y - originPix.y) * spawnFrac;

    const pHead = (songTime - (note.time - travelTime)) / travelTime;

    // Note chưa xuất hiện hoặc đã kết thúc
    if (pHead < 0) continue;
    if (pHead > 1.12 && note.type !== 'hold') continue;

    // Màu note: Cặp nốt đồng thời (each) chuyển sang vàng neon
    let noteColor = '#ff6f99'; // Kawaii Pink
    if (note.isEach) {
      noteColor = '#ffd76f'; // Vàng "each"
    } else if (note.type === 'hold') {
      noteColor = '#ff9d62'; // Hold cam vàng
    } else if (note.type === 'break') {
      noteColor = '#e8284f'; // Break cam đỏ
    }

    if (note.isHoldingDropped) {
      noteColor = '#b9a3ad'; // Hold bị thả sớm
    }

    // Xử lý HOLD NOTE: Dải capsule dọc theo tia
    if (note.type === 'hold') {
      const pTail = (songTime - (note.endTime - travelTime)) / travelTime;
      if (pTail > 1.12) continue;

      // Kẹp p tối đa bằng 1 khi head đã tới đích
      const clampedHeadP = Math.max(0, Math.min(1.0, pHead));
      const clampedTailP = Math.max(0, Math.min(1.0, pTail));

      const headPos = {
        x: startX + (targetPix.x - startX) * clampedHeadP,
        y: startY + (targetPix.y - startY) * clampedHeadP
      };
      const tailPos = {
        x: startX + (targetPix.x - startX) * clampedTailP,
        y: startY + (targetPix.y - startY) * clampedTailP
      };

      // Vẽ thân dải hold (kèm hiệu ứng fade-in mượt mà khi xuất phát từ tâm)
      const holdFadeIn = Math.min(1.0, Math.sin(Math.min(1.0, Math.max(0, pHead) / 0.35) * (Math.PI / 2)));
      const holdFadeOut = pTail > 1.0 ? Math.max(0, 1 - (pTail - 1.0) / 0.12) : 1.0;
      ctx.save();
      ctx.globalAlpha = holdFadeIn * holdFadeOut;
      ctx.beginPath();
      ctx.moveTo(tailPos.x, tailPos.y);
      ctx.lineTo(headPos.x, headPos.y);
      ctx.strokeStyle = note.isHolding ? '#ffd54f' : noteColor;
      ctx.lineWidth = baseNoteRadius * 1.6;
      ctx.lineCap = 'round';
      ctx.shadowColor = noteColor;
      ctx.shadowBlur = note.isHolding ? 24 : 10;
      ctx.stroke();

      // Lõi sáng bên trong dải hold
      ctx.beginPath();
      ctx.moveTo(tailPos.x, tailPos.y);
      ctx.lineTo(headPos.x, headPos.y);
      ctx.strokeStyle = note.isHolding ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = baseNoteRadius * 0.7;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Tia lửa điện chạy dọc theo thân dải hold khi đang giữ
      if (note.isHolding) {
        const sparkProgress = (songTime * 0.005) % 1.0;
        const sparkX = tailPos.x + (headPos.x - tailPos.x) * sparkProgress;
        const sparkY = tailPos.y + (headPos.y - tailPos.y) * sparkProgress;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, baseNoteRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.fill();
      }
      ctx.restore();
    }

    // Vị trí tâm note hiện tại
    const p = Math.max(0, pHead);
    const currentX = startX + (targetPix.x - startX) * p;
    const currentY = startY + (targetPix.y - startY) * p;

    // Scale và Alpha: hiệu ứng mờ -> rõ dần mượt mà khi nốt xuất hiện từ tâm ra
    const scaleFactor = 0.5 + 0.5 * Math.min(1, p / 0.3);
    const fadeIn = Math.min(1.0, Math.sin(Math.min(1.0, p / 0.35) * (Math.PI / 2)));
    const fadeOut = p > 1.0 ? Math.max(0, 1 - (p - 1.0) / 0.12) : 1.0;
    const alpha = fadeIn * fadeOut;
    const radius = baseNoteRadius * scaleFactor;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(currentX, currentY);

    // Dựng hình Maimai Ring Note sắc nét & chuyên nghiệp (không màu mè, đúng chất arcade)
    if (note.type === 'tap' || note.type === 'break') {
      const ringWidth = Math.max(3, radius * 0.38);

      // Vòng màu maimai chính (Pink #ff2a70 hoặc Each Yellow #ffe600 hoặc Break Red-Orange #ff3d00)
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, radius - ringWidth / 2), 0, Math.PI * 2);
      ctx.strokeStyle = noteColor;
      ctx.lineWidth = ringWidth;
      ctx.stroke();

      // Viền trắng sắc nét mép ngoài
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = note.type === 'break' ? 2.5 : 1.5;
      ctx.stroke();

      // Viền trắng mép trong
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, radius - ringWidth), 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, radius * 0.12);
      ctx.stroke();

      // Với nốt Break: ngôi sao 8 cánh vàng rực rỡ tỏa sáng ở tâm chuẩn Maimai
      if (note.type === 'break') {
        drawBreakStar(ctx, 0, 0, radius * 0.55);
      }
    } else {
      // Nốt đầu của Hold
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = note.isHolding ? '#ffd54f' : noteColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Ngôi sao 8 cánh rực rỡ cho nốt Break chuẩn Maimai
 */
function drawBreakStar(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const outerAngle = (i * Math.PI) / 4;
    const innerAngle = outerAngle + Math.PI / 8;
    const ox = cx + Math.cos(outerAngle) * r;
    const oy = cy + Math.sin(outerAngle) * r;
    const ix = cx + Math.cos(innerAngle) * (r * 0.42);
    const iy = cy + Math.sin(innerAngle) * (r * 0.42);

    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffea00';
  ctx.shadowColor = '#ffea00';
  ctx.shadowBlur = 10;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

/**
 * Dựng hình nốt Ring có hình dạng kích thước bằng cả outline game (Bowed Inverted Triangle)
 * Hỗ trợ cả nốt Ring Tap thường và nốt Hold Ring (viền cầu vồng như Rhythm Typer / Maimai Touch Hold)
 * Người chơi nhấn hoặc giữ phím SPACE để phán định nốt này
 */
function drawRingNote(ctx, note, songTime, travelTime, scale, width, height) {
  const isHoldRing = Boolean(note.isHold && note.endTime && note.endTime > note.time);
  const approachStart = note.time - travelTime;

  if (songTime < approachStart) return;

  const originPix = layoutToPixels(TRI_RING_LAYOUT.origin.x, TRI_RING_LAYOUT.origin.y, width, height);
  const v = TRI_RING_LAYOUT.vertices;
  const tlPix = layoutToPixels(v.TL.x, v.TL.y, width, height);
  const trPix = layoutToPixels(v.TR.x, v.TR.y, width, height);
  const bPix = layoutToPixels(v.B.x, v.B.y, width, height);
  const cc = TRI_RING_LAYOUT.curveControl;
  const cpTopPix = layoutToPixels(cc.top.x, cc.top.y, width, height);
  const cpLeftPix = layoutToPixels(cc.left.x, cc.left.y, width, height);
  const cpRightPix = layoutToPixels(cc.right.x, cc.right.y, width, height);

  const getScaledPoints = (s) => {
    const ox = originPix.x;
    const oy = originPix.y;
    return {
      tl: { x: ox + (tlPix.x - ox) * s, y: oy + (tlPix.y - oy) * s },
      tr: { x: ox + (trPix.x - ox) * s, y: oy + (trPix.y - oy) * s },
      b:  { x: ox + (bPix.x - ox) * s,  y: oy + (bPix.y - oy) * s },
      cpTop:   { x: ox + (cpTopPix.x - ox) * s,   y: oy + (cpTopPix.y - oy) * s },
      cpRight: { x: ox + (cpRightPix.x - ox) * s, y: oy + (cpRightPix.y - oy) * s },
      cpLeft:  { x: ox + (cpLeftPix.x - ox) * s,  y: oy + (cpLeftPix.y - oy) * s }
    };
  };

  const tracePoints = (pts) => {
    ctx.moveTo(pts.tl.x, pts.tl.y);
    ctx.quadraticCurveTo(pts.cpTop.x, pts.cpTop.y, pts.tr.x, pts.tr.y);
    ctx.quadraticCurveTo(pts.cpRight.x, pts.cpRight.y, pts.b.x, pts.b.y);
    ctx.quadraticCurveTo(pts.cpLeft.x, pts.cpLeft.y, pts.tl.x, pts.tl.y);
    ctx.closePath();
  };

  if (!isHoldRing) {
    // --- NỐT RING TAP THƯỜNG (MÀU XANH CYAN #00e5ff, TRONG LÒNG RỖNG) ---
    const p = (songTime - approachStart) / travelTime;
    if (p < 0 || p > 1.15) return;

    const fadeIn = Math.min(1.0, Math.sin(Math.min(1.0, p / 0.35) * (Math.PI / 2)));
    const fadeOut = p > 1.0 ? Math.max(0, 1 - (p - 1.0) / 0.15) : 1.0;
    const alpha = fadeIn * fadeOut;
    const currentScale = Math.max(0.01, p);
    const pts = getScaledPoints(currentScale);

    const noteColor = '#67b9ed';
    const auraColor = 'rgba(103, 185, 237, 0.35)';

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Hào quang ngoài
    ctx.beginPath();
    tracePoints(pts);
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = 8;
    ctx.stroke();

    // 2. Viền xanh cyan chính
    ctx.beginPath();
    tracePoints(pts);
    ctx.strokeStyle = noteColor;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 3. Lõi trắng sắc nét (trong lòng hoàn toàn rỗng, không fill)
    ctx.beginPath();
    tracePoints(pts);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  } else {
    // --- NỐT HOLD RING (MÀU XANH LÁ NEON #00e676 - DỄ PHÂN BIỆT VỚI RING TAP CYAN #00e5ff) ---
    // GỒM 3 PHẦN: ĐẦU, THÂN VÀ ĐUÔI
    const totalHoldMs = note.endTime - note.time;
    const isApproaching = songTime < note.time;
    const isEnding = songTime > note.endTime;

    if (isEnding && (songTime - note.endTime) > 150) return;

    const greenColor = '#8fd0f5';
    const greenAura = 'rgba(143, 208, 245, 0.35)';

    if (isApproaching) {
      // Giai đoạn bay tới (Phóng to dần từ tâm ra viền outline, thuần màu xanh lá neon #00e676, rỗng lòng)
      const p = (songTime - approachStart) / travelTime;
      const alpha = Math.min(1.0, Math.sin(Math.min(1.0, p / 0.35) * (Math.PI / 2)));
      const currentScale = Math.max(0.01, p);
      const pts = getScaledPoints(currentScale);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Hào quang ngoài xanh lá
      ctx.beginPath();
      tracePoints(pts);
      ctx.strokeStyle = greenAura;
      ctx.lineWidth = 8;
      ctx.stroke();

      // Viền xanh lá chính
      ctx.beginPath();
      tracePoints(pts);
      ctx.strokeStyle = greenColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Lõi trắng sắc nét (trong lòng rỗng)
      ctx.beginPath();
      tracePoints(pts);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    } else {
      // Giai đoạn đang giữ (Hold Phase):
      // Yêu cầu: Gồm cả 3 phần:
      // - Phần đầu: Viền ngoài cố định tại outline (xanh lá neon)
      // - Phần thân: Vùng nằm giữa phần đầu và phần đuôi (ring ở trong) -> MÀU XANH LÁ OPACITY THẤP (0.18)
      // - Phần đuôi: Vòng ring ở trong nở từ tâm ra ngoài (xanh lá neon) -> PHÍA TRONG ĐUÔI SẼ KHÔNG CÓ MÀU (rỗng hoàn toàn)
      const fadeOut = isEnding ? Math.max(0, 1 - (songTime - note.endTime) / 150) : 1.0;
      const holdElapsed = songTime - note.time;
      const expandRatio = Math.max(0.01, Math.min(1.0, holdElapsed / totalHoldMs));

      ctx.save();
      ctx.globalAlpha = fadeOut;

      const outerPts = getScaledPoints(1.0);
      const innerPts = getScaledPoints(expandRatio);

      // 1. PHẦN THÂN: Tô màu xanh lá với opacity thấp CHỈ ở vùng giữa phần đầu (1.0) và phần đuôi (expandRatio)
      // Áp dụng quy tắc 'evenodd' fill:
      // - Vùng giữa đầu và đuôi (phần thân) -> ĐƯỢC TÔ MÀU XANH LÁ OPACITY THẤP (0.18)
      // - Vùng phía trong phần đuôi (ring ở trong) -> HOÀN TOÀN TRONG SUỐT / KHÔNG CÓ MÀU
      if (!isEnding && expandRatio < 1.0) {
        ctx.save();
        ctx.beginPath();
        tracePoints(outerPts); // Subpath 1: Viền đầu ngoài
        tracePoints(innerPts); // Subpath 2: Viền đuôi trong
        ctx.fillStyle = 'rgba(143, 208, 245, 0.25)';
        ctx.fill('evenodd');
        ctx.restore();
      }

      // 2. PHẦN ĐẦU: Viền ngoài cố định tại outline (xanh lá neon #00e676)
      ctx.save();
      ctx.beginPath();
      tracePoints(outerPts);
      ctx.strokeStyle = greenAura;
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.beginPath();
      tracePoints(outerPts);
      ctx.strokeStyle = greenColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      tracePoints(outerPts);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // 3. PHẦN ĐUÔI: Vòng ring ở trong nở từ tâm ra ngoài (phía trong rỗng, chỉ vẽ nét viền đuôi xanh lá)
      if (expandRatio > 0 && expandRatio <= 1.0) {
        ctx.save();
        // Hào quang đuôi xanh lá
        ctx.beginPath();
        tracePoints(innerPts);
        ctx.strokeStyle = greenAura;
        ctx.lineWidth = 6;
        ctx.stroke();

        // Nét viền xanh lá chính của đuôi
        ctx.beginPath();
        tracePoints(innerPts);
        ctx.strokeStyle = greenColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Lõi trắng sắc nét của đuôi
        ctx.beginPath();
        tracePoints(innerPts);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }
  }
}

/**
 * Tính toán vị trí điểm phán định vạch gõ Typing Section
 */
export function getTypingHitLinePos(width, height, scale = 240) {
  const stripHeight = Math.max(46, 52 * (scale / 240));
  const stripY = height - stripHeight - 16;
  const stripWidth = Math.min(width * 0.94, 860);
  const stripX = (width - stripWidth) / 2;
  const hitLineX = stripX + stripWidth * 0.22;
  return {
    x: hitLineX,
    y: stripY + stripHeight / 2
  };
}

/**
 * Dựng hình dải cuộn ngang Typing Section ở mép dưới canvas (GĐ5 - Rhythm Typer)
 */
export function drawTypingSection(ctx, note, songTime, travelTime, width, height, scale) {
  if (!note || !note.chars || note.chars.length === 0) return;

  const stripHeight = Math.max(46, 52 * (scale / 240));
  const stripY = height - stripHeight - 16;
  const stripWidth = Math.min(width * 0.94, 860);
  const stripX = (width - stripWidth) / 2;

  const hitLineX = stripX + stripWidth * 0.22;
  const scrollDistance = stripWidth * 0.72;

  ctx.save();

  // 1. Thân dải Typing (Glassmorphism dark cyber strip)
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(stripX, stripY, stripWidth, stripHeight, 10);
  } else {
    ctx.rect(stripX, stripY, stripWidth, stripHeight);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 124, 160, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Nhãn dải "TYPING SECTION" ở góc trái
  ctx.font = `bold ${Math.round(9 * (scale / 240))}px Orbitron, sans-serif`;
  ctx.fillStyle = '#e94270';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('TYPING SECTION', stripX + 12, stripY + 6);

  // 3. Vạch phán định (Hitline) ở đầu trái dải
  ctx.beginPath();
  ctx.moveTo(hitLineX, stripY + 4);
  ctx.lineTo(hitLineX, stripY + stripHeight - 4);
  ctx.strokeStyle = '#ff4d80';
  ctx.lineWidth = 2.5;
  if (ctx.shadowColor !== undefined) {
    ctx.shadowColor = '#ff4d80';
    ctx.shadowBlur = 10;
  }
  ctx.stroke();

  // Khung định vị tại vạch
  ctx.strokeRect(hitLineX - 18, stripY + (stripHeight - 36) / 2, 36, 36);

  // Tìm ký tự đang PENDING đầu tiên để làm nổi bật (target char)
  const nextPendingIndex = note.chars.findIndex(c => c.state === 'PENDING');

  // 4. Các chip ký tự trôi từ phải sang trái về hitLineX
  const chipW = 34;
  const chipH = 34;
  const chipY = stripY + (stripHeight - chipH) / 2;

  for (let i = 0; i < note.chars.length; i++) {
    const charObj = note.chars[i];
    const p = (charObj.time - songTime) / travelTime;
    const chipX = hitLineX + p * scrollDistance;

    // Chỉ vẽ các chip nằm trong vùng dải
    if (chipX < stripX - 40 || chipX > stripX + stripWidth + 40) continue;

    const isTarget = i === nextPendingIndex;

    // Hiệu ứng fade in mượt mà khi chip xuất hiện từ mép phải dải
    const distFromRight = (stripX + stripWidth) - chipX;
    const chipFade = Math.max(0, Math.min(1.0, distFromRight / 50));

    ctx.save();
    ctx.globalAlpha = chipFade;
    ctx.translate(chipX, chipY);

    // Card nền của chip
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-chipW / 2, 0, chipW, chipH, 6);
    } else {
      ctx.rect(-chipW / 2, 0, chipW, chipH);
    }

    let borderColor = 'rgba(255, 124, 160, 0.4)';
    let bgColor = 'rgba(255, 255, 255, 0.9)';
    let textColor = '#5b2a47';

    if (charObj.state === 'JUDGED') {
      const jCol = {
        CRITICAL_PERFECT: '#ffea00',
        PERFECT: '#ffd600',
        GREAT: '#00e676',
        GOOD: '#ff9100'
      }[charObj.judgement] || '#00e676';
      borderColor = jCol;
      bgColor = 'rgba(255, 255, 255, 0.95)';
      textColor = jCol;
    } else if (charObj.state === 'MISSED') {
      borderColor = 'rgba(120, 144, 156, 0.4)';
      bgColor = 'rgba(255, 240, 245, 0.8)';
      textColor = '#78909c';
    } else if (isTarget) {
      borderColor = '#ff4d80';
      bgColor = '#fff0f4';
      textColor = '#e94270';
      if (ctx.shadowColor !== undefined) {
        ctx.shadowColor = '#ff4d80';
        ctx.shadowBlur = 12;
      }
    }

    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isTarget ? 2.5 : 1.2;
    ctx.stroke();

    // Ký tự hiển thị (in hoa badge)
    ctx.font = `bold ${Math.round(18 * (scale / 240))}px Orbitron, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(charObj.char.toUpperCase(), 0, chipH / 2);

    ctx.restore();
  }

  ctx.restore();
}
