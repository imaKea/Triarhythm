import React, { useState, useEffect } from 'react';
import { apiClient } from '../core/api/client.js';

export default function LeaderboardView({ currentUser, onBack }) {
  const [type, setType] = useState('rating');
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  useEffect(() => { fetchLeaderboard(); }, [type]);

  const filteredPlayers = players.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.username && p.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full max-w-5xl h-[calc(100vh-52px)] mt-[52px] flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between shrink-0 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#b8c0d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
          >
            ←
          </button>
          <h1 className="font-bold text-lg text-white">Rankings</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[
              { id: 'rating', label: 'Performance' },
              { id: 'score', label: 'Score' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  type === t.id
                    ? 'bg-[#ff66ab] text-white shadow-[0_0_10px_rgba(255,102,171,0.3)]'
                    : 'text-[#6b7280] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player..."
            className="w-40 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5 text-xs text-white placeholder-[#6b7280] focus:outline-none focus:border-[#ff66ab]/50"
          />

          <button
            onClick={fetchLeaderboard}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#b8c0d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer text-xs"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-[#6b7280] text-sm">
            Loading rankings...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#6b7280] text-sm">
            No players found.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredPlayers.map((player, idx) => {
              const rankNum = idx + 1;
              const isCurrent = currentUser?.id === player.id;

              let rankColor = 'text-[#6b7280]';
              if (rankNum === 1) rankColor = 'text-[#ffdd57]';
              else if (rankNum === 2) rankColor = 'text-[#b8c0d4]';
              else if (rankNum === 3) rankColor = 'text-[#ff9800]';

              return (
                <div
                  key={player.id}
                  className={`flex items-center px-4 py-2.5 rounded-xl transition-colors hover:bg-white/[0.03] ${
                    isCurrent ? 'bg-[#ff66ab]/[0.06] border border-[#ff66ab]/20' : ''
                  }`}
                >
                  <span className={`w-12 text-center font-bold text-sm ${rankColor}`}>
                    #{rankNum}
                  </span>

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img
                      src={player.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                      alt=""
                      className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-white/[0.06]"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span className="truncate">{player.name || player.username}</span>
                        {isCurrent && (
                          <span className="text-[9px] bg-[#ff66ab]/15 text-[#ff66ab] px-1.5 py-0.5 rounded-full border border-[#ff66ab]/30 font-bold shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6b7280]">@{player.username}</div>
                    </div>
                  </div>

                  <div className="w-28 text-right">
                    <span className="font-mono font-bold text-[#ff66ab] text-sm">
                      {Number(player.rating || 0).toFixed(0)}pp
                    </span>
                  </div>

                  <div className="w-28 text-right">
                    <span className="font-mono text-white font-bold text-sm">
                      {Number(player.total_score || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="w-16 text-center">
                    <span className="font-mono text-[#6b7280] text-sm">
                      {player.play_count || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
