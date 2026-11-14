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
      className="fixed inset-0 z-50 bg-[#0d0d1a]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
      {...props}
    >
      <div
        className={`w-full ${maxWidth} bg-[#1a1a2e]/95 border border-white/[0.1] rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.7)] animate-slideDown flex flex-col gap-4 relative ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-xl font-bold text-white tracking-wide">{title}</h2>}
            {description && <p className="text-xs text-[#7c849c] mt-0.5">{description}</p>}
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
        <div className="text-sm text-[#b8c0d4]">{children}</div>
      </div>
    </div>
  );
}
