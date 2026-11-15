<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Map;
use App\Models\Score;
use App\Models\User;
use App\Services\PpCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use League\Flysystem\UnableToDeleteDirectory;

class AdminController extends Controller
{
    /**
     * GET /api/admin/dashboard
     * Tổng quan thống kê hệ thống, biểu đồ lượt chơi và phân bố thứ hạng
     */
    public function dashboard(Request $request): JsonResponse
    {
        $totalUsers = User::count();
        $totalAdmins = User::where('role', 'admin')->count();
        $totalBanned = User::where('is_banned', true)->count();
        $totalMaps = Map::count();
        $totalScores = Score::count();
        $totalPlays = (int) User::sum('play_count');
        $totalServerPP = (float) User::sum('total_pp');

        // Thống kê số lượt chơi theo ngày (7 ngày gần nhất)
        $sevenDaysAgo = now()->subDays(6)->startOfDay();
        $playsRaw = Score::select(DB::raw('DATE(created_at) as date'), DB::raw('count(*) as count'))
            ->where('created_at', '>=', $sevenDaysAgo)
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date')
            ->toArray();

        $playsByDay = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $playsByDay[] = [
                'date' => $date,
                'label' => now()->subDays($i)->format('d/m'),
                'count' => $playsRaw[$date] ?? 0,
            ];
        }

        // Phân bố thứ hạng (Rank distribution)
        $rankDistribution = Score::select('rank', DB::raw('count(*) as count'))
            ->groupBy('rank')
            ->pluck('count', 'rank')
            ->toArray();

        // 6 hành động admin gần nhất
        $recentLogs = AdminLog::with('admin:id,name,username,avatar')
            ->orderByDesc('id')
            ->limit(6)
            ->get();

