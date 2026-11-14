import React, { useState, useEffect } from 'react';
import { apiClient } from '../core/api/client.js';

export default function LeaderboardView({ currentUser, onBack }) {
  const [type, setType] = useState('rating'); // 'rating' | 'score'
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getGlobalLeaderboard(type, 100);
      if (res?.players) {
        setPlayers(res.players);
      }
    } catch (err) {
      console.warn('Lỗi nạp bảng xếp hạng:', err.message);
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
    <div className="w-full max-w-6xl h-[calc(100vh-80px)] mt-16 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white font-sans select-none">
      {/* Header Bar matching RhythmTyper _header_sk5oz_12 */}
      <div className="h-16 bg-[#16213e]/90 border-b border-white/10 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Back to Song Select"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h1 className="font-bold text-lg text-white tracking-wide">
              Global Leaderboards
            </h1>
          </div>
        </div>

        {/* Tab Filters & Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#2a2a3e] p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setType('rating')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                type === 'rating'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ★ By Rating (PP)
            </button>
            <button
              onClick={() => setType('score')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                type === 'score'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              💯 By Total Score
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player..."
              className="w-48 bg-[#2a2a3e] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <button
            onClick={fetchLeaderboard}
            className="w-9 h-9 rounded-xl bg-[#2a2a3e] hover:bg-[#3a3a4e] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Table Content (Matching RhythmTyper _topPlaysGrid_sk5oz_266) */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <span className="animate-spin text-indigo-400">⚡</span>
              <span>Loading leaderboard from MySQL...</span>
            </div>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            No players found on the leaderboard yet.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4 text-right">Rating (PP)</th>
                <th className="py-3 px-4 text-right">Ranked Score</th>
                <th className="py-3 px-4 text-center">Plays</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPlayers.map((player, idx) => {
                const rankNum = idx + 1;
                const isCurrent = currentUser?.id === player.id;

                let rankBadgeClass = 'text-slate-400 font-bold';
                let rankIcon = null;
                if (rankNum === 1) {
                  rankBadgeClass = 'text-amber-400 font-black text-sm drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]';
                  rankIcon = '🥇';
                } else if (rankNum === 2) {
                  rankBadgeClass = 'text-slate-200 font-black text-sm drop-shadow-[0_0_8px_rgba(226,232,240,0.5)]';
                  rankIcon = '🥈';
                } else if (rankNum === 3) {
                  rankBadgeClass = 'text-amber-600 font-black text-sm drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]';
                  rankIcon = '🥉';
                }

                return (
                  <tr
                    key={player.id}
                    className={`hover:bg-white/5 transition-colors ${
                      isCurrent ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : ''
                    }`}
                  >
                    <td className={`py-3 px-4 text-center ${rankBadgeClass}`}>
                      {rankIcon ? `${rankIcon} #${rankNum}` : `#${rankNum}`}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={player.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                          alt=""
                          className="w-9 h-9 rounded-full bg-slate-800 border border-white/10"
                        />
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{player.name || player.username}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/40 font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            @{player.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-amber-300 text-sm">
                        ★ {Number(player.rating || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-white font-bold text-sm">
                        {Number(player.total_score || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-slate-300 text-sm">
                        {player.play_count || 0}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
