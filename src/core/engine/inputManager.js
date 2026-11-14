/**
 * InputManager - Quản lý nhập liệu phím và chuột
 * Quy đổi event.timeStamp sang audio time chính xác
 * Hỗ trợ nhấn giữ (Hold), nhả phím (Release) và tùy biến keybind
 */

import { TRI_RING_LAYOUT } from '../../config/layout.config.js';

export class InputManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.keybinds = { ...TRI_RING_LAYOUT.defaultKeybinds };

    // Bảng tra nhanh: code -> lane và key -> lane (chống kẹt bộ gõ tiếng Việt Unikey/EVKey)
    this.codeToLane = new Map();
    this.keyToLane = new Map();
    this.ringCodes = new Set(this.keybinds.ring || ['Space']);
    this.rebuildKeyMap();

    // Trạng thái phím đang giữ
    this.isKeyDown = new Array(9).fill(false);
    this.keyDownTime = new Array(9).fill(0);
    this.isSpaceDown = false; // Trạng thái giữ phím Space cho nốt Ring
    this.activeHeldCodes = new Set(); // Theo dõi từng mã phím cụ thể để hỗ trợ nhiều phím trên cùng 1 lane (ví dụ 6 và 7)

    // Callbacks
    this.onLaneDown = null; // (lane, audioTime, perfTime) => {}
    this.onLaneUp = null;   // (lane, audioTime, perfTime) => {}
    this.onSpaceDown = null;// (audioTime, perfTime) => {}
    this.onTypingKey = null;// (key, audioTime) => boolean
    this.onPause = null;    // () => {}

    // Pointer state (chuột cho Slide)
    this.pointerPos = { x: 0, y: 0 };
    this.isPointerDown = false;
    this.onPointerMove = null;
    this.onPointerDown = null;
    this.onPointerUp = null;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.isAttached = false;
  }

  rebuildKeyMap() {
    this.codeToLane.clear();
    this.keyToLane.clear();
    for (const [laneStr, codes] of Object.entries(this.keybinds)) {
      if (laneStr === 'ring') continue;
      const lane = Number(laneStr);
      for (const code of codes) {
        this.codeToLane.set(code, lane);
        if (code.startsWith('Key')) {
          this.keyToLane.set(code.slice(3).toLowerCase(), lane);
        } else if (code.startsWith('Digit')) {
          this.keyToLane.set(code.slice(5), lane);
        } else if (code.startsWith('Numpad')) {
          this.keyToLane.set(code.slice(6), lane);
        }
      }
    }
    this.ringCodes = new Set(this.keybinds.ring || ['Space']);
  }

  setKeybinds(customKeybinds) {
    this.keybinds = { ...customKeybinds };
    if (!this.keybinds.ring) {
      this.keybinds.ring = ['Space'];
    }
    this.rebuildKeyMap();
  }

  attach(targetElement = typeof window !== 'undefined' ? window : null) {
    if (this.isAttached) return;
    if (targetElement && targetElement.addEventListener) {
      targetElement.addEventListener('keydown', this.boundKeyDown);
      targetElement.addEventListener('keyup', this.boundKeyUp);
    }
    this.isAttached = true;
  }

  detach(targetElement = typeof window !== 'undefined' ? window : null) {
    if (!this.isAttached) return;
    if (targetElement && targetElement.removeEventListener) {
      targetElement.removeEventListener('keydown', this.boundKeyDown);
      targetElement.removeEventListener('keyup', this.boundKeyUp);
    }
    this.isAttached = false;
  }

  handleKeyDown(e) {
    // Esc để Pause game
    if (e.code === 'Escape') {
      if (this.onPause) this.onPause();
      return;
    }

    const perfTime = e.timeStamp;
    const audioTime = this.audioEngine ? this.audioEngine.perfToAudioTime(perfTime) : performance.now();

    // Phím Space / Ring Note (kích thước bằng cả outline)
    // Hỗ trợ tùy biến phím Ring và giữ phím để tự động ăn nốt Ring mà không cần bấm liên tục
    const isRingKey = this.ringCodes.has(e.code) || (this.ringCodes.has('Space') && (e.key === ' ' || e.code === 'Space'));
    if (isRingKey) {
      e.preventDefault();
      this.isSpaceDown = true;
      if (e.repeat) return;
      if (this.onSpaceDown) {
        this.onSpaceDown(audioTime, perfTime);
      }
      return;
    }

    let lane = this.codeToLane.get(e.code);
    if (lane === undefined && e.key && this.keyToLane) {
      lane = this.keyToLane.get(e.key.toLowerCase());
    }

    // Xử lý Typing Section: ký tự phím gõ chữ (chỉ chặn khi không trùng phím lane)
    if (lane === undefined && !e.ctrlKey && !e.altKey && !e.metaKey && e.key && e.key.length === 1 && !e.isComposing) {
      if (this.onTypingKey) {
        const handled = this.onTypingKey(e.key, audioTime);
        if (handled) {
          e.preventDefault();
          return;
        }
      }
    }

    if (lane !== undefined) {
      e.preventDefault();

      // Bỏ qua lặp phím của hệ điều hành (auto-repeat)
      if (e.repeat) return;

      this.activeHeldCodes.add(e.code);
      this.isKeyDown[lane] = true;
      this.keyDownTime[lane] = audioTime;

      if (this.onLaneDown) {
        this.onLaneDown(lane, audioTime, perfTime);
      }
    }
  }

  handleKeyUp(e) {
    const isRingKey = this.ringCodes.has(e.code) || (this.ringCodes.has('Space') && (e.key === ' ' || e.code === 'Space'));
    if (isRingKey) {
      e.preventDefault();
      this.isSpaceDown = false;
      return;
    }

    let lane = this.codeToLane.get(e.code);
    if (lane === undefined && e.key && this.keyToLane) {
      lane = this.keyToLane.get(e.key.toLowerCase());
    }
    if (lane !== undefined) {
      e.preventDefault();
      this.activeHeldCodes.delete(e.code);

      // Nếu vẫn còn phím khác cùng map vào lane này (ví dụ đang giữ 6 mà nhả 7) thì không ngắt hold
      const isStillHeld = (this.keybinds[lane] || []).some(c => this.activeHeldCodes.has(c));
      if (!isStillHeld) {
        this.isKeyDown[lane] = false;

        const perfTime = e.timeStamp;
        const audioTime = this.audioEngine ? this.audioEngine.perfToAudioTime(perfTime) : performance.now();

        if (this.onLaneUp) {
          this.onLaneUp(lane, audioTime, perfTime);
        }
      }
    }
  }

  reset() {
    this.isKeyDown.fill(false);
    this.keyDownTime.fill(0);
    this.isSpaceDown = false;
    this.activeHeldCodes.clear();
    this.isPointerDown = false;
  }
}
