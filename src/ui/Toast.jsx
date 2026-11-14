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
  undo(msg, onUndo, duration = 8000) {
    return this.show(msg, {
      type: 'info',
      duration,
      action: { label: 'Hoàn tác (Undo)', onClick: onUndo },
    });
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const addToast = (t) => {
      setToasts((prev) => [...prev, t]);
      if (t.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== t.id));
        }, t.duration);
      }
    };

    listeners.add(addToast);
    return () => listeners.delete(addToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none select-none">
      {toasts.map((t) => {
        const typeStyles = {
          success: 'border-[#66bb6a]/40 bg-[#1a1a2e]/95 text-white',
          error: 'border-red-500/40 bg-[#1a1a2e]/95 text-white',
          info: 'border-[#ff66ab]/40 bg-[#1a1a2e]/95 text-white',
          warning: 'border-yellow-500/40 bg-[#1a1a2e]/95 text-white'
        }[t.type] || 'border-white/[0.1] bg-[#1a1a2e]/95 text-white';

        const typeIcons = {
          success: '✓',
          error: '✕',
          info: 'ℹ',
          warning: '⚠'
        }[t.type] || '•';

        const iconColor = {
          success: 'text-[#66bb6a]',
          error: 'text-red-400',
          info: 'text-[#ff66ab]',
          warning: 'text-yellow-400'
        }[t.type];

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl flex items-center justify-between gap-3 animate-slideDown ${typeStyles}`}
          >
            <div className="flex items-center gap-2.5 text-xs">
              <span className={`font-black text-sm ${iconColor}`}>{typeIcons}</span>
              <span className="font-medium text-[#f0f2f8]">{t.message}</span>
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
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#ff66ab]/20 hover:bg-[#ff66ab]/30 text-[#ff66ab] border border-[#ff66ab]/30 cursor-pointer transition-colors"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-[#7c849c] hover:text-white text-xs px-1 cursor-pointer"
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