        return response()->json([
            'success' => true,
            'stats' => [
                'total_users' => $totalUsers,
                'total_admins' => $totalAdmins,
                'total_banned' => $totalBanned,
                'total_maps' => $totalMaps,
                'total_scores' => $totalScores,
                'total_plays' => $totalPlays,
                'total_server_pp' => round($totalServerPP, 2),
            ],
            'plays_by_day' => $playsByDay,
            'rank_distribution' => $rankDistribution,
            'recent_logs' => $recentLogs,
        ]);
    }

    /**
     * GET /api/admin/users
     * Danh sách người dùng kèm bộ lọc và tìm kiếm
     */
    public function users(Request $request): JsonResponse
    {
        $query = User::query();

        if ($search = $request->query('query')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($role = $request->query('role')) {
            $query->where('role', $role);
        }

        if ($request->has('is_banned')) {
            $query->where('is_banned', filter_var($request->query('is_banned'), FILTER_VALIDATE_BOOLEAN));
        }

        $users = $query->withCount(['scores', 'maps'])
            ->orderByDesc('id')
            ->paginate($request->query('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $users->items(),
            'pagination' => [
                'total' => $users->total(),
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
            ],
        ]);
    }

    /**
     * PUT /api/admin/users/{id}/role
     * Đổi vai trò (user <-> admin)
     */
    public function updateUserRole(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'role' => 'required|in:admin,user',
        ]);

        $user = User::findOrFail($id);
        $currentAdmin = $request->user();

        // Không cho phép admin tự hạ quyền mình nếu là admin duy nhất
        if ($user->id === $currentAdmin->id && $validated['role'] !== 'admin') {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể hạ quyền Admin duy nhất trong hệ thống!',
                ], 400);
            }
        }

        $oldRole = $user->role;
        $user->role = $validated['role'];
        $user->save();

        AdminLog::log(
            $currentAdmin,
            'user.change_role',
            'user',
            (string) $user->id,
            ['old_role' => $oldRole, 'new_role' => $user->role, 'target_username' => $user->username],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => "Đã chuyển vai trò người dùng '{$user->username}' thành {$user->role}!",
            'user' => $user,
        ]);
    }

    /**
     * PUT /api/admin/users/{id}/ban
     * Khóa hoặc mở khóa tài khoản
     */
    public function toggleUserBan(Request $request, $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $currentAdmin = $request->user();

        if ($user->id === $currentAdmin->id) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không thể tự khóa tài khoản của chính mình!',
            ], 400);
        }

        if ($user->role === 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Không thể khóa tài khoản Quản trị viên. Hãy hạ quyền xuống người dùng trước!',
            ], 400);
        }

        $user->is_banned = ! $user->is_banned;
        $user->save();

        AdminLog::log(
            $currentAdmin,
            $user->is_banned ? 'user.ban' : 'user.unban',
            'user',
            (string) $user->id,
            ['username' => $user->username, 'is_banned' => $user->is_banned],
            $request->ip()
        );

        $actionText = $user->is_banned ? 'khóa' : 'mở khóa';

        return response()->json([
            'success' => true,
            'message' => "Đã {$actionText} tài khoản '{$user->username}' thành công!",
            'is_banned' => $user->is_banned,
        ]);
    }

    /**
     * PUT /api/admin/users/{id}/reset-password
     * Đặt lại mật khẩu tài khoản
     */
    public function resetUserPassword(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'password' => 'nullable|string|min:6',
        ]);

        $user = User::findOrFail($id);
        $currentAdmin = $request->user();

        $newPassword = $validated['password'] ?? Str::random(10);
        $user->password = Hash::make($newPassword);
        // Hủy session/token cũ để buộc đăng nhập lại
        $user->api_token = null;
        $user->save();

        AdminLog::log(
            $currentAdmin,
            'user.reset_password',
            'user',
            (string) $user->id,
            ['username' => $user->username],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => "Đã đặt lại mật khẩu cho '{$user->username}'!",
            'temporary_password' => $validated['password'] ? null : $newPassword,
        ]);
    }

    /**
     * DELETE /api/admin/users/{id}
     * Xóa tài khoản và dọn dữ liệu liên quan
     */
    public function deleteUser(Request $request, $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $currentAdmin = $request->user();

        if ($user->id === $currentAdmin->id) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không thể tự xóa tài khoản của chính mình!',
            ], 400);
        }

        $username = $user->username;

        // Xóa tất cả điểm số của user
        $user->scores()->delete();

        // Gỡ sở hữu các map hoặc xóa map
        Map::where('user_id', $user->id)->update(['user_id' => null]);

        $user->delete();

        AdminLog::log(
            $currentAdmin,
            'user.delete',
            'user',
            (string) $id,
            ['deleted_username' => $username],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => "Đã xóa người dùng '{$username}' và dữ liệu liên quan thành công!",
        ]);
    }

    /**
     * GET /api/admin/maps
     * Danh sách beatmaps với bộ lọc
     */
    public function maps(Request $request): JsonResponse
    {
        $query = Map::query();

        if ($search = $request->query('query')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('artist', 'like', "%{$search}%")
                    ->orWhere('creator', 'like', "%{$search}%")
                    ->orWhere('song_id', 'like', "%{$search}%");
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($source = $request->query('source')) {
            $query->where('source', $source);
        }

        $maps = $query->with('user:id,name,username')
            ->withCount('scores')
            ->orderByDesc('id')
            ->paginate($request->query('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $maps->items(),
            'pagination' => [
                'total' => $maps->total(),
                'current_page' => $maps->currentPage(),
                'last_page' => $maps->lastPage(),
                'per_page' => $maps->perPage(),
            ],
        ]);
    }

    /**
     * PUT /api/admin/maps/{id}
     * Cập nhật metadata beatmap
     */
    public function updateMap(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'artist' => 'nullable|string|max:255',
            'creator' => 'nullable|string|max:100',
            'bpm' => 'nullable|numeric',
            'preview_time' => 'nullable|numeric',
            'status' => 'nullable|in:published,draft',
        ]);

        $map = Map::findOrFail($id);
        $oldData = $map->only(['title', 'artist', 'creator', 'status', 'bpm']);

        $map->fill(array_filter($validated, fn ($v) => ! is_null($v)));
        $map->save();

        AdminLog::log(
            $request->user(),
            'map.update',
            'map',
            (string) $map->id,
            ['old' => $oldData, 'new' => $map->only(['title', 'artist', 'creator', 'status', 'bpm'])],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => "Đã cập nhật bài hát '{$map->title}'!",
            'map' => $map,
        ]);
    }

    /**
     * DELETE /api/admin/maps/{id}
     * Xóa beatmap và dọn dẹp file assets
     */
    public function deleteMap(Request $request, $id): JsonResponse
    {
        $deletedMap = DB::transaction(function () use ($id): array {
            $map = Map::where('id', $id)->orWhere('song_id', $id)->lockForUpdate()->firstOrFail();
            $songId = $map->song_id;
            $affectedUserIds = Score::where('song_id', $songId)
                ->distinct()
                ->orderBy('user_id')
                ->pluck('user_id');
            $users = [];
            foreach ($affectedUserIds as $userId) {
                $user = User::whereKey($userId)->lockForUpdate()->first();
                if ($user) {
                    $users[] = $user;
                }
            }

            Score::where('song_id', $songId)->delete();
            foreach ($users as $user) {
                $user->recalculateStats();
            }

            $title = $map->title;
            $map->delete();

            return ['title' => $title, 'song_id' => $songId];
        });
        $title = $deletedMap['title'];
        $songId = $deletedMap['song_id'];

        try {
            if (! Storage::disk('public')->deleteDirectory("maps/{$songId}")) {
                Log::warning('Failed to remove map assets after deleting the map.', ['song_id' => $songId]);
            }
        } catch (UnableToDeleteDirectory $error) {
            Log::warning('Failed to remove map assets after deleting the map.', [
                'song_id' => $songId,
                'exception' => $error,
            ]);
        }

        AdminLog::log(
            $request->user(),
            'map.delete',
            'map',
            (string) $id,
            ['song_id' => $songId, 'title' => $title],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => "Đã xóa bài hát '{$title}' ({$songId}) thành công!",
        ]);
    }

    /**
     * GET /api/admin/scores
     * Danh sách điểm số kèm bộ lọc tìm kiếm
     */
    public function scores(Request $request): JsonResponse
    {
        $query = Score::query();

        if ($songId = $request->query('song_id')) {
            $query->where('song_id', $songId);
        }

        if ($userId = $request->query('user_id')) {
            $query->where('user_id', $userId);
        }

        if ($rank = $request->query('rank')) {
            $query->where('rank', $rank);
        }

        if ($minScore = $request->query('min_score')) {
            $query->where('score', '>=', (int) $minScore);
        }

        if ($search = $request->query('query')) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            })->orWhere('song_id', 'like', "%{$search}%");
        }

        $scores = $query->with(['user:id,name,username,avatar', 'map:song_id,title,artist'])
            ->orderByDesc('id')
            ->paginate($request->query('per_page', 25));

        return response()->json([
            'success' => true,
            'data' => $scores->items(),
            'pagination' => [
                'total' => $scores->total(),
                'current_page' => $scores->currentPage(),
                'last_page' => $scores->lastPage(),
                'per_page' => $scores->perPage(),
            ],
        ]);
    }

    /**
     * DELETE /api/admin/scores/{id}
     * Xóa điểm số gian lận/lỗi và tự động cập nhật lại tổng PP của người chơi
     */
    public function deleteScore(Request $request, $id): JsonResponse
    {
        $initialScore = Score::findOrFail($id);
        $deletedScore = DB::transaction(function () use ($id, $initialScore): array {
            $map = Map::withTrashed()
                ->where('song_id', $initialScore->song_id)
                ->lockForUpdate()
                ->first();
            $user = User::whereKey($initialScore->user_id)->lockForUpdate()->first();
            $score = Score::whereKey($id)->lockForUpdate()->firstOrFail();
            $details = [
                'user_id' => $score->user_id,
                'song_id' => $score->song_id,
                'score' => $score->score,
            ];
            $score->delete();

            if ($user) {
                $user->recalculateStats();
            }
            if ($map) {
                $map->play_count = Score::where('song_id', $map->song_id)->count();
                $map->save();
            }

            return $details;
        });
        $userId = $deletedScore['user_id'];
        $songId = $deletedScore['song_id'];

        AdminLog::log(
            $request->user(),
            'score.delete',
            'score',
            (string) $id,
            $deletedScore,
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa bản ghi điểm số và cập nhật lại tổng PP người chơi thành công!',
        ]);
    }

    /**
     * POST /api/admin/scores/recalculate-pp
     * Batch tính toán lại toàn bộ PP trên server khi công thức hoặc độ khó bài hát thay đổi
     */
    public function recalculateAllPP(Request $request): JsonResponse
    {
        $maps = Map::all()->keyBy('song_id');
        $scores = Score::all();
        $updatedScores = 0;

        foreach ($scores as $score) {
            $stars = 0.0;
            $noteCount = 0;
            $map = $maps->get($score->song_id);
            if ($map && is_array($map->difficulties)) {
                foreach ($map->difficulties as $difficulty) {
                    if (($difficulty['difficultyName'] ?? '') === $score->difficulty_name) {
                        $candidateStars = (float) ($difficulty['stars'] ?? 0);
                        if ($candidateStars > 0) {
                            $stars = $candidateStars;
                            $noteCount = (int) $score->critical_perfect
                                + (int) $score->perfect
                                + (int) $score->great
                                + (int) $score->good
                                + (int) $score->miss;
                        }
                        break;
                    }
                }
            }

            $newPP = $stars > 0
                ? PpCalculator::calculatePP($stars, (float) $score->accuracy, (int) $score->miss, $noteCount)
                : 0.0;
            $score->stars = $stars;
            $score->pp = $newPP;
            $score->save();
            $updatedScores++;
        }

        // Cập nhật lại total_pp cho từng user
        $users = User::all();
        $updatedUsers = 0;

        foreach ($users as $user) {
            $user->recalculateStats();
            $updatedUsers++;
        }

        AdminLog::log(
            $request->user(),
            'scores.recalculate_pp',
            'system',
            null,
            ['scores_updated' => $updatedScores, 'users_updated' => $updatedUsers],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => "Đã tính lại thành công {$updatedScores} điểm số và {$updatedUsers} người chơi!",
            'updated_scores' => $updatedScores,
            'updated_users' => $updatedUsers,
        ]);
    }

    /**
     * GET /api/admin/logs
     * Danh sách nhật ký hoạt động của Quản trị viên
     */
    public function logs(Request $request): JsonResponse
    {
        $logs = AdminLog::with('admin:id,name,username,avatar')
            ->orderByDesc('id')
            ->paginate($request->query('per_page', 30));

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'pagination' => [
                'total' => $logs->total(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
            ],
        ]);
    }
}
