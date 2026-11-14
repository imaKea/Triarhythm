import React from 'react';

/**
 * Cột giữa: canvas preview dọc. Việc vẽ do useMapEditor đảm nhận qua canvasRef.
 */
export default function EditorPreview({ editor }) {
  const { canvasRef, handleCanvasClick } = editor;

  return (
    <div className="w-[560px] bg-[#090914] border-r border-white/[0.08] flex flex-col items-center justify-center p-3 relative shrink-0">
      <canvas
        ref={canvasRef}
        width={540}
        height={560}
        onClick={handleCanvasClick}
        className="rounded-2xl border border-white/[0.08] bg-[#06080e] shadow-2xl cursor-pointer hover:border-[#ff66ab]/50 transition-all hover:shadow-[0_0_30px_rgba(255,102,171,0.15)]"
        title="Click vào ô tròn hoặc tâm để đặt nốt tại thời điểm hiện tại"
      />
    </div>
  );
}
