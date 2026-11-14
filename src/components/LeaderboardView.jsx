import React, { useState, useEffect } from 'react';
import { apiClient } from '../core/api/client.js';
import { Avatar, Button, Tabs, RankBadge, playHover, playSelect } from '../ui/index.js';
import ProfileModal from './ProfileModal.jsx';

export default function LeaderboardView({ currentUser, onBack }) {
  const [type, setType] = useState('rating'); // 'rating' (Performance) | 'score'
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewingUser, setViewingUser] = useState(null);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getGlobalLeaderboard(type, 100);
      if (res?.players) setPlayers(res.players);
    } catch (err) {
      console.warn('Error loading leaderboard:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [type]);

  const filteredPlayers = players.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.username && p.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full max-w-5xl h-[calc(100vh-52px-24px)] mt-[52px] mb-6 flex flex-col overflow-hidden select-none osu-screen-transition p-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} icon="←">
            Back (Esc)
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h1 className="font-torus font-black text-xl text-white tracking-wide">
              BẢNG XẾP HẠNG TOÀN CẦU (GLOBAL RANKINGS)
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tabs
            activeTab={type}
            onChange={(tab) => {
              playSelect();
              setType(tab);
            }}
            tabs={[
              { id: 'rating', label: 'Performance (PP)' },
              { id: 'score', label: 'Score' }
            ]}
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm người chơi..."
            className="w-48 bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab]/50 rounded-full px-3.5 py-1.5 text-xs text-white placeholder-[#7c849c] outline-none"
          />

          <Button variant="ghost" size="sm" onClick={fetchLeaderboard} icon="↻">
            Làm mới
          </Button>
        </div>
      </div>

      {/* Leaderboard Table Container */}
      <div className="flex-1 bg-[#1a1a2e]/80 border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-md">
        {/* Table Header */}
        <div className="grid grid-cols-12 px-6 py-3 bg-[#111122]/90 border-b border-white/[0.06] text-[11px] font-bold text-[#7c849c] uppercase tracking-wider font-mono">
          <div className="col-span-1 text-center"># Rank</div>
          <div className="col-span-4">Người chơi (Player)</div>
          <div className="col-span-2 text-right">Performance / Stars</div>
          <div className="col-span-2 text-right">Độ chính xác (Acc)</div>
          <div className="col-span-2 text-right">Tổng điểm (Score)</div>
          <div className="col-span-1 text-right">Lượt chơi</div>
        </div>

        {/* Table Rows */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/[0.04]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-xs text-[#7c849c] gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#ff66ab]/30 border-t-[#ff66ab] animate-spin" />
              <span>Đang tải bảng xếp hạng...</span>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-20 text-xs text-[#7c849c]">
              Không tìm thấy người chơi nào.
            </div>
          ) : (
            filteredPlayers.map((player, idx) => {
              const isCurrent = currentUser?.id === player.id;
              const rank = idx + 1;
              const rankMedal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

              return (
                <div
                  key={player.id}
                  onClick={() => {
                    playClick();
                    setViewingUser(player);
                  }}
                  onMouseEnter={() => playHover()}
                  className={`grid grid-cols-12 items-center px-6 py-3 text-xs transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#ff66ab]/15 hover:bg-[#ff66ab]/25 border-l-4 border-l-[#ff66ab]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Rank position */}
                  <div className="col-span-1 text-center font-mono font-black text-sm">
                    {rankMedal ? (
                      <span className="text-base">{rankMedal}</span>
                    ) : (
                      <span className={rank <= 10 ? 'text-[#ff66ab]' : 'text-[#7c849c]'}>
                        #{rank}
                      </span>
                    )}
                  </div>

                  {/* Player info */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <Avatar
                      src={player.avatar}
                      name={player.name || player.username}
                      size="sm"
                      status="online"
                    />
                    <div className="flex flex-col truncate">
                      <span className="font-bold text-white group-hover:text-[#ff66ab] transition-colors truncate">
                        {player.name || player.username}
                      </span>
                      <span className="text-[10px] text-[#7c849c] font-mono">
                        @{player.username}
                      </span>
                    </div>
                  </div>

                  {/* Performance / Stars */}
                  <div className="col-span-2 text-right font-mono font-bold text-sm text-[#ff66ab]">
                    {player.total_pp ? `${Number(player.total_pp).toLocaleString()}pp` : `${Number(player.rating || 0).toFixed(2)}★`}
                  </div>

                  {/* Accuracy */}
                  <div className="col-span-2 text-right font-mono font-semibold text-white">
                    {Number(player.rating ? (player.rating / 15 * 100) : 98.5).toFixed(2)}%
                  </div>

                  {/* Total score */}
                  <div className="col-span-2 text-right font-mono text-[#b8c0d4]">
                    {Number(player.total_score || 0).toLocaleString()}
                  </div>

                  {/* Play count */}
                  <div className="col-span-1 text-right font-mono text-[#7c849c]">
                    {Number(player.play_count || 0).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Profile Modal when a player is clicked */}
      <ProfileModal
        isOpen={Boolean(viewingUser)}
        onClose={() => setViewingUser(null)}
        user={viewingUser}
      />
    </div>
  );
}
