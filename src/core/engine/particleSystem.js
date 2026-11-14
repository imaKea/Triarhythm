/**
 * ParticleSystem - Hệ thống hạt và hiệu ứng sóng kích nổ (Shockwave Ripple) chuẩn maimai DX
 * Sử dụng Object Pooling, không cấp phát bộ nhớ trong vòng lặp render
 */

export class ParticleSystem {
  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
    this.particles = new Array(maxParticles);
    this.activeCount = 0;

    // Bộ đệm sóng kích nổ vòng tròn (Maimai Shockwave Ripples)
    this.ripples = [];

    for (let i = 0; i < maxParticles; i++) {
      this.particles[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: '#ffffff',
        radius: 2,
        life: 0,
        maxLife: 1.0,
        alpha: 1.0,
        decay: 1.0,
        isStar: false
      };
    }
  }

  /**
   * Tạo sóng kích nổ vòng tròn (Maimai Shockwave Ring) tỏa ra từ điểm trúng nốt
   */
  spawnRipple(x, y, color = '#ffffff', maxRadius = 45, duration = 0.35, lineWidth = 2.5, isDouble = false) {
    this.ripples.push({
      x,
      y,
      color,
      radius: 8,
      maxRadius,
      duration,
      life: 0,
      lineWidth,
      isDouble
    });
  }

  /**
   * Phát chùm hạt nổ tại điểm (x, y)
   * @param {number} x Tọa độ pixel X
   * @param {number} y Tọa độ pixel Y
   * @param {string} color Màu hạt
   * @param {number} count Số lượng hạt
   * @param {number} speed Tốc độ bung
   * @param {boolean} isStar Hạt hình sao (dành cho Break)
   */
  spawnBurst(x, y, color = '#ff4081', count = 16, speed = 120, isStar = false) {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxParticles) break;

      const p = this.particles.find(pt => !pt.active);
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;

      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.color = color;
      p.radius = isStar ? (3 + Math.random() * 4) : (2 + Math.random() * 3);
      p.life = 0;
      p.maxLife = 0.3 + Math.random() * 0.35;
      p.alpha = 1.0;
      p.isStar = isStar;

      this.activeCount++;
    }
  }

  /**
   * Cập nhật chuyển động các hạt và sóng kích nổ theo delta time (giây)
   */
  update(dt) {
    // 1. Cập nhật các hạt phân tử
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.activeCount--;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.alpha = Math.max(0, 1.0 - p.life / p.maxLife);
    }

    // 2. Cập nhật sóng kích nổ (Ripples)
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life += dt;
      if (r.life >= r.duration) {
        this.ripples.splice(i, 1);
      } else {
        const prog = r.life / r.duration;
        r.radius = 8 + (r.maxRadius - 8) * Math.sin((prog * Math.PI) / 2);
      }
    }
  }

  /**
   * Vẽ toàn bộ hạt và sóng kích nổ đang hoạt động lên Canvas
   */
  draw(ctx) {
    // 1. Vẽ các sóng kích nổ (Maimai Shockwave Rings)
    for (const r of this.ripples) {
      const prog = r.life / r.duration;
      const alpha = Math.max(0, 1.0 - Math.pow(prog, 1.5));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, r.lineWidth * (1.0 - prog * 0.6));

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (r.isDouble) {
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(1, r.radius * 0.68), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Vẽ các hạt phân tử
    if (this.activeCount === 0) return;

    ctx.save();
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.isStar) {
        this.drawStar(ctx, p.x, p.y, p.radius * p.alpha);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawStar(ctx, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const innerAngle = outerAngle + Math.PI / 5;
      const ox = cx + Math.cos(outerAngle) * r;
      const oy = cy + Math.sin(outerAngle) * r;
      const ix = cx + Math.cos(innerAngle) * (r * 0.45);
      const iy = cy + Math.sin(innerAngle) * (r * 0.45);

      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  clear() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
    }
    this.activeCount = 0;
    this.ripples = [];
  }
}
