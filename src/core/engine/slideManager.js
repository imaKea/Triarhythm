/**
 * SlideManager - Xử lý chuyển động, vẽ đường dẫn mũi tên chevron và theo dõi con trỏ cho Slide Note
 * Chuẩn cơ chế maimai DX và Section 3.4 / GĐ4 của Triarhythm
 */

import { TRI_RING_LAYOUT, layoutToPixels } from '../../config/layout.config.js';
import { SLIDE_CONFIG, calculateSlideTiming } from '../../config/slide.config.js';

export class SlideManager {
  /**
   * Phân giải mục tiêu Slide (Slide Node S0..S2, Tap Lane T0..T8, hoặc tọa độ tùy ý {x, y})
   */
  static resolveTarget(target) {
    if (target === null || target === undefined) return { x: 0, y: 0, type: 'node', id: 0 };
    if (typeof target === 'object' && typeof target.x === 'number') {
      return { x: target.x, y: target.y, type: 'custom', id: null };
    }
    if (typeof target === 'string') {
      const upper = target.toUpperCase().trim();
      if (upper.startsWith('S')) {
        const id = parseInt(upper.slice(1), 10);
        const node = TRI_RING_LAYOUT.slideNodes[id];
        if (node) return { x: node.x, y: node.y, type: 'slide', id };
      }
      if (upper.startsWith('T') || upper.startsWith('L')) {
        const id = parseInt(upper.slice(1), 10);
        const lane = TRI_RING_LAYOUT.tapLanes[id];
        if (lane) return { x: lane.x, y: lane.y, type: 'tap', id };
      }
    }
    if (typeof target === 'number') {
      // 0, 1, 2 là Slide Nodes
      if (target >= 0 && target <= 2) {
        const node = TRI_RING_LAYOUT.slideNodes[target];
        if (node) return { x: node.x, y: node.y, type: 'slide', id: target };
      }
      // 3..8 là các Tap Lanes 3..8
      if (target >= 3 && target < TRI_RING_LAYOUT.tapLanes.length) {
        const lane = TRI_RING_LAYOUT.tapLanes[target];
        if (lane) return { x: lane.x, y: lane.y, type: 'tap', id: target };
      }
    }
    return { x: 0, y: 0, type: 'node', id: 0 };
  }

  /**
   * Tính toán polyline cho một chặng giữa targetA và targetB
   * Hỗ trợ các hình dạng: 'straight' (thẳng), 'v' (gập V qua tâm), 'curve'/'arc' (uốn cong qua tâm)
   */
  static getSegmentPolyline(targetA, targetB, shape = 'straight') {
    const A = this.resolveTarget(targetA);
    const B = this.resolveTarget(targetB);
    if (!A || !B) return null;

    const inset = SLIDE_CONFIG.slideInset;
    const distA = Math.hypot(A.x, A.y) || 1;
    const distB = Math.hypot(B.x, B.y) || 1;

    const A_prime = {
      x: A.x * (1 - inset / distA),
      y: A.y * (1 - inset / distA)
    };
    const B_prime = {
      x: B.x * (1 - inset / distB),
      y: B.y * (1 - inset / distB)
    };

    if (shape === 'v') {
      // Dạng góc gập V xuyên qua tâm (0, 0)
      return [A, A_prime, { x: 0, y: 0 }, B_prime, B];
    } else if (shape === 'curve' || shape === 'arc') {
      // Dạng đường cong vòng cung uốn qua tâm
      const midX = (A_prime.x + B_prime.x) / 2;
      const midY = (A_prime.y + B_prime.y) / 2;
      const ctrl = { x: midX * 0.35, y: midY * 0.35 };

      const curvePts = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt * mt * A_prime.x + 2 * mt * t * ctrl.x + t * t * B_prime.x;
        const y = mt * mt * A_prime.y + 2 * mt * t * ctrl.y + t * t * B_prime.y;
        curvePts.push({ x, y });
      }
      return [A, ...curvePts, B];
    }

