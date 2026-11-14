/**
 * Nhóm vẽ HUD: combo giữa, popup phán định, console bar, UR Bar, Skip prompt.
 */

import { TRI_RING_LAYOUT, layoutToPixels } from '../../../config/layout.config.js';

/**
 * Cụm chỉ số Combo ở giữa (Z-index nằm dưới nốt nhạc, opacity 45%)
 */
export function drawCenterCombo(renderer, gameState, width, height, originPix, scale) {
  // Chỉ vẽ combo ở giữa nếu được bật rõ ràng (mặc định hiển thị ở góc dưới trái chuẩn osu! lazer)
  if (!renderer.showCenterCombo) return;
  if (gameState.combo <= 0) return;
  const { ctx } = renderer;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Opacity 45% (trong khoảng 40-50%) để không che khuất điểm xuất phát của các nốt mới từ tâm
  ctx.globalAlpha = 0.45;

  const comboScale = 1.0 + Math.min(0.18, (gameState.comboPunch || 0) * 0.18);
  const posY = originPix.y + 46 * (scale / 240);

  ctx.font = `900 ${Math.round(42 * comboScale * (scale / 240))}px 'Torus', 'Nunito', 'Be Vietnam Pro', sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${gameState.combo}`, originPix.x, posY);

  ctx.font = `bold ${Math.round(10 * (scale / 240))}px 'Torus', 'Nunito', 'Be Vietnam Pro', sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText('COMBO', originPix.x, posY + 22 * (scale / 240));
  ctx.restore();
}

/**
 * Hiển thị chữ phán định bay lên tại đích (thu nhỏ 25%, đẩy lệch ra ngoài viền, mờ dần nhanh trong 0.25s)
 */
export function drawJudgements(renderer, scale) {
  const { ctx } = renderer;
  const originPix = layoutToPixels(
    TRI_RING_LAYOUT.origin.x,
    TRI_RING_LAYOUT.origin.y,
    renderer.canvas.width,
    renderer.canvas.height
  );

  for (const p of renderer.judgementPopups) {
    const progress = p.time / p.maxTime;
    // Rút ngắn fade-out xuống khoảng 0.25s
    const alpha = Math.max(0, 1.0 - Math.pow(progress, 1.4));

    // Tính hướng đẩy lệch chữ ra phía ngoài viền tam giác (tránh đè vào trong lòng tam giác & đè nốt kế tiếp)
    const dx = p.x - originPix.x;
    const dy = p.y - originPix.y;
    const dist = Math.hypot(dx, dy);
    let ux = 0, uy = -1;
    if (dist > 12) {
      ux = dx / dist;
      uy = dy / dist;
    }

    // Đẩy vị trí hiển thị chữ lệch ra ngoài viền khoảng 28px
    const outwardOffset = 28 * (scale / 240);
    const bounce = Math.sin(progress * Math.PI) * 8;
    const posX = p.x + ux * (outwardOffset + bounce);
    const posY = p.y + uy * (outwardOffset + bounce);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Chữ chính (thu nhỏ 25%: từ 20px xuống 15px) - Font Torus/Nunito chuẩn osu! lazer
    ctx.font = `900 ${Math.round(15 * (scale / 240))}px 'Torus', 'Nunito', 'Be Vietnam Pro', sans-serif`;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillText(p.label, posX, posY);

    if (p.sub) {
      // Chữ phụ (thu nhỏ 25%: từ 11px xuống 8.5px)
      ctx.font = `bold ${Math.round(8.5 * (scale / 240))}px 'Torus', 'Nunito', 'Be Vietnam Pro', sans-serif`;
      ctx.fillStyle = p.subColor || '#ffffff';
      ctx.fillText(p.sub, posX, posY + uy * 4 + 13 * (scale / 240));
    }

    ctx.restore();
  }
}

/**
 * Dựng HUD: maimai Top Console Bar, UR Bar
 */
export function drawHud(renderer, gameState, width, height) {
  const { ctx } = renderer;

  // 1. Maimai Arcade Top Console Bar (chỉ vẽ khi bật cờ showLegacyConsole, mặc định tắt theo phong cách osu! HUD)
  if (renderer.showLegacyConsole) {
    const barW = Math.min(360, width * 0.56);
    const barH = 26;
    const barX = (width - barW) / 2;
    const barY = 6;

    ctx.save();
    // Nền console mờ pastel
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 13);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 124, 160, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Vạch tiến độ bài hát dạng Segmented Ticks
    const prog = gameState.totalDuration > 0
      ? Math.min(1.0, Math.max(0, gameState.songTime / gameState.totalDuration))
      : 0;

    const ticksCount = 14;
    const tickStartX = barX + 10;
    const tickAvailableW = (barW * 0.36) - 12;
    const tickSpacing = tickAvailableW / ticksCount;
    const tickW = Math.max(2, tickSpacing * 0.65);
    const tickH = 10;
    const tickY = barY + (barH - tickH) / 2;

    for (let i = 0; i < ticksCount; i++) {
      const isFilled = (i + 1) / ticksCount <= prog;
      ctx.fillStyle = isFilled ? '#ff4d80' : 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(tickStartX + i * tickSpacing, tickY, tickW, tickH);
    }

    // Rank Badge ở giữa console
    const rankBadgeW = 50;
    const rankBadgeH = 18;
    const rankBadgeX = barX + barW * 0.40;
    const rankBadgeY = barY + (barH - rankBadgeH) / 2;
    ctx.beginPath();
    ctx.roundRect(rankBadgeX, rankBadgeY, rankBadgeW, rankBadgeH, 9);

    const isGoldRank = gameState.rank === 'SSS+' || gameState.rank === 'SSS';
    ctx.fillStyle = isGoldRank ? '#ffd700' : '#ff6f99';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 10px "Torus", "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isGoldRank ? '#000000' : '#ffffff';
    ctx.fillText(gameState.rank || 'D', rankBadgeX + rankBadgeW / 2, rankBadgeY + rankBadgeH / 2);

    // Điểm Achievement % ở bên phải console
    ctx.font = "900 13px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5b2a47';
    ctx.fillText(`${gameState.achievement.toFixed(4)}%`, barX + barW - 12, barY + barH / 2);
    ctx.restore();

    // Huy hiệu [ AUTO PLAY ]
    if (gameState.isAutoplay) {
      ctx.save();
      const badgeW = 96;
      const badgeH = 20;
      const badgeX = Math.max(12, barX - badgeW - 12);
      const badgeY = barY + (barH - badgeH) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      else ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = '900 9.5px "Torus", "Nunito", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.fillText('⚡ AUTO PLAY', badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.restore();
    }
  }

  // 2. UR Bar ở mép dưới cùng
  if (renderer.showURBar) {
    drawURBar(renderer, width, height, gameState.ur, gameState.isTypingActive);
  }

  // 3. Skip Break Prompt trên canvas (chỉ vẽ khi bật cờ showLegacySkip)
  if (renderer.showLegacySkip && gameState.canSkip) {
    drawSkipPrompt(renderer, width, height);
  }
}

/**
 * Dựng thông báo Skip Break / Intro (nhấn SPACE để skip)
 */
export function drawSkipPrompt(renderer, width, height) {
  const { ctx } = renderer;
  ctx.save();

  const promptW = Math.min(300, width * 0.48);
  const promptH = 34;
  const promptX = (width - promptW) / 2;
  const promptY = height - 56;

  // Hiệu ứng nhịp đập pulsing nhẹ
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);

  // Nền viên thuốc capsule
  ctx.beginPath();
  ctx.roundRect(promptX, promptY, promptW, promptH, 17);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();

  // Viền phát sáng neon hồng
  ctx.strokeStyle = `rgba(255, 124, 160, ${0.55 + 0.45 * pulse})`;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = '#ff7ca0';
  ctx.shadowBlur = 12 * pulse;
  ctx.stroke();

  // Chữ "⏩ NHẤN SPACE ĐỂ SKIP"
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px "Torus", "Nunito", sans-serif';
  ctx.fillStyle = '#5b2a47';
  ctx.fillText('⏩ NHẤN SPACE ĐỂ SKIP', width / 2, promptY + promptH / 2);

  ctx.restore();
}

/**
 * Vẽ thanh sai số nhịp gõ (UR Bar)
 */
export function drawURBar(renderer, width, height, urValue, isTypingActive = false) {
  const { ctx } = renderer;
  const barWidth = 240;
  const barHeight = 4;
  const cx = width / 2;
  const cy = isTypingActive ? height - 90 : height - 24;

  ctx.save();
  // Nền bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight);

  // Vạch cửa sổ Critical Perfect (±25ms)
  const cpWidth = (barWidth * 25) / 150;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
  ctx.fillRect(cx - cpWidth, cy - barHeight / 2, cpWidth * 2, barHeight);

  // Vạch trung tâm 0ms
  ctx.fillStyle = '#ff4d80';
  ctx.fillRect(cx - 1, cy - 6, 2, 12);

  // Vẽ các tick của các lần nhấn phím gần nhất (giữ nguyên màu judgement)
  for (const tick of renderer.urTicks) {
    const tickX = cx + (tick.deltaMs / 150) * (barWidth / 2);
    ctx.fillStyle = tick.judgement === 'CRITICAL_PERFECT' ? '#ffffff' : '#ffd54f';
    ctx.globalAlpha = tick.alpha;
    ctx.fillRect(tickX - 1, cy - 5, 2, 10);
  }

  // Nhãn UR
  ctx.globalAlpha = 1.0;
  ctx.textAlign = 'center';
  ctx.font = `9px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#a8556f';
  ctx.fillText(`UR: ${urValue.toFixed(1)}`, cx, cy + 14);

  ctx.restore();
}
