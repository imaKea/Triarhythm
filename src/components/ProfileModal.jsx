import React, { useState, useEffect } from 'react';
import { Modal, Avatar, Button, Tabs, RankBadge, toast, playClick } from '../ui/index.js';
import { apiClient } from '../core/api/client.js';

export default function ProfileModal({
  isOpen = false,
  onClose,
  user,
  onUpdateUser,
}) {
  const [activeTab, setActiveTab] = useState('best'); // 'best' | 'recent' | 'edit'
  const [scores, setScores] = useState([]);
  const [isLoadingScores, setIsLoadingScores] = useState(false);

  // Edit profile form state
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatar || '');
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    setIsLoadingScores(true);
    apiClient.getUserScores(user.id)
      .then((res) => {
        if (res?.scores) setScores(res.scores);
      })
      .catch(() => setScores([]))
      .finally(() => setIsLoadingScores(false));
  }, [isOpen, user?.id]);

  if (!isOpen || !user) return null;

  // Best scores with 0.95^i weight calculation
  const bestScores = [...scores]
    .sort((a, b) => (b.pp || 0) - (a.pp || 0))
    .slice(0, 50)
    .map((s, idx) => ({
      ...s,
      weight: Math.pow(0.95, idx),
      weightedPP: (s.pp || 0) * Math.pow(0.95, idx)
    }));

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    playClick();
    try {
      // In P5 we'll wire up user update API, for now update locally
      const updated = { ...user, name, avatar: avatarUrl };
      if (onUpdateUser) onUpdateUser(updated);
      toast.success('Đã cập nhật thông tin hồ sơ!');
      setActiveTab('best');
    } catch (err) {
      toast.error('Lỗi cập nhật: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const totalPP = user.total_pp || Math.round(bestScores.reduce((acc, s) => acc + s.weightedPP, 0));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="max-w-2xl"
      className="p-0 overflow-hidden"
    >
      {/* Profile Header Banner */}
      <div className="relative p-6 bg-gradient-to-br from-[#2a1a38] via-[#1a1a2e] to-[#111122] border-b border-white/[0.08] flex items-center gap-5">
        <Avatar
          src={avatarUrl}
          name={name || user.username}
          size="xl"
          status="online"
          className="ring-4 ring-[#ff66ab]/40 shadow-xl"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white truncate font-torus">
              {name || user.username}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ff66ab]/20 text-[#ff66ab] border border-[#ff66ab]/30">
              {user.role === 'admin' ? 'ADMIN' : 'PLAYER'}
            </span>
          </div>
          <p className="text-xs text-[#7c849c] font-mono mt-0.5">@{user.username}</p>

          {/* Core Stats Row */}
          <div className="flex items-center gap-4 mt-3 text-xs font-mono">
            <div>
              <span className="text-[#7c849c] block text-[10px]">TOTAL PP</span>
              <span className="text-base font-black text-[#ff66ab]">
                {Number(totalPP || 0).toLocaleString()}pp
              </span>
            </div>
            <div>
              <span className="text-[#7c849c] block text-[10px]">ACCURACY</span>
              <span className="text-base font-black text-white">
                {Number(user.rating ? (user.rating / 15 * 100) : 98.5).toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-[#7c849c] block text-[10px]">PLAYS</span>
              <span className="text-base font-black text-white">
                {Number(user.play_count || scores.length).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[#7c849c] block text-[10px]">SCORE</span>
              <span className="text-base font-black text-[#b8c0d4]">
                {Number(user.total_score || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="px-6 pt-4 pb-2 bg-[#111122] flex items-center justify-between border-b border-white/[0.06]">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'best', label: 'Best Performances (Top PP)', badge: bestScores.length },
            { id: 'recent', label: 'Recent Plays', badge: scores.length },
            { id: 'edit', label: 'Chỉnh sửa Profile' }
          ]}
        />
      </div>

      {/* Tab Contents */}
      <div className="p-6 bg-[#111122]/95 min-h-[320px] max-h-[420px] overflow-y-auto custom-scrollbar">
        {/* TAB 1: BEST PERFORMANCES WITH 0.95^i */}
        {activeTab === 'best' && (
          <div className="space-y-2">
            {isLoadingScores ? (
              <div className="text-center py-12 text-xs text-[#7c849c]">Đang tải thành tích...</div>
            ) : bestScores.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#7c849c]">
                Chưa có điểm chơi trực tuyến nào được lưu trên máy chủ.
              </div>
            ) : (
              bestScores.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[#ff66ab] w-5 text-center">
                      #{idx + 1}
                    </span>
                    <RankBadge rank={s.rank || 'S'} size="sm" />
                    <div className="flex flex-col">
                      <span className="font-bold text-white truncate max-w-[240px]">
                        {s.song_id || 'Beatmap Track'} <span className="text-[#ff66ab]">[{s.difficulty_name || 'Normal'}]</span>
                      </span>
                      <span className="text-[10px] text-[#7c849c] font-mono">
                        {Number(s.accuracy || 0).toFixed(2)}% • {s.max_combo || 0}x combo
                      </span>
                    </div>
                  </div>

                  {/* PP + Weight indicator */}
                  <div className="text-right font-mono">
                    <div className="font-bold text-[#ff66ab]">
                      {Math.round(s.pp || 0)}pp
                    </div>
                    <div className="text-[10px] text-[#7c849c]">
                      weighted {Math.round(s.weight * 100)}% ({Math.round(s.weightedPP)}pp)
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: RECENT PLAYS */}
        {activeTab === 'recent' && (
          <div className="space-y-2">
            {scores.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#7c849c]">
                Chưa có lượt chơi gần đây nào.
              </div>
            ) : (
              scores.slice(0, 30).map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <RankBadge rank={s.rank || 'A'} size="sm" />
                    <div>
                      <div className="font-bold text-white truncate max-w-[240px]">
                        {s.song_id} [{s.difficulty_name}]
                      </div>
                      <div className="text-[10px] text-[#7c849c] font-mono">
                        {Number(s.accuracy || 0).toFixed(2)}% • Score: {Number(s.score || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[#ff66ab] text-right">
                    {Math.round(s.pp || 0)}pp
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: EDIT PROFILE */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md mx-auto py-2">
            <div>
              <label className="block text-xs font-bold text-[#b8c0d4] mb-1">Tên hiển thị (Display Name)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none"
                placeholder="Nhập tên của bạn..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#b8c0d4] mb-1">Avatar URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none"
                placeholder="https://..."
              />
              <span className="text-[10px] text-[#7c849c] mt-1 block">
                Hỗ trợ link ảnh trực tiếp PNG, JPG hoặc Dicebear avatar.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" size="md" disabled={isSaving}>
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