    // Mặc định: Polyline 4 điểm [A, A', B', B]
    return [A, A_prime, B_prime, B];
  }

  /**
   * Nội suy vị trí (x, y) và góc hướng (angle) trên polyline bất kỳ tại tham số u (0 -> 1)
   */
  static interpolateOnPolyline(polyline, u) {
    if (!polyline || polyline.length < 2) return { x: 0, y: 0, angle: 0 };
    const clampedU = Math.max(0, Math.min(1.0, u));

    // Tính độ dài từng đoạn
    const segLens = [];
    let totalLen = 0;
    for (let i = 0; i < polyline.length - 1; i++) {
      const d = Math.hypot(polyline[i + 1].x - polyline[i].x, polyline[i + 1].y - polyline[i].y);
      segLens.push(d);
      totalLen += d;
    }

    if (totalLen <= 0.0001) {
      return { x: polyline[0].x, y: polyline[0].y, angle: 0 };
    }

    const targetDist = clampedU * totalLen;
    let accumulated = 0;

    for (let i = 0; i < segLens.length; i++) {
      const d = segLens[i];
      if (targetDist <= accumulated + d || i === segLens.length - 1) {
        const frac = d > 0 ? (targetDist - accumulated) / d : 0;
        const p0 = polyline[i];
        const p1 = polyline[i + 1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        return {
          x: p0.x + dx * frac,
          y: p0.y + dy * frac,
          angle: Math.atan2(dy, dx)
        };
      }
      accumulated += d;
    }

    const last = polyline[polyline.length - 1];
    return { x: last.x, y: last.y, angle: 0 };
  }

  /**
   * Tính toán trạng thái hiện tại của Slide Note tại songTime
   */
  static getSlideState(note, songTime, travelTime, defaultBeatLength = 250) {
    if (!note.timing) {
      note.timing = calculateSlideTiming(note, defaultBeatLength);
    }
    const { waitMs, glideStart, glideMs, glideEnd } = note.timing;
    const startNode = this.resolveTarget(note.path[0]);
    const endNode = this.resolveTarget(note.path[note.path.length - 1]);

    // 1. Giai đoạn 1: Bay từ origin vào node đầu
    if (songTime < note.time) {
      const p = (songTime - (note.time - travelTime)) / travelTime;
      const spawnFrac = TRI_RING_LAYOUT.spawnFrac;
      const startX = startNode.x * spawnFrac;
      const startY = startNode.y * spawnFrac;
      return {
        stage: 'APPROACH',
        progress: Math.max(0, p),
        x: startX + (startNode.x - startX) * Math.max(0, p),
        y: startY + (startNode.y - startY) * Math.max(0, p),
        angle: Math.atan2(startNode.y, startNode.x),
        revealProgress: 0,
        isGliding: false
      };
    }

    // 2. Giai đoạn 2 & 3: Đứng chờ tại node đầu, quét hiện đường chevron
    if (songTime >= note.time && songTime < glideStart) {
      const revealProgress = Math.min(1.0, (songTime - note.time) / SLIDE_CONFIG.pathRevealDurationMs);
      return {
        stage: 'WAITING',
        progress: 1.0,
        x: startNode.x,
        y: startNode.y,
        angle: 0,
        revealProgress,
        isGliding: false
      };
    }

    // 3. Giai đoạn 4: Lướt dọc theo chuỗi polyline
    if (songTime >= glideStart && songTime < glideEnd) {
      const totalGlideProgress = Math.min(1.0, (songTime - glideStart) / glideMs);
      const numSegments = note.path.length - 1;
      const segProgressGlobal = totalGlideProgress * numSegments;
      const segIdx = Math.min(numSegments - 1, Math.floor(segProgressGlobal));
      const segU = segProgressGlobal - segIdx;

      const shape = note.shape || note.shapes?.[segIdx] || 'straight';
      const polyline = this.getSegmentPolyline(note.path[segIdx], note.path[segIdx + 1], shape);
      const currentPos = this.interpolateOnPolyline(polyline, segU);

      return {
        stage: 'GLIDING',
        progress: totalGlideProgress,
        x: currentPos.x,
        y: currentPos.y,
        angle: currentPos.angle,
        revealProgress: 1.0,
        isGliding: true,
        currentSegment: segIdx
      };
    }

    // 4. Giai đoạn 5: Đã tới node cuối
    return {
      stage: 'FINISHED',
      progress: 1.0,
      x: endNode.x,
      y: endNode.y,
      angle: 0,
      revealProgress: 1.0,
      isGliding: false
    };
  }

  /**
   * Dựng hình đường dẫn Slide (chuỗi mũi tên chevron) và Ngôi sao Slide chuẩn maimai DX
   */
  static renderSlide(ctx, note, songTime, travelTime, scale, width, height) {
    const state = this.getSlideState(note, songTime, travelTime);
    if (state.stage === 'APPROACH' && state.progress < 0) return;

    // 1. Vẽ đường chevron nếu đã tới lúc quét hiện
    if (state.revealProgress > 0) {
      ctx.save();
      const numSegments = note.path.length - 1;
      for (let s = 0; s < numSegments; s++) {
        const shape = note.shape || note.shapes?.[s] || 'straight';
        const polyline = this.getSegmentPolyline(note.path[s], note.path[s + 1], shape);
        if (!polyline) continue;

        // Tính tổng độ dài polyline chặng này
        let segDist = 0;
        for (let i = 0; i < polyline.length - 1; i++) {
          segDist += Math.hypot(polyline[i + 1].x - polyline[i].x, polyline[i + 1].y - polyline[i].y);
        }
        const chevronsCount = Math.max(4, Math.floor(segDist / 0.12));

        for (let c = 1; c <= chevronsCount; c++) {
          const frac = c / (chevronsCount + 1);
          // Quét hiện từ đầu tới cuối
          const chevronGlobalProgress = (s + frac) / numSegments;
          if (chevronGlobalProgress > state.revealProgress) continue;

          // Đường hướng dẫn slider biến mất hoàn toàn sau khi lướt qua
          if (state.stage === 'FINISHED' || (state.isGliding && state.progress >= chevronGlobalProgress)) {
            continue;
          }

          const pt = this.interpolateOnPolyline(polyline, frac);
          const pix = layoutToPixels(pt.x, pt.y, width, height);

          ctx.save();
          ctx.translate(pix.x, pix.y);
          ctx.rotate(pt.angle);

          // Hiệu ứng sóng ánh sáng chạy dọc theo mũi tên trong lúc chờ 1 phách (chuẩn maimai 1-beat delay)
          let chevronAlpha = 0.9;
          if (state.stage === 'WAITING') {
            const wave = Math.sin((songTime * 0.008) - chevronGlobalProgress * Math.PI * 4);
            chevronAlpha = 0.45 + 0.55 * Math.max(0, wave);
          }
          ctx.globalAlpha = chevronAlpha;

          // Mũi tên chevron '>'
          const arrowSize = 9 * (scale / 240);
          ctx.beginPath();
          ctx.moveTo(-arrowSize * 0.6, -arrowSize * 0.7);
          ctx.lineTo(arrowSize * 0.6, 0);
          ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.7);
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // 2. Dựng hình Ngôi sao Slide 5 cánh rực rỡ chuẩn maimai DX
    const starPix = layoutToPixels(state.x, state.y, width, height);
    const starRadius = Math.max(12, 16 * (scale / 240));

    // Hiệu ứng fade in mượt mà khi ngôi sao xuất phát từ tâm ra tới node bắt đầu
    let starAlpha = 1.0;
    if (state.stage === 'APPROACH') {
      starAlpha = Math.min(1.0, Math.sin(Math.min(1.0, Math.max(0, state.progress) / 0.35) * (Math.PI / 2)));
    }

    ctx.save();
    ctx.globalAlpha = starAlpha;
    ctx.translate(starPix.x, starPix.y);

    // Hiệu ứng xoay của ngôi sao khi đang lướt hoặc nhấp nháy chờ 1 phách
    if (state.isGliding) {
      const rot = (songTime * 0.006) % (Math.PI * 2);
      ctx.rotate(rot);
    } else if (state.stage === 'WAITING') {
      const pulse = 1.0 + 0.08 * Math.sin(songTime * 0.015);
      ctx.scale(pulse, pulse);
    }

    // Vầng hào quang ngoài của sao (phản ánh hitbox mở rộng để chuột dễ bám theo)
    ctx.beginPath();
    ctx.arc(0, 0, starRadius * (note.isGrabbed ? 2.4 : 1.7), 0, Math.PI * 2);
    ctx.fillStyle = note.isGrabbed ? 'rgba(0, 229, 255, 0.35)' : 'rgba(41, 121, 255, 0.20)';
    ctx.fill();

    // Vòng hào quang định vị hitbox mở rộng khi đang lướt
    if (state.isGliding) {
      ctx.beginPath();
      ctx.arc(0, 0, starRadius * 2.2, 0, Math.PI * 2);
      ctx.strokeStyle = note.isGrabbed ? 'rgba(0, 229, 255, 0.55)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      if (ctx.setLineDash) ctx.setLineDash([3, 4]);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    }

    // Vẽ ngôi sao 5 cánh xanh dương maimai (#2979ff)
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const innerAngle = outerAngle + Math.PI / 5;
      const ox = Math.cos(outerAngle) * starRadius;
      const oy = Math.sin(outerAngle) * starRadius;
      const ix = Math.cos(innerAngle) * (starRadius * 0.48);
      const iy = Math.sin(innerAngle) * (starRadius * 0.48);

      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fillStyle = note.isGrabbed ? '#00e5ff' : '#2979ff';
    ctx.shadowColor = note.isGrabbed ? '#00e5ff' : '#2979ff';
    ctx.shadowBlur = note.isGrabbed ? 24 : 16;
    ctx.fill();

    // Viền trắng sắc nét của sao
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Lõi sao vàng / trắng ở tâm
    ctx.beginPath();
    ctx.arc(0, 0, starRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}
