import React, { useEffect } from 'react';
import { playClick, playBack } from './sound/uiAudio.js';
import IconButton from './IconButton.jsx';

export default function Modal({
  isOpen = false,
  onClose,
  title = '',
  description = '',
  children,
  maxWidth = 'max-w-lg',
  className = '',
  closeOnBackdrop = true,
  ...props
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        playBack();
        if (onClose) onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      playBack();
      if (onClose) onClose();
    }
  };

  const handleCloseButton = () => {
    playBack();
    if (onClose) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-[#5b2a47]/30 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn select-none"
      {...props}
    >
      <div
        className={`w-full max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] min-h-0 ${maxWidth} bg-white/95 border border-[#f3dbe4] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-[0_20px_60px_rgba(126,47,79,0.15)] animate-slideDown flex flex-col gap-3 sm:gap-4 relative ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 sm:gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-base sm:text-xl font-black text-[#5b2a47] tracking-wide flex items-center gap-1.5 sm:gap-2 font-torus truncate">
                <span className="text-[#ff4d80] animate-kawaii-wiggle inline-block shrink-0">🎀</span>
                <span className="truncate">{title}</span>
              </h2>
            )}
            {description && <p className="text-xs text-[#a8556f] mt-0.5 line-clamp-2">{description}</p>}
          </div>
          {onClose && (
            <IconButton
              icon="✕"
              size="sm"
              variant="ghost"
              onClick={handleCloseButton}
              title="Close (Esc)"
            />
          )}
        </div>

        {/* Content */}
        <div className="text-xs sm:text-sm text-[#5b2a47] min-h-0 flex-1 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}
