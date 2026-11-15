import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../core/api/client.js';
import {
  Button,
  IconButton,
  Dropdown,
  Avatar,
  RankBadge,
  ConfirmDialog,
  Modal,
  toast,
  playHover,
  playClick,
  playSelect,
} from '../ui/index.js';

export default function AdminPanel({ currentUser, onBack }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'users' | 'maps' | 'scores' | 'logs'
  const [isLoading, setIsLoading] = useState(false);

  // --- DASHBOARD STATE ---
  const [dashboardData, setDashboardData] = useState(null);

  // --- USERS STATE ---
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userBanFilter, setUserBanFilter] = useState('');
  const [userPagination, setUserPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  // --- MAPS STATE ---
  const [maps, setMaps] = useState([]);
  const [mapQuery, setMapQuery] = useState('');
  const [mapStatusFilter, setMapStatusFilter] = useState('');
  const [mapSourceFilter, setMapSourceFilter] = useState('');
  const [mapPagination, setMapPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  // --- SCORES STATE ---
  const [scores, setScores] = useState([]);
  const [scoreQuery, setScoreQuery] = useState('');
  const [scoreRankFilter, setScoreRankFilter] = useState('');
  const [scorePagination, setScorePagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  // --- LOGS STATE ---
  const [logs, setLogs] = useState([]);
  const [logPagination, setLogPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  // --- MODALS & DIALOGS ---
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    danger: true,
    onConfirm: () => {},
  });

  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    userId: null,
    username: '',
    newPassword: '',
    temporaryPassword: null,
  });

  const [editMapModal, setEditMapModal] = useState({
    isOpen: false,
    map: null,
    title: '',
    artist: '',
    creator: '',
    bpm: '',
    status: 'published',
  });

  const [isRecalculating, setIsRecalculating] = useState(false);

  // 1. NẠP DỮ LIỆU TÙY THEO TAB ĐANG CHỌN
  const loadTabContent = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await apiClient.adminGetDashboard();
        if (res?.success) setDashboardData(res);
      } else if (activeTab === 'users') {
        const params = { page: userPagination.current_page };
        if (userQuery.trim()) params.query = userQuery.trim();
        if (userRoleFilter) params.role = userRoleFilter;
        if (userBanFilter !== '') params.is_banned = userBanFilter;
        const res = await apiClient.adminGetUsers(params);
        if (res?.success) {
          setUsers(res.data);
          setUserPagination(res.pagination);
        }
      } else if (activeTab === 'maps') {
        const params = { page: mapPagination.current_page };
        if (mapQuery.trim()) params.query = mapQuery.trim();
        if (mapStatusFilter) params.status = mapStatusFilter;
        if (mapSourceFilter) params.source = mapSourceFilter;
        const res = await apiClient.adminGetMaps(params);
        if (res?.success) {
          setMaps(res.data);
          setMapPagination(res.pagination);
        }
      } else if (activeTab === 'scores') {
        const params = { page: scorePagination.current_page };
        if (scoreQuery.trim()) params.query = scoreQuery.trim();
        if (scoreRankFilter) params.rank = scoreRankFilter;
        const res = await apiClient.adminGetScores(params);
        if (res?.success) {
          setScores(res.data);
          setScorePagination(res.pagination);
        }
      } else if (activeTab === 'logs') {
        const res = await apiClient.adminGetLogs({ page: logPagination.current_page });
        if (res?.success) {
          setLogs(res.data);
          setLogPagination(res.pagination);
        }
      }
    } catch (err) {
      toast.error('Error loading admin data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    userQuery,
    userRoleFilter,
    userBanFilter,
    userPagination.current_page,
    mapQuery,
    mapStatusFilter,
    mapSourceFilter,
    mapPagination.current_page,
    scoreQuery,
    scoreRankFilter,
    scorePagination.current_page,
    logPagination.current_page,
  ]);

  useEffect(() => {
    loadTabContent();
  }, [loadTabContent]);

  // --- USER ACTIONS ---
  const handleToggleRole = (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    setConfirmState({
      isOpen: true,
      title: `Change User Role`,
      message: `Are you sure you want to change '${user.username}' to role [${nextRole.toUpperCase()}]?`,
      confirmText: 'Change Role',
      danger: nextRole === 'admin',
      onConfirm: async () => {
        try {
          await apiClient.adminUpdateUserRole(user.id, nextRole);
          toast.success(`Updated role for '${user.username}' to ${nextRole}!`);
          loadTabContent();
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  };

  const handleToggleBan = (user) => {
    const isBanning = !user.is_banned;
    setConfirmState({
      isOpen: true,
      title: isBanning ? `Ban User Account` : `Unban User Account`,
      message: isBanning
        ? `Account '${user.username}' will be disconnected and unable to submit scores.`
        : `Allow account '${user.username}' to resume activity.`,
      confirmText: isBanning ? 'Ban Now' : 'Unban',
      danger: isBanning,
      onConfirm: async () => {
        try {
          await apiClient.adminToggleUserBan(user.id);
          toast.success(`${isBanning ? 'Banned' : 'Unbanned'} account '${user.username}'!`);
          loadTabContent();
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  };

  const handleDeleteUser = (user) => {
    setConfirmState({
      isOpen: true,
      title: `Permanently Delete User`,
      message: `WARNING: This action will permanently delete user '${user.username}' and all their scores. This cannot be undone!`,
      confirmText: 'Delete Permanently',
      danger: true,
      onConfirm: async () => {
        try {
          await apiClient.adminDeleteUser(user.id);
          toast.success(`Deleted user '${user.username}'!`);
          loadTabContent();
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  };

  const handleOpenPasswordModal = (user) => {
    setPasswordModal({
      isOpen: true,
      userId: user.id,
      username: user.username,
      newPassword: '',
      temporaryPassword: null,
    });
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.adminResetUserPassword(
        passwordModal.userId,
        passwordModal.newPassword
      );
      if (res?.temporary_password) {
        setPasswordModal((prev) => ({ ...prev, temporaryPassword: res.temporary_password }));
        toast.info(`New temporary password: ${res.temporary_password}`);
      } else {
        toast.success(`Reset password for '${passwordModal.username}'!`);
        setPasswordModal({ isOpen: false, userId: null, username: '', newPassword: '', temporaryPassword: null });
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // --- MAP ACTIONS ---
  const handleOpenEditMap = (m) => {
    setEditMapModal({
      isOpen: true,
      map: m,
      title: m.title || '',
      artist: m.artist || '',
      creator: m.creator || '',
      bpm: m.bpm || '',
      status: m.status || 'published',
    });
  };

  const handleSaveEditMap = async (e) => {
    e.preventDefault();
    if (!editMapModal.map) return;
    try {
      await apiClient.adminUpdateMap(editMapModal.map.id, {
        title: editMapModal.title,
        artist: editMapModal.artist,
        creator: editMapModal.creator,
        bpm: editMapModal.bpm ? parseFloat(editMapModal.bpm) : null,
        status: editMapModal.status,
      });
      toast.success(`Updated track '${editMapModal.title}'!`);
      setEditMapModal({ isOpen: false, map: null, title: '', artist: '', creator: '', bpm: '', status: 'published' });
      loadTabContent();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteMap = (m) => {
    setConfirmState({
      isOpen: true,
      title: `Delete Beatmap from Server`,
      message: `Are you sure you want to delete track '${m.title}' (${m.song_id})? All associated scores will be cleared from MySQL.`,
      confirmText: 'Delete Track',
      danger: true,
      onConfirm: async () => {
        try {
          await apiClient.adminDeleteMap(m.id);
          toast.success(`Deleted track '${m.title}' from the system!`);
          loadTabContent();
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  };

  // --- SCORE ACTIONS ---
  const handleDeleteScore = (sc) => {
    setConfirmState({
      isOpen: true,
      title: `Delete Score Record`,
      message: `Delete score ${Number(sc.score).toLocaleString()} of player '${sc.user?.username || 'Guest'}' on track '${sc.song_id}'? Player total PP will be recalculated automatically.`,
      confirmText: 'Delete Score',
      danger: true,
      onConfirm: async () => {
        try {
          await apiClient.adminDeleteScore(sc.id);
          toast.success('Deleted score and updated player PP!');
          loadTabContent();
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  };

  const handleRecalculateAllPP = () => {
    setConfirmState({
      isOpen: true,
      title: `⚡ Batch Recalculate PP across Server`,
      message: `This action will iterate through all scores in MySQL, recomputing PP values using the current standard formula and updating total_pp for each player.`,
      confirmText: 'Start Recalculation',
      danger: false,
      onConfirm: async () => {
        setIsRecalculating(true);
        try {
          const res = await apiClient.adminRecalculatePP();
          toast.success(res.message);
          loadTabContent();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setIsRecalculating(false);
        }
      },
    });
  };

  // Max plays for chart scaling
  const maxPlaysInWeek = useMemo(() => {
    if (!dashboardData?.plays_by_day) return 10;
    const max = Math.max(...dashboardData.plays_by_day.map((d) => d.count), 0);
    return max > 0 ? max : 10;
  }, [dashboardData]);

  return (
    <div className="w-full h-[calc(100vh-52px-24px)] mt-[52px] mb-6 flex flex-col select-none overflow-hidden bg-[#090914] text-white">
      {/* 1. TOP ADMIN HEADER */}
      <header className="h-auto min-h-14 px-2 sm:px-6 py-2 bg-[#111122]/90 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-y-2 shrink-0 z-20 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              playClick();
              onBack();
            }}
            icon="←"
            className="text-[#8890a4] hover:text-white"
          >
            Back
          </Button>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h1 className="min-w-0 font-torus font-black text-sm sm:text-base tracking-wider uppercase bg-gradient-to-r from-white via-[#ff80bf] to-[#ff66ab] bg-clip-text text-transparent">
              Triarhythm Administration Panel
            </h1>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#ff66ab]/20 text-[#ff66ab] text-[10px] font-mono font-bold border border-[#ff66ab]/30">
            ROOT ACCESS
          </span>
        </div>

        {/* Admin User Info */}
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <Avatar
            src={currentUser?.avatar}
            name={currentUser?.name || currentUser?.username}
            size="sm"
            status="online"
          />
          <div className="flex flex-col text-right leading-none">
            <span className="text-xs font-bold text-white">
              {currentUser?.name || currentUser?.username}
            </span>
            <span className="text-[10px] text-[#ff66ab] font-mono font-bold mt-0.5 uppercase">
              {currentUser?.role || 'admin'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. ADMIN TABS NAVIGATION */}
      <nav className="h-auto min-h-11 px-2 sm:px-6 py-1 bg-[#0f0f1c] border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 shrink-0">
        <div className="flex w-full sm:w-auto items-center gap-2 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Overview', badge: null },
            { id: 'users', label: '👥 Users', badge: dashboardData?.stats?.total_users },
            { id: 'maps', label: '🎵 Beatmaps', badge: dashboardData?.stats?.total_maps },
            { id: 'scores', label: '🏆 Scores & Moderation', badge: dashboardData?.stats?.total_scores },
            { id: 'logs', label: '📜 Activity Logs', badge: null },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playSelect();
                  setActiveTab(tab.id);
                }}
                onMouseEnter={() => !isActive && playHover()}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#ff66ab] text-white shadow-[0_0_12px_rgba(255,102,171,0.4)]'
                    : 'text-[#8890a4] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== null && tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-[#8890a4]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Action for recalculating PP */}
        <div className="w-full sm:w-auto flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRecalculateAllPP}
            disabled={isRecalculating}
            className="text-xs font-bold text-[#ffdd57] border-[#ffdd57]/40 hover:bg-[#ffdd57]/10"
            icon="⚡"
          >
            {isRecalculating ? 'Recalculating...' : 'Recalculate All PP'}
          </Button>
          <IconButton
            icon="↻"
            size="sm"
            tooltip="Refresh current tab"
            onClick={() => {
              playClick();
              loadTabContent();
            }}
          />
        </div>
      </nav>

      {/* 3. MAIN TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar bg-gradient-to-b from-[#090914] to-[#0d0d1a]">
        {isLoading && (
          <div className="flex items-center justify-center p-8 gap-3 text-xs text-[#ff66ab] font-bold">
            <div className="w-5 h-5 rounded-full border-2 border-[#ff66ab]/20 border-t-[#ff66ab] animate-spin" />
            <span>Loading data from server...</span>
          </div>
        )}

        {/* ================= TAB 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="max-w-6xl mx-auto flex flex-col gap-6 animate-fadeIn">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[#141424] border border-white/[0.08] shadow-lg flex flex-col gap-1">
                <span className="text-xs text-[#8890a4] font-medium flex items-center gap-1.5">
                  <span>👥</span> Total Players
                </span>
                <span className="text-3xl font-mono font-black text-white">
                  {dashboardData.stats.total_users.toLocaleString()}
                </span>
                <div className="text-[11px] text-[#ff66ab] font-medium mt-1">
                  {dashboardData.stats.total_admins} Admins • {dashboardData.stats.total_banned} Banned
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#141424] border border-white/[0.08] shadow-lg flex flex-col gap-1">
                <span className="text-xs text-[#8890a4] font-medium flex items-center gap-1.5">
                  <span>🎵</span> Total Beatmaps
                </span>
                <span className="text-3xl font-mono font-black text-white">
                  {dashboardData.stats.total_maps.toLocaleString()}
                </span>
                <div className="text-[11px] text-[#00e5ff] font-medium mt-1">
                  Verified & ready to play
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#141424] border border-white/[0.08] shadow-lg flex flex-col gap-1">
                <span className="text-xs text-[#8890a4] font-medium flex items-center gap-1.5">
                  <span>🎮</span> Total Plays
                </span>
                <span className="text-3xl font-mono font-black text-white">
                  {dashboardData.stats.total_plays.toLocaleString()}
                </span>
                <div className="text-[11px] text-[#66bb6a] font-medium mt-1">
                  {dashboardData.stats.total_scores.toLocaleString()} score records
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#141424] border border-white/[0.08] shadow-lg flex flex-col gap-1">
                <span className="text-xs text-[#8890a4] font-medium flex items-center gap-1.5">
                  <span>⭐</span> Total Server PP
                </span>
                <span className="text-3xl font-mono font-black text-[#ff66ab]">
                  {Number(dashboardData.stats.total_server_pp).toLocaleString()}
                </span>
                <div className="text-[11px] text-[#7c849c] font-medium mt-1 font-mono">
                  Weighted Top 100 PP
                </div>
              </div>
            </div>

            {/* Charts & Ranks Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Activity Chart (7 Days) */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-[#141424] border border-white/[0.08] shadow-lg flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-torus font-black text-white flex items-center gap-2">
                    <span>📈</span> Plays (Last 7 Days)
                  </h3>
                  <span className="text-xs text-[#8890a4] font-mono">Scores Submitted</span>
                </div>

                {/* SVG Bar Chart */}
                <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-white/[0.08]">
                  {dashboardData.plays_by_day.map((d, i) => {
                    const heightPct = Math.max((d.count / maxPlaysInWeek) * 100, 4);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded bg-[#ff66ab] text-white text-[10px] font-mono font-bold pointer-events-none whitespace-nowrap shadow-md z-10">
                          {d.count} plays
                        </div>
                        {/* Bar */}
                        <div
                          className="w-full max-w-[42px] rounded-t-md bg-gradient-to-t from-[#ff66ab]/40 to-[#ff66ab] group-hover:brightness-125 transition-all shadow-[0_0_8px_rgba(255,102,171,0.3)]"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[10px] text-[#8890a4] font-mono group-hover:text-white transition-colors">
                          {d.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Col: Rank Distribution */}
              <div className="p-5 rounded-2xl bg-[#141424] border border-white/[0.08] shadow-lg flex flex-col">
                <h3 className="text-sm font-torus font-black text-white mb-4 flex items-center gap-2">
                  <span>🏅</span> Rank Distribution
                </h3>
                <div className="flex flex-col gap-2.5 flex-1 justify-around">
                  {['SSS+', 'SSS', 'SS', 'S', 'A', 'B', 'C'].map((rk) => {
                    const count = dashboardData.rank_distribution[rk] || 0;
                    const totalSc = dashboardData.stats.total_scores || 1;
                    const pct = Math.round((count / totalSc) * 100);
                    return (
                      <div key={rk} className="flex items-center gap-3">
                        <RankBadge rank={rk} size="sm" />
                        <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#ff66ab] to-[#cc5289] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-mono text-[#8890a4]">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Admin Actions */}
            <div className="p-5 rounded-2xl bg-[#141424] border border-white/[0.08] shadow-lg flex flex-col">
              <h3 className="text-sm font-torus font-black text-white mb-3 flex items-center gap-2">
                <span>⚡</span> Recent Admin Activity
              </h3>
              <div className="divide-y divide-white/[0.04]">
                {dashboardData.recent_logs?.length > 0 ? (
                  dashboardData.recent_logs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={log.admin?.avatar}
                          name={log.admin?.name || log.admin?.username || 'Admin'}
                          size="xs"
                        />
                        <span className="font-bold text-white">
                          {log.admin?.username || 'System'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[#ff66ab] font-mono text-[10px] font-bold">
                          {log.action}
                        </span>
                        <span className="text-[#8890a4]">
                          {log.target_type && `[${log.target_type} #${log.target_id || ''}]`}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#7c849c] font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#7c849c] py-2">No activity logs recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: USERS MANAGEMENT ================= */}
        {activeTab === 'users' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-4 animate-fadeIn">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-[#141424] border border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadTabContent()}
                  placeholder="Search by name, username or email..."
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] rounded-xl px-3.5 py-1.5 text-xs text-white outline-none"
                />
                <Button size="sm" variant="primary" onClick={loadTabContent}>
                  Search
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#8890a4]">Role:</span>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => {
                      setUserRoleFilter(e.target.value);
                      setUserPagination((p) => ({ ...p, current_page: 1 }));
                    }}
                    className="bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="">All</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[#8890a4]">Status:</span>
                  <select
                    value={userBanFilter}
                    onChange={(e) => {
                      setUserBanFilter(e.target.value);
                      setUserPagination((p) => ({ ...p, current_page: 1 }));
                    }}
                    className="bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="">All</option>
                    <option value="false">Active</option>
                    <option value="true">Banned</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-[#141424] border border-white/[0.08] overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.08] text-[#8890a4] font-bold">
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Total PP</th>
                    <th className="py-3 px-4 text-center">Plays / Maps</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {users.length > 0 ? (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar src={u.avatar} name={u.name || u.username} size="sm" />
                            <div className="flex flex-col">
                              <span className="font-bold text-white">{u.name || u.username}</span>
                              <span className="text-[10px] text-[#7c849c] font-mono">@{u.username}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#b8c0d4] font-mono">{u.email}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleRole(u)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer ${
                              u.role === 'admin'
                                ? 'bg-[#ff66ab]/20 text-[#ff66ab] border border-[#ff66ab]/40 hover:bg-[#ff66ab]/30'
                                : 'bg-white/[0.06] text-[#8890a4] border border-white/[0.08] hover:text-white'
                            }`}
                            title="Click to toggle Admin / User role"
                          >
                            {u.role === 'admin' ? '🛡️ ADMIN' : '👤 USER'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#ff66ab]">
                          {Number(u.total_pp || 0).toLocaleString()}pp
                        </td>
                        <td className="py-3 px-4 text-center text-[#8890a4] font-mono">
                          {u.scores_count || 0} / {u.maps_count || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.is_banned ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold text-[10px] border border-red-500/30">
                              BANNED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenPasswordModal(u)}
                              className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[#8890a4] hover:text-white transition-colors"
                              title="Reset password"
                            >
                              🔑 Reset Pass
                            </button>
                            <button
                              onClick={() => handleToggleBan(u)}
                              className={`px-2 py-1 rounded transition-colors ${
                                u.is_banned
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                              }`}
                              title={u.is_banned ? 'Unban account' : 'Ban account'}
                            >
                              {u.is_banned ? '🔓 Unban' : '🔒 Ban'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Delete account"
                            >
                              ✕ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-[#7c849c]">
                        No matching users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {userPagination.last_page > 1 && (
                <div className="p-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-[#8890a4]">
                  <span>Total {userPagination.total} users</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={userPagination.current_page <= 1}
                      onClick={() =>
                        setUserPagination((p) => ({ ...p, current_page: p.current_page - 1 }))
                      }
                    >
                      ← Previous
                    </Button>
                    <span className="font-mono text-white">
                      {userPagination.current_page} / {userPagination.last_page}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={userPagination.current_page >= userPagination.last_page}
                      onClick={() =>
                        setUserPagination((p) => ({ ...p, current_page: p.current_page + 1 }))
                      }
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: MAPS MANAGEMENT ================= */}
        {activeTab === 'maps' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-4 animate-fadeIn">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-[#141424] border border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <input
                  type="text"
                  value={mapQuery}
                  onChange={(e) => setMapQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadTabContent()}
                  placeholder="Search by title, artist, mapper..."
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] rounded-xl px-3.5 py-1.5 text-xs text-white outline-none"
                />
                <Button size="sm" variant="primary" onClick={loadTabContent}>
                  Search
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#8890a4]">Status:</span>
                  <select
                    value={mapStatusFilter}
                    onChange={(e) => {
                      setMapStatusFilter(e.target.value);
                      setMapPagination((p) => ({ ...p, current_page: 1 }));
                    }}
                    className="bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="">All</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[#8890a4]">Source:</span>
                  <select
                    value={mapSourceFilter}
                    onChange={(e) => {
                      setMapSourceFilter(e.target.value);
                      setMapPagination((p) => ({ ...p, current_page: 1 }));
                    }}
                    className="bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="">All</option>
                    <option value="maimai">Maimai</option>
                    <option value="osu">osu!</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Maps Table */}
            <div className="rounded-2xl bg-[#141424] border border-white/[0.08] overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.08] text-[#8890a4] font-bold">
                    <th className="py-3 px-4">Song</th>
                    <th className="py-3 px-4">Mapper / Author</th>
                    <th className="py-3 px-4 text-center">Source</th>
                    <th className="py-3 px-4 text-right">BPM</th>
                    <th className="py-3 px-4 text-center">Plays</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {maps.length > 0 ? (
                    maps.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                              {m.cover_url ? (
                                <img src={m.cover_url} alt="Cover" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[#ff66ab] font-bold">♪</span>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-white truncate max-w-xs">{m.title}</span>
                              <span className="text-[10px] text-[#7c849c] truncate max-w-xs">{m.artist}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#b8c0d4]">
                          {m.creator || (m.user?.username ? `@${m.user.username}` : 'Triarhythm')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/[0.06] text-[#00e5ff]">
                            {m.source || 'osu'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#b8c0d4]">
                          {Math.round(m.bpm || 120)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[#8890a4]">
                          {m.play_count || m.scores_count || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                              m.status === 'published'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {m.status || 'published'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditMap(m)}
                              className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[#8890a4] hover:text-white transition-colors"
                              title="Edit track info"
                            >
                              ✎ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteMap(m)}
                              className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Delete track from server"
                            >
                              ✕ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-[#7c849c]">
                        No beatmaps found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {mapPagination.last_page > 1 && (
                <div className="p-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-[#8890a4]">
                  <span>Total {mapPagination.total} beatmaps</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={mapPagination.current_page <= 1}
                      onClick={() =>
                        setMapPagination((p) => ({ ...p, current_page: p.current_page - 1 }))
                      }
                    >
                      ← Previous
                    </Button>
                    <span className="font-mono text-white">
                      {mapPagination.current_page} / {mapPagination.last_page}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={mapPagination.current_page >= mapPagination.last_page}
                      onClick={() =>
                        setMapPagination((p) => ({ ...p, current_page: p.current_page + 1 }))
                      }
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: SCORES MODERATION ================= */}
        {activeTab === 'scores' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-4 animate-fadeIn">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-[#141424] border border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <input
                  type="text"
                  value={scoreQuery}
                  onChange={(e) => setScoreQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadTabContent()}
                  placeholder="Search by player or song ID..."
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] rounded-xl px-3.5 py-1.5 text-xs text-white outline-none"
                />
                <Button size="sm" variant="primary" onClick={loadTabContent}>
                  Search
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#8890a4]">Rank:</span>
                  <select
                    value={scoreRankFilter}
                    onChange={(e) => {
                      setScoreRankFilter(e.target.value);
                      setScorePagination((p) => ({ ...p, current_page: 1 }));
                    }}
                    className="bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-2.5 py-1 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="">All</option>
                    {['SSS+', 'SSS', 'SS', 'S', 'A', 'B', 'C'].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Scores Table */}
            <div className="rounded-2xl bg-[#141424] border border-white/[0.08] overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.08] text-[#8890a4] font-bold">
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">Song & Difficulty</th>
                    <th className="py-3 px-4 text-center">Rank</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right">Accuracy</th>
                    <th className="py-3 px-4 text-right">PP</th>
                    <th className="py-3 px-4 text-center">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {scores.length > 0 ? (
                    scores.map((sc) => (
                      <tr key={sc.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={sc.user?.avatar}
                              name={sc.user?.name || sc.user?.username || 'Guest'}
                              size="xs"
                            />
                            <span className="font-bold text-white">
                              {sc.user?.name || sc.user?.username || 'Guest Player'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {sc.map?.title || sc.song_id}
                            </span>
                            <span className="text-[10px] text-[#ff66ab] font-mono">
                              {sc.difficulty_name || 'Standard'} ({sc.stars || 5}★)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <RankBadge rank={sc.rank} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {Number(sc.score).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#b8c0d4]">
                          {Number(sc.accuracy).toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#ff66ab]">
                          {Number(sc.pp || 0).toLocaleString()}pp
                        </td>
                        <td className="py-3 px-4 text-center text-[#7c849c] font-mono text-[10px]">
                          {new Date(sc.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteScore(sc)}
                            className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-bold transition-colors cursor-pointer"
                            title="Delete score and deduct PP"
                          >
                            ✕ Delete Score
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-[#7c849c]">
                        No score records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {scorePagination.last_page > 1 && (
                <div className="p-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-[#8890a4]">
                  <span>Total {scorePagination.total} records</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={scorePagination.current_page <= 1}
                      onClick={() =>
                        setScorePagination((p) => ({ ...p, current_page: p.current_page - 1 }))
                      }
                    >
                      ← Previous
                    </Button>
                    <span className="font-mono text-white">
                      {scorePagination.current_page} / {scorePagination.last_page}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={scorePagination.current_page >= scorePagination.last_page}
                      onClick={() =>
                        setScorePagination((p) => ({ ...p, current_page: p.current_page + 1 }))
                      }
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: ACTIVITY LOGS ================= */}
        {activeTab === 'logs' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-4 animate-fadeIn">
            <div className="rounded-2xl bg-[#141424] border border-white/[0.08] overflow-hidden shadow-xl">
              <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between">
                <h3 className="font-torus font-black text-sm text-white">
                  📜 Administrator Activity Log (Audit Log)
                </h3>
                <span className="text-xs text-[#8890a4]">Logs all sensitive administrative actions</span>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {logs.length > 0 ? (
                  logs.map((lg) => (
                    <div key={lg.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={lg.admin?.avatar}
                          name={lg.admin?.name || lg.admin?.username || 'Admin'}
                          size="sm"
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {lg.admin?.name || lg.admin?.username || 'System'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#ff66ab]/20 text-[#ff66ab] font-mono text-[10px] font-bold">
                              {lg.action}
                            </span>
                            {lg.target_type && (
                              <span className="text-[#8890a4] font-mono text-[11px]">
                                Target: {lg.target_type} #{lg.target_id || ''}
                              </span>
                            )}
                          </div>
                          {lg.details && (
                            <pre className="p-2 rounded bg-black/40 border border-white/5 text-[10px] font-mono text-[#b8c0d4] max-w-xl overflow-x-auto">
                              {JSON.stringify(lg.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 text-right">
                        <span className="text-[11px] font-mono text-[#8890a4]">
                          {new Date(lg.created_at).toLocaleString()}
                        </span>
                        {lg.ip_address && (
                          <span className="text-[10px] font-mono text-[#7c849c]">
                            IP: {lg.ip_address}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-[#7c849c]">No activity logs recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: EDIT MAP ================= */}
      <Modal
        isOpen={editMapModal.isOpen}
        onClose={() => setEditMapModal((m) => ({ ...m, isOpen: false }))}
        title="Edit Beatmap Metadata"
        size="md"
      >
        <form onSubmit={handleSaveEditMap} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-[#b8c0d4] mb-1">Song Title</label>
            <input
              type="text"
              value={editMapModal.title}
              onChange={(e) => setEditMapModal((m) => ({ ...m, title: e.target.value }))}
              required
              className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#b8c0d4] mb-1">Artist / Author</label>
            <input
              type="text"
              value={editMapModal.artist}
              onChange={(e) => setEditMapModal((m) => ({ ...m, artist: e.target.value }))}
              required
              className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#b8c0d4] mb-1">Mapper / Creator</label>
              <input
                type="text"
                value={editMapModal.creator}
                onChange={(e) => setEditMapModal((m) => ({ ...m, creator: e.target.value }))}
                className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#b8c0d4] mb-1">BPM</label>
              <input
                type="number"
                step="0.1"
                value={editMapModal.bpm}
                onChange={(e) => setEditMapModal((m) => ({ ...m, bpm: e.target.value }))}
                className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#b8c0d4] mb-1">Release Status</label>
            <select
              value={editMapModal.status}
              onChange={(e) => setEditMapModal((m) => ({ ...m, status: e.target.value }))}
              className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none cursor-pointer"
            >
              <option value="published">Published (Ready to play & compete)</option>
              <option value="draft">Draft (Draft / Under review)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditMapModal((m) => ({ ...m, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: RESET PASSWORD ================= */}
      <Modal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal((p) => ({ ...p, isOpen: false }))}
        title={`Reset Password for '${passwordModal.username}'`}
        size="sm"
      >
        <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
          <p className="text-xs text-[#b8c0d4]">
            Enter a new password for the account or leave blank for a system-generated temporary password.
          </p>
          <div>
            <label className="block text-xs font-bold text-[#b8c0d4] mb-1">New Password (Optional)</label>
            <input
              type="password"
              value={passwordModal.newPassword}
              onChange={(e) => setPasswordModal((p) => ({ ...p, newPassword: e.target.value }))}
              placeholder="Min 6 characters or leave blank..."
              className="w-full h-10 px-3.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] focus:border-[#ff66ab] text-sm text-white outline-none"
            />
          </div>

          {passwordModal.temporaryPassword && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              Temporary password: <strong>{passwordModal.temporaryPassword}</strong>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPasswordModal((p) => ({ ...p, isOpen: false }))}
            >
              Close
            </Button>
            <Button type="submit" variant="primary">
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= GLOBAL CONFIRM DIALOG ================= */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((c) => ({ ...c, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        danger={confirmState.danger}
      />
    </div>
  );
}
