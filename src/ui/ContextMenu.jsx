import React, { useEffect, useRef } from 'react';
import { playHover, playSelect } from './sound/uiAudio.js';

export default function ContextMenu({
  isOpen = false,
  x = 0,
  y = 0,
  items = [], // [{ id, label, icon, shortcut, danger, divider, onClick }]
  onClose,
  ...props
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (onClose) onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onClose) onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('contextmenu', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !items || items.length === 0) return null;

  // Tính vị trí để menu không bị tràn ra ngoài màn hình
  const menuWidth = 190;
  const menuHeight = items.length * 36;
  const adjustedX = typeof window !== 'undefined' && x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : x;
  const adjustedY = typeof window !== 'undefined' && y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : y;

  const handleItemClick = (item) => {
    playSelect();
    if (item.onClick) item.onClick();
    if (onClose) onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 min-w-[180px] p-1.5 rounded-xl bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.7)] animate-slideDown select-none"
      {...props}
    >
      {items.map((item, idx) => {
        if (item.divider) {
          return <div key={`div-${idx}`} className="my-1 border-t border-white/[0.08]" />;
        }

        return (
          <div
            key={item.id || idx}
            onClick={() => handleItemClick(item)}
            onMouseEnter={() => playHover()}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-3 cursor-pointer transition-colors ${
              item.danger
                ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300'
                : 'text-[#b8c0d4] hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {item.icon && <span className="text-xs">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-[10px] text-[#7c849c] font-mono">{item.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
