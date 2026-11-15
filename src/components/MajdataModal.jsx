import React from 'react';
import { Modal } from '../ui/index.js';

const MAJDATA_URL = 'https://majdata.net/';

export default function MajdataModal({ isOpen = false, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tải ZIP từ Majdata"
      description="Tải file ZIP trên trang Majdata rồi nhập vào game bằng chức năng Add Song."
      maxWidth="max-w-5xl"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#5b2a47]">
            Việc tải file được thực hiện trên Majdata; file sẽ không tự nhập vào thư viện game.
          </p>
          <a
            href={MAJDATA_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center rounded-full border border-[#f3dbe4] bg-[#fff1f5] px-4 py-2 text-xs font-extrabold text-[#5b2a47] hover:border-[#ff85a2] hover:bg-[#fff0f4] focus:outline-none focus:ring-2 focus:ring-[#ff85a2]"
          >
            Mở Majdata trong tab mới
          </a>
        </div>
        <iframe
          title="Majdata.net - tải chart ZIP"
          src={MAJDATA_URL}
          className="h-[65vh] w-full rounded-xl border border-[#f3dbe4] bg-white"
          referrerPolicy="no-referrer"
        />
      </div>
    </Modal>
  );
}
