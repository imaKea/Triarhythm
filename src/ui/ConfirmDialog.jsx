import React from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { playClick, playBack } from './sound/uiAudio.js';

export default function ConfirmDialog({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger', // 'danger' | 'primary'
  loading = false,
  ...props
}) {
  const handleConfirm = () => {
    playClick();
    if (onConfirm) onConfirm();
  };

  const handleCancel = () => {
    playBack();
    if (onClose) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={title} maxWidth="max-w-md" {...props}>
      <p className="text-sm text-[#5b2a47] leading-relaxed my-2">{message}</p>

      <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#f3dbe4]">
        <Button variant="ghost" size="sm" onClick={handleCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={confirmVariant} size="sm" onClick={handleConfirm} disabled={loading}>
          {loading ? 'Processing...' : confirmText}
        </Button>
      </div>
    </Modal>
  );
}
