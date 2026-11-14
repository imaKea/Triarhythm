import React from 'react';

/**
 * Cột giữa: canvas preview dọc. Việc vẽ do useMapEditor đảm nhận qua canvasRef.
 */
export default function EditorPreview({ editor }) {
  const { canvasRef, handleCanvasClick } = editor;

  return (
    <div className="w-[560px] bg-[#06080e] border-r border-[#1e2538] flex flex-col items-center justify-center p-3 relative shrink-0">
      <canvas
        ref={canvasRef}
        width={540}
        height={560}
        onClick={handleCanvasClick}
        className="rounded-2xl border border-[#1b2233] bg-[#040507] shadow-2xl cursor-pointer hover:border-cyan-500/40 transition-colors"
        title="Click vào nút tròn hoặc tâm để đặt nốt tại thời điểm hiện tại"
      />
    </div>
  );
}
