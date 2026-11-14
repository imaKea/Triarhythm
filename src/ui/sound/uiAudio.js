/**
 * Triarhythm osu!(lazer) UI Audio Synthesizer (uiAudio.js)
 * Tổng hợp âm thanh UI nhẹ nhàng trực tiếp qua Web Audio API (không tải file ngoài).
 * Hỗ trợ các hiệu ứng âm thanh: hover, click, back, select, tick.
 */

let audioCtx = null;
const UI_SOUND_KEY = 'triarhythm_ui_sounds';

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isUISoundEnabled() {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  const val = localStorage.getItem(UI_SOUND_KEY);
  return val === null ? true : val === 'true';
}

export function setUISoundEnabled(enabled) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(UI_SOUND_KEY, enabled ? 'true' : 'false');
}

/**
 * Phát âm thanh hover phím/menu (ngắn, nhỏ gọn, âm cao thanh thoát)
 */
export function playHover() {
  if (!isUISoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.03);

  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}

/**
 * Phát âm thanh click nút chuẩn osu! (chắc, đanh, dứt khoát)
 */
export function playClick() {
  if (!isUISoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(480, now);
  osc.frequency.exponentialRampToValueAtTime(240, now + 0.05);

  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.065);
}

/**
 * Phát âm thanh Back / Huỷ (âm hạ trầm)
 */
export function playBack() {
  if (!isUISoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

/**
 * Phát âm thanh Select bài hát / Chọn tab (âm chuông 2 nhịp tươi sáng)
 */
export function playSelect() {
  if (!isUISoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.setValueAtTime(880, now + 0.04); // A5

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.11);
}

/**
 * Phát âm thanh Tick chuyển nấc Slider / Stepper
 */
export function playTick() {
  if (!isUISoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.015);

  gain.gain.setValueAtTime(0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.025);
}

/**
 * Phát âm thanh chúc mừng hoàn thành bài hát / Result Screen fanfare
 */
export function playResultFanfare(isPass = true) {
  if (!isUISoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = isPass ? [523.25, 659.25, 783.99, 1046.50] : [440, 415.3, 392, 349.23];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = now + idx * 0.08;

    osc.type = isPass ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.5);
  });
}
