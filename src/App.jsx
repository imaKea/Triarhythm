import React, { useState, useEffect, useCallback } from 'react';
import RhythmNavbar from './components/RhythmNavbar.jsx';
import AstroSongSelect from './components/AstroSongSelect.jsx';
import LeaderboardView from './components/LeaderboardView.jsx';
import GameplayView from './components/GameplayView.jsx';
import MapEditor from './components/MapEditor.jsx';
import AstroSettingsModal from './components/AstroSettingsModal.jsx';
import AstroAuthModal from './components/AstroAuthModal.jsx';
import RingPreview from './components/RingPreview.jsx';
import { dbManager } from './core/storage/db.js';
import { initializeDefaultData } from './core/storage/seedData.js';
import { importFiles } from './core/parser/index.js';
import { apiClient } from './core/api/client.js';
import { TRI_RING_LAYOUT } from './config/layout.config.js';

export default function App() {
  // Trạng thái màn hình chính: 'SONG_SELECT' | 'LEADERBOARD' | 'GAMEPLAY' | 'EDITOR' | 'LAYOUT'
  const [currentScreen, setCurrentScreen] = useState('SONG_SELECT');

  // Dữ liệu Beatmaps từ IndexedDB & MySQL
  const [beatmaps, setBeatmaps] = useState([]);
  const [selectedBeatmap, setSelectedBeatmap] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Người dùng & Cài đặt
  const [currentUser, setCurrentUser] = useState(null);
  const [settings, setSettings] = useState({
    noteSpeed: 10.0, // Mặc định 10.0, cho phép chỉnh lên tới 15.0
    isAutoplay: false,
    backgroundDim: 0.75,
    showRayGuides: true,
    musicVol: 85,
    hitVol: 95,
    userOffset: 0,
    customKeybinds: { ...TRI_RING_LAYOUT.defaultKeybinds }
  });

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Target beatmap cho Map Editor
  const [editorBeatmap, setEditorBeatmap] = useState(null);

  // Drag & drop file overlay
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Tải dữ liệu ban đầu từ IndexedDB / MySQL
  const loadDatabase = useCallback(async () => {
    setIsLoadingData(true);
    try {
      await initializeDefaultData();

      // Nạp danh sách beatmap từ IndexedDB và khôi phục object URLs cho Blobs
      const rawMaps = await dbManager.getAllBeatmaps();
      const maps = rawMaps.map((bm) => ({
        ...bm,
        audioSource: bm.audioBlob instanceof Blob ? URL.createObjectURL(bm.audioBlob) : (bm.audioSource || null),
        backgroundSource: bm.backgroundBlob instanceof Blob ? URL.createObjectURL(bm.backgroundBlob) : (bm.backgroundSource || null),
        videoSource: bm.videoBlob instanceof Blob ? URL.createObjectURL(bm.videoBlob) : (bm.videoSource || null),
      }));
      setBeatmaps(maps);
      setSelectedBeatmap((prev) => {
        if (!prev) return maps[0] || null;
        return maps.find((m) => m.id === prev.id) || maps[0] || null;
      });

      // Khôi phục phiên đăng nhập từ Laravel API
      try {
        const meRes = await apiClient.me();
        if (meRes?.user) {
          setCurrentUser(meRes.user);
        }
      } catch (_) {
        setCurrentUser(null);
      }

      // Nạp cài đặt đã lưu và tự động hòa trộn phím tắt mặc định mới nhất
      const savedSettings = await dbManager.getSettings();
      if (savedSettings) {
        const mergedKeybinds = { ...TRI_RING_LAYOUT.defaultKeybinds };
        if (savedSettings.customKeybinds) {
          for (const [k, codes] of Object.entries(savedSettings.customKeybinds)) {
            const defaults = TRI_RING_LAYOUT.defaultKeybinds[k] || [];
            mergedKeybinds[k] = [...new Set([...codes, ...defaults])];
          }
        }
        setSettings((prev) => ({
          ...prev,
          ...savedSettings,
          customKeybinds: mergedKeybinds
        }));
      }
    } catch (err) {
      console.error('[App] Lỗi nạp dữ liệu:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);

  // Cập nhật cài đặt và lưu vào IndexedDB
  const handleUpdateSettings = async (newSettings) => {
    setSettings(newSettings);
    try {
      await dbManager.saveSettings(newSettings);
    } catch (err) {
      console.warn('Lỗi lưu cài đặt:', err);
    }
  };

  // Chuyển đổi trạng thái Autoplay nhanh
  const handleToggleAutoplay = () => {
    handleUpdateSettings({
      ...settings,
      isAutoplay: !settings.isAutoplay
    });
  };

  // Đăng xuất
  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (_) {}
    setCurrentUser(null);
  };

  // Bắt đầu chơi game với bài đã chọn
  const handleStartGame = (chart) => {
    if (chart) setSelectedBeatmap(chart);
    setCurrentScreen('GAMEPLAY');
  };

  // Mở Map Editor
  const handleOpenEditor = (chart) => {
    setEditorBeatmap(chart || selectedBeatmap);
    setCurrentScreen('EDITOR');
  };

  // Nhập map qua một luồng duy nhất (importService)
  const processFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return null;

    try {
      const result = await importFiles(fileList, { preset: 'twoFingers', autoSlide: false });

      if (result.status === 'duplicate') {
        const title = result.songEntry?.title || 'Bản đồ';
        alert(`Bản đồ "${title}" đã tồn tại trong Database!`);
        return result;
      }

      await loadDatabase();
      setSelectedBeatmap(result.songEntry);
      alert(`Đã nạp thành công "${result.songEntry.title}" với ${result.difficultyCount} độ khó!`);
      return result;
    } catch (err) {
      alert('Lỗi nạp file: ' + err.message);
      return null;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files?.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center justify-start select-none font-sans"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* RhythmTyper Modern Navbar */}
      {currentScreen !== 'GAMEPLAY' && (
        <RhythmNavbar
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Overlay Drag & Drop toàn màn hình */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-cyan-400 pointer-events-none animate-fadeIn">
          <div className="text-6xl mb-4 animate-bounce">📥</div>
          <h2 className="text-2xl font-cyber font-bold text-white mb-2 tracking-wider">
            THẢ FILE .OSZ / .ZIP ĐỂ NẠP BÀI VÀO DATABASE
          </h2>
          <p className="text-sm font-mono text-slate-300 max-w-md text-center leading-relaxed">
            Hỗ trợ file nén <strong className="text-cyan-300">.osz</strong>, <strong className="text-cyan-300">.zip</strong> (Maimai maidata.txt) hoặc file <strong className="text-cyan-300">.osu + .mp3</strong>!
          </p>
        </div>
      )}

      {/* Loading Screen */}
      {isLoadingData && (
        <div className="fixed inset-0 z-40 bg-[#05070b] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <p className="font-cyber font-bold tracking-widest text-sm text-slate-300">
            TRIARHYTHM ĐANG KHỞI ĐỘNG DATABASE...
          </p>
        </div>
      )}

      {/* Main Screen Router */}
      <main className="w-full flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* MÀN HÌNH 1: SONG SELECT (RhythmTyper Beatmap Browser) */}
        {currentScreen === 'SONG_SELECT' && (
          <AstroSongSelect
            beatmaps={beatmaps}
            selectedBeatmap={selectedBeatmap}
            onSelectBeatmap={(bm) => setSelectedBeatmap(bm)}
            onStartGame={handleStartGame}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenEditor={() => handleOpenEditor(selectedBeatmap)}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
            isAutoplay={settings.isAutoplay}
            onToggleAutoplay={handleToggleAutoplay}
            onReloadBeatmaps={loadDatabase}
          />
        )}

        {/* MÀN HÌNH 2: LEADERBOARD TOÀN CẦU */}
        {currentScreen === 'LEADERBOARD' && (
          <LeaderboardView
            currentUser={currentUser}
            onBack={() => setCurrentScreen('SONG_SELECT')}
          />
        )}

        {/* MÀN HÌNH 3: GAMEPLAY (Arcade Triangle View) */}
        {currentScreen === 'GAMEPLAY' && (
          <GameplayView
            initialChart={selectedBeatmap}
            settings={settings}
            currentUser={currentUser}
            onBackToSelect={() => setCurrentScreen('SONG_SELECT')}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onUploadFiles={processFiles}
          />
        )}

        {/* MÀN HÌNH 4: MAP EDITOR */}
        {currentScreen === 'EDITOR' && (
          <MapEditor
            initialBeatmap={editorBeatmap}
            onClose={() => setCurrentScreen('SONG_SELECT')}
            onTestPlay={(editedChart) => {
              setSelectedBeatmap(editedChart);
              setCurrentScreen('GAMEPLAY');
            }}
          />
        )}

        {/* MÀN HÌNH 5: LAYOUT PREVIEW (DEBUG TAM GIÁC) */}
        {currentScreen === 'LAYOUT' && (
          <div className="w-full flex flex-col items-center">
            <button
              onClick={() => setCurrentScreen('SONG_SELECT')}
              className="mb-4 px-4 py-2 rounded-xl bg-[#141824] hover:bg-[#1e2538] text-slate-200 border border-[#27324c] font-mono text-xs cursor-pointer"
            >
              ← Quay lại Chọn bài
            </button>
            <RingPreview />
          </div>
        )}
      </main>

      {/* MODAL CÀI ĐẶT */}
      <AstroSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        currentUser={currentUser}
        onOpenAuthModal={() => {
          setIsSettingsOpen(false);
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* MODAL TÀI KHOẢN & MẬT KHẨU (MySQL + Laravel Auth) */}
      <AstroAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    </div>
  );
}
