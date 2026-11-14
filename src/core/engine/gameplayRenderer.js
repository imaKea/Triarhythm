/**
 * GameplayRenderer - Bộ dựng hình Canvas 2D theo phong cách Neon Cyber / Arcade
 * Chuyển động note thẳng đều từ tâm tam giác (origin) ra 9 ô Tap elip
 * Dải capsule Hold co dần, màu "Each" vàng cho cặp nốt đồng thời, UR Bar và HUD
 *
 * Phần vẽ đã được tách theo nhóm:
 *   - renderers/drawLayout.js  : nền, tam giác, lane, hub
 *   - renderers/drawNotes.js   : tap/hold/break/ring/slide/typing
 *   - renderers/drawHud.js     : combo, popup phán định, console bar, UR bar, skip
 * Class này giữ nguyên public API cũ cho GameEngine và các test hiện có.
 */

import { getLayoutMetrics } from '../../config/layout.config.js';
import {
  drawPlayfield,
  drawNotes,
  drawTypingSection,
  getTypingHitLinePos,
  drawCenterCombo,
  drawJudgements,
  drawHud,
  drawSkipPrompt,
  drawURBar
} from './renderers/index.js';

export class GameplayRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Cài đặt hiển thị mặc định
    this.noteSpeed = 10.0;
    this.backgroundDim = 0.75;
    this.showRayGuides = true;
    this.showURBar = true;
    this.noteRadiusScale = 1.0;
    this.customKeybinds = null;

    // Bộ đệm hoạt ảnh phán định (popups)
    this.judgementPopups = [];

    // Lịch sử tick cho UR Bar
    this.urTicks = []; // { deltaMs, judgement, alpha }
    this.maxUrTicks = 40;
  }

  /**
   * Tính travelTime (ms) từ Note Speed (NS 1.0 - 15.0, mặc định 10.0)
   */
  getTravelTime() {
    const ns = Math.max(1.0, Math.min(15.0, this.noteSpeed || 10.0));
    if (ns < 5.0) {
      // NS 1.0 = 1800ms -> NS 5.0 = 1200ms
      return 1200 + (600 * (5.0 - ns)) / 4.0;
    } else if (ns <= 10.0) {
      // NS 5.0 = 1200ms -> NS 10.0 = 450ms
      return 1200 - (750 * (ns - 5.0)) / 5.0;
    } else {
      // NS 10.0 = 450ms -> NS 15.0 = 200ms (tốc độ cao arcade)
      return 450 - (250 * (ns - 10.0)) / 5.0;
    }
  }

  /**
   * Thêm popup phán định hiển thị kèm FAST / LATE chuẩn maimai DX
   * Đối với Slide Note: hiển thị tỉ lệ ratio % ở nhãn phụ và không đưa vào UR bar
   */
  addJudgementPopup(judgement, deltaMs, targetX, targetY, customSub = null, isSlide = false) {
    const textMap = {
      CRITICAL_PERFECT: { label: 'CRITICAL', color: '#ffea00', sub: 'PERFECT', subColor: '#ffffff' },
      PERFECT: { label: 'PERFECT', color: '#ffd600', sub: null, subColor: '#ffffff' },
      GREAT: { label: 'GREAT', color: '#00e676', sub: null, subColor: '#ffffff' },
      GOOD: { label: 'GOOD', color: '#ff9100', sub: null, subColor: '#ffffff' },
      MISS: { label: 'MISS', color: '#78909c', sub: null, subColor: '#ffffff' }
    };

    const config = textMap[judgement] || textMap.MISS;

    let sub = customSub !== null ? customSub : config.sub;
    let subColor = customSub !== null ? '#00e5ff' : config.subColor;

    // Hiển thị FAST / LATE chuẩn maimai DX cho các cú gõ không đạt CRITICAL
    if (!isSlide && customSub === null && judgement !== 'CRITICAL_PERFECT' && judgement !== 'MISS') {
      if (deltaMs < -10) {
        sub = 'FAST';
        subColor = '#00e5ff'; // Cyan FAST
      } else if (deltaMs > 10) {
        sub = 'LATE';
        subColor = '#ff5252'; // Red LATE
      }
    }

    this.judgementPopups.push({
      label: config.label,
      sub,
      subColor,
      color: config.color,
      deltaMs,
      x: targetX,
      y: targetY,
      time: 0,
      maxTime: 0.32 // Rút ngắn thời gian fade-out xuống khoảng 0.25s-0.30s chống chồng chữ
    });

    if (!isSlide && judgement !== 'MISS') {
      this.urTicks.push({
        deltaMs,
        judgement,
        alpha: 1.0
      });
      if (this.urTicks.length > this.maxUrTicks) {
        this.urTicks.shift();
      }
    }
  }

  /**
   * Cập nhật hoạt ảnh phán định và UR ticks
   */
  update(dt) {
    // Cập nhật popups
    for (let i = this.judgementPopups.length - 1; i >= 0; i--) {
      const p = this.judgementPopups[i];
      p.time += dt;
      if (p.time >= p.maxTime) {
        this.judgementPopups.splice(i, 1);
      }
    }

    // Mờ dần các tick trên UR bar
    for (const tick of this.urTicks) {
      tick.alpha = Math.max(0.2, tick.alpha - dt * 0.15);
    }
  }

  /**
   * Vẽ toàn bộ khung hình gameplay
   */
  render(gameState, particleSystem) {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;

    const metrics = getLayoutMetrics(width, height);
    const { scale } = metrics;
    const travelTime = this.getTravelTime();
    const songTime = gameState.songTime;

    // 1-6. Nền + viền tam giác + guide lines + 9 ô Tap + hub
    const originPix = drawPlayfield(this, gameState, width, height, scale, travelTime);

    // 6b. Cụm chỉ số Combo ở giữa (nằm dưới Z-index nốt nhạc, opacity 45%)
    drawCenterCombo(this, gameState, width, height, originPix, scale);

    // 7. Vẽ các note đang hoạt động (Sắp xếp: p nhỏ trước, p lớn sau; time sớm nằm trên)
    drawNotes(this, gameState.activeNotes, songTime, travelTime, scale, width, height);

    // 8. Hạt hiệu ứng
    if (particleSystem) {
      particleSystem.draw(ctx);
    }

    // 9. Popups Phán định
    drawJudgements(this, scale);

    // 10. Con trỏ chuột / Touch Ring chuẩn maimai DX
    if (gameState.pointer && gameState.pointer.pos) {
      this.renderPointerRing(gameState.pointer.pos, gameState.pointer.isDown, scale);
    }

    // 10b. Dải cuộn ngang Typing Section (GĐ5 - Rhythm Typer)
    if (gameState.activeTypingSection) {
      drawTypingSection(ctx, gameState.activeTypingSection, songTime, travelTime, width, height, scale);
    }

    // 11. HUD (Score, Combo, UR Bar, Progress)
    drawHud(this, gameState, width, height);
  }

  // =========================================================================
  // Các phương thức uỷ quyền - giữ public API cũ
  // =========================================================================

  renderNotes(notes, songTime, travelTime, scale, width, height) {
    drawNotes(this, notes, songTime, travelTime, scale, width, height);
  }

  renderJudgements(scale) {
    drawJudgements(this, scale);
  }

  renderCenterCombo(gameState, width, height, originPix, scale) {
    drawCenterCombo(this, gameState, width, height, originPix, scale);
  }

  renderHUD(gameState, width, height) {
    drawHud(this, gameState, width, height);
  }

  renderSkipPrompt(width, height) {
    drawSkipPrompt(this, width, height);
  }

  getTypingHitLinePos(width, height, scale = 240) {
    return getTypingHitLinePos(width, height, scale);
  }

  renderTypingSection(ctx, note, songTime, travelTime, width, height, scale) {
    drawTypingSection(ctx, note, songTime, travelTime, width, height, scale);
  }

  drawURBar(width, height, urValue, isTypingActive = false) {
    drawURBar(this, width, height, urValue, isTypingActive);
  }

  /**
   * Dựng hình vòng ngắm con trỏ / Touch Ring maimai DX khi người chơi tương tác trên Canvas
   */
  renderPointerRing(pos, isDown, scale) {
    if (!pos) return;
    const { ctx } = this;
    const ringRadius = Math.max(16, 22 * (scale / 240));

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Vầng hào quang ngoài khi nhấn
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * (isDown ? 1.35 : 1.1), 0, Math.PI * 2);
    ctx.fillStyle = isDown ? 'rgba(0, 229, 255, 0.28)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fill();

    // Vòng tròn định vị chính
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isDown ? '#00e5ff' : 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = isDown ? 2.5 : 1.5;
    if (isDown) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 14;
    }
    ctx.stroke();

    // Điểm tâm cảm ứng
    ctx.beginPath();
    ctx.arc(0, 0, isDown ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isDown ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  }
}
