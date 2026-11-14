import React from 'react';
import { playClick } from '../../ui/index.js';

export default function EditorSetupTab({ editor }) {
  const { beatmap, setBeatmap, handleUploadAudio, audioUrl, songDuration } = editor;

  const metadata = beatmap.metadata || {};
  const assets = beatmap.assets || {};
  const settings = beatmap.settings || {};

  const handleUpdateMetadata = (field, value) => {
    editor.markDirty();
    setBeatmap((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value
      }
    }));
  };

  const handleUpdateSettings = (field, value) => {
    editor.markDirty();
    setBeatmap((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      }
    }));
  };

  const handleUpdateAssets = (field, value) => {
    editor.markDirty();
    setBeatmap((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        [field]: value
      }
    }));
  };

  const handleUploadBackground = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    editor.markDirty();
    setBeatmap((prev) => ({
      ...prev,
      backgroundBlob: file,
      backgroundSource: url,
      assets: {
        ...prev.assets,
        background: file.name
      }
    }));
  };

  const handleUploadVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    editor.markDirty();
    setBeatmap((prev) => ({
      ...prev,
      videoBlob: file,
      videoSource: url,
      assets: {
        ...prev.assets,
        video: file.name
      }
    }));
  };

  return (
    <div className="flex-1 bg-[#0d0d1a] overflow-y-auto p-8 flex justify-center custom-scrollbar font-sans select-none text-white animate-fadeIn">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-xl font-torus font-black tracking-wide text-white flex items-center gap-2">
              <span className="text-[#ff66ab]">⚙</span> Cấu hình Beatmap (Song Setup)
            </h2>
            <p className="text-xs text-[#8890a4] mt-1">
              Thiết lập thông tin bài nhạc, ảnh nền, video và độ khó theo tiêu chuẩn beatmap.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#ff66ab]/15 text-[#ff66ab] border border-[#ff66ab]/30">
            ID: {metadata.id || 'N/A'}
          </span>
        </div>

        {/* 1. Metadata Block */}
        <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col gap-4">
          <h3 className="text-sm font-bold text-[#ffdd57] uppercase tracking-wider flex items-center gap-2 font-mono">
            <span>📝</span> Thông tin bài hát (Metadata)
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#8890a4] font-medium">Tên bài hát (Title):</label>
              <input
                type="text"
                value={metadata.title || ''}
                onChange={(e) => handleUpdateMetadata('title', e.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/[0.1] rounded-xl px-3.5 py-2 text-white outline-none focus:border-[#ff66ab]"
                placeholder="Bài hát..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#8890a4] font-medium">Nghệ sĩ / Nhạc sĩ (Artist):</label>
              <input
                type="text"
                value={metadata.artist || ''}
                onChange={(e) => handleUpdateMetadata('artist', e.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/[0.1] rounded-xl px-3.5 py-2 text-white outline-none focus:border-[#ff66ab]"
                placeholder="Artist name..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#8890a4] font-medium">Người tạo map (Beatmap Creator):</label>
              <input
                type="text"
                value={metadata.creator || ''}
                onChange={(e) => handleUpdateMetadata('creator', e.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/[0.1] rounded-xl px-3.5 py-2 text-white outline-none focus:border-[#ff66ab]"
                placeholder="Mapper..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#8890a4] font-medium">Tên độ khó (Difficulty Name):</label>
              <input
                type="text"
                value={metadata.difficultyName || ''}
                onChange={(e) => handleUpdateMetadata('difficultyName', e.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/[0.1] rounded-xl px-3.5 py-2 text-white outline-none focus:border-[#ff66ab]"
                placeholder="Normal / Hard / Master / Re:MASTER"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#8890a4] font-medium">Cấp độ (Difficulty Level):</label>
              <input
                type="text"
                value={metadata.difficultyLevel || '10'}
                onChange={(e) => handleUpdateMetadata('difficultyLevel', e.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/[0.1] rounded-xl px-3.5 py-2 text-white outline-none focus:border-[#ff66ab]"
                placeholder="10 / 12+ / 14"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#8890a4] font-medium">Nguồn gốc (Source):</label>
              <input
                type="text"
                value={metadata.source || 'Triarhythm'}
                onChange={(e) => handleUpdateMetadata('source', e.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/[0.1] rounded-xl px-3.5 py-2 text-white outline-none focus:border-[#ff66ab]"
                placeholder="Original / maimai / osu!"
              />
            </div>
          </div>
        </div>

        {/* 2. Assets Block */}
        <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col gap-4">
          <h3 className="text-sm font-bold text-[#4fc3f7] uppercase tracking-wider flex items-center gap-2 font-mono">
            <span>🎨</span> Tệp âm thanh & Đồ họa (Assets)
          </h3>

          <div className="grid grid-cols-2 gap-6 text-xs">
            {/* Audio Section */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span>🎵</span> File Âm thanh chính
              </span>
              <p className="text-[11px] text-[#8890a4]">
                Thời lượng: <strong className="text-white font-mono">{Math.round(songDuration / 1000)}s</strong>
              </p>
              <label className="mt-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1] font-bold text-center cursor-pointer transition-colors block">
                <span>{audioUrl ? 'Đổi tệp nhạc (.mp3, .ogg, .wav)' : 'Tải lên bài nhạc'}</span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.ogg,.wav"
                  onChange={handleUploadAudio}
                  className="hidden"
                />
              </label>
            </div>

            {/* Background Section */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span>🖼</span> Ảnh nền (Background Cover)
              </span>
              <div className="h-20 rounded-lg overflow-hidden bg-black/40 border border-white/[0.08] flex items-center justify-center">
                {editor.beatmap?.backgroundSource ? (
                  <img
                    src={editor.beatmap.backgroundSource}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-[#7c849c]">Chưa có ảnh nền</span>
                )}
              </div>
              <label className="mt-1 px-4 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1] font-bold text-center cursor-pointer transition-colors block">
                <span>Chọn ảnh nền (.jpg, .png)</span>
                <input
                  type="file"
                  accept="image/*,.jpg,.png,.webp"
                  onChange={handleUploadBackground}
                  className="hidden"
                />
              </label>
            </div>

            {/* Video Section */}
            <div className="col-span-2 flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span>🎬</span> Video nền (Background BGA)
                </span>
                <label className="px-3.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1] font-bold cursor-pointer transition-colors text-[11px]">
                  <span>{assets.video ? `Đổi video (${assets.video})` : 'Tải video (.mp4, .webm)'}</span>
                  <input
                    type="file"
                    accept="video/*,.mp4,.webm"
                    onChange={handleUploadVideo}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[#8890a4]">Độ lệch video (videoOffset):</span>
                <input
                  type="range"
                  min="-5000"
                  max="5000"
                  step="50"
                  value={assets.videoOffset || 0}
                  onChange={(e) => handleUpdateAssets('videoOffset', parseInt(e.target.value) || 0)}
                  className="flex-1 accent-[#ff66ab] cursor-pointer"
                />
                <span className="font-mono font-bold text-white w-16 text-right">
                  {assets.videoOffset || 0} ms
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Gameplay Settings */}
        <div className="p-6 rounded-2xl bg-[#141424]/90 border border-white/[0.08] shadow-lg flex flex-col gap-4">
          <h3 className="text-sm font-bold text-[#66bb6a] uppercase tracking-wider flex items-center gap-2 font-mono">
            <span>⚡</span> Cài đặt Gameplay mặc định (Ruleset)
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[#8890a4]">Tốc độ bay của nốt (Note Speed):</span>
                <span className="font-mono font-bold text-[#ff66ab]">{settings.noteSpeed || 10.0}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="15.0"
                step="0.5"
                value={settings.noteSpeed || 10.0}
                onChange={(e) => handleUpdateSettings('noteSpeed', parseFloat(e.target.value) || 10.0)}
                className="w-full accent-[#ff66ab] cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[#8890a4]">Khoảng trống đầu bài (Audio Lead-in):</span>
                <span className="font-mono font-bold text-[#4fc3f7]">{settings.audioLeadIn ?? 0} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="100"
                value={settings.audioLeadIn ?? 0}
                onChange={(e) => handleUpdateSettings('audioLeadIn', parseInt(e.target.value) || 0)}
                className="w-full accent-[#4fc3f7] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
