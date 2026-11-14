import React, { useState, useEffect } from 'react';
import { playClick } from './sound/uiAudio.js';

// Global toast event emitter for simple trigger: toast.success('...'), toast.error('...')
const listeners = new Set();

export const toast = {
  show(message, options = {}) {
    const item = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      type: options.type || 'info', // 'success' | 'error' | 'info' | 'warning'
      duration: options.duration || 4000,
      action: options.action || null, // { label: 'Undo', onClick: () => {} }
    };
    listeners.forEach((fn) => fn(item));
    return item.id;
  },
  success(msg, opts) {
    return this.show(msg, { ...opts, type: 'success' });
  },
  error(msg, opts) {
    return this.show(msg, { ...opts, type: 'error' });
  },
  info(msg, opts) {
    return this.show(msg, { ...opts, type: 'info' });
  },
  undo(msg, onUndo, duration = 7000, label = 'HOÀN TÁC (Ctrl+Z)') {
    return this.show(msg, {
      type: 'info',
      duration,
      action: { label, onClick: onUndo },
    });
  },
  dismiss(id) {
    listeners.forEach((fn) => fn({ type: 'dismiss', id }));
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleEvent = (t) => {
      if (t.type === 'dismiss') {
        setToasts((prev) => (t.id ? prev.filter((item) => item.id !== t.id) : []));
        return;
      }
      setToasts((prev) => [...prev, t]);
      if (t.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== t.id));
        }, t.duration);
      }
    };

    listeners.add(handleEvent);
    return () => listeners.delete(handleEvent);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none select-none">
      {toasts.map((t) => {
        const typeStyles = {
          success: 'border-[#66bb6a]/50 bg-white/95 text-[#2e5932] shadow-[0_8px_30px_rgba(102,187,106,0.18)]',
          error: 'border-[#e94267]/40 bg-white/95 text-[#e94267] shadow-[0_8px_30px_rgba(233,66,103,0.18)]',
          info: 'border-[#ff85a2]/50 bg-white/95 text-[#5b2a47] shadow-[0_8px_30px_rgba(255,133,162,0.18)]',
          warning: 'border-[#ffca68]/60 bg-white/95 text-[#8c6010] shadow-[0_8px_30px_rgba(255,202,104,0.18)]'
        }[t.type] || 'border-[#f3dbe4] bg-white/95 text-[#5b2a47] shadow-[0_8px_30px_rgba(126,47,79,0.1)]';

        const typeIcons = {
          success: '✓',
          error: '✕',
          info: 'ℹ',
          warning: '⚠'
        }[t.type] || '•';

        const iconColor = {
          success: 'text-[#66bb6a]',
          error: 'text-[#e94267]',
          info: 'text-[#ff4d80]',
          warning: 'text-amber-500'
        }[t.type];

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-lg backdrop-blur-xl flex items-center justify-between gap-3 animate-slideDown ${typeStyles}`}
          >
            <div className="flex items-center gap-2.5 text-xs">
              <span className={`font-black text-sm ${iconColor}`}>{typeIcons}</span>
              <span className="font-bold text-[#5b2a47]">{t.message}</span>
            </div>

            <div className="flex items-center gap-2">
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    if (t.action.onClick) t.action.onClick();
                    removeToast(t.id);
                  }}
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fff0f4] hover:bg-[#ffe5ec] text-[#ff4d80] border border-[#f3dbe4] cursor-pointer transition-colors"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-[#a8556f] hover:text-[#5b2a47] text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
