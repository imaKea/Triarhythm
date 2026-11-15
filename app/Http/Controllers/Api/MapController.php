<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Map;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MapController extends Controller
{
    /**
     * Bỏ qua URL tạm (blob:) do trình duyệt sinh ra — không lưu vào MySQL.
     */
    private function cleanUrl(?string $url): ?string
    {
        if (!$url) {
            return null;
        }
        return str_starts_with($url, 'blob:') ? null : $url;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Map::query();

        if ($search = $request->query('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('artist', 'like', "%{$search}%")
                  ->orWhere('creator', 'like', "%{$search}%");
            });
        }

        if ($source = $request->query('source')) {
            $query->where('source', $source);
        }

        $maps = $query->orderByDesc('created_at')->get();
        $maps->each(static function (Map $map): void {
            $difficulties = $map->difficulties ?? [];
            $hasChart = false;
            $map->setAttribute('difficulties', array_map(static function ($difficulty) use (&$hasChart) {
                if (is_array($difficulty)) {
                    $chart = $difficulty['beatmap'] ?? $difficulty['chart'] ?? null;
                    if (is_array($chart) && is_array($chart['notes'] ?? null)) {
                        $hasChart = true;
                    }
                    unset($difficulty['beatmap'], $difficulty['chart']);
                }
                return $difficulty;
            }, $difficulties));
            $map->setAttribute('chart_available', $hasChart);
        });

        return response()->json([
            'success' => true,
            'count' => $maps->count(),
            'maps' => $maps,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'song_id' => 'required|string|max:191',
            'title' => 'required|string|max:255',
            'artist' => 'nullable|string|max:255',
            'creator' => 'nullable|string|max:255',
            'source' => 'nullable|string|max:50',
            'bpm' => 'nullable|numeric',
            'preview_time' => 'nullable|numeric',
            'cover_url' => 'nullable|string|max:500',
            'audio_url' => 'nullable|string|max:500',
            'video_url' => 'nullable|string|max:500',
            'difficulties' => 'required|array',
            'metadata' => 'nullable|array',
        ]);

        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = \App\Models\User::where('api_token', hash('sha256', $token))->first();
            }
        }

        $map = Map::where('song_id', $validated['song_id'])->first();
        if ($map && (!$user || (!$user->isAdmin() && $map->user_id !== $user->id))) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền cập nhật beatmap này.',
            ], 403);
        }

        $map ??= new Map([
            'song_id' => $validated['song_id'],
            'user_id' => $user?->id,
        ]);
        $map->fill([
            'title' => $validated['title'],
            'artist' => $validated['artist'] ?? 'Unknown Artist',
            'creator' => $validated['creator'] ?? ($user ? $user->name : 'Mapper'),
            'source' => $validated['source'] ?? 'maimai',
            'bpm' => $validated['bpm'] ?? 120,
            'preview_time' => $validated['preview_time'] ?? 0,
            'cover_url' => $this->cleanUrl($validated['cover_url'] ?? null),
            'audio_url' => $this->cleanUrl($validated['audio_url'] ?? null),
            'video_url' => $this->cleanUrl($validated['video_url'] ?? null),
            'difficulties' => $validated['difficulties'],
            'metadata' => $validated['metadata'] ?? [],
        ]);
        $map->save();

        return response()->json([
            'success' => true,
            'message' => 'Lưu beatmap thành công vào MySQL Database!',
            'map' => $map,
        ], 201);
    }

    /**
     * Nhận file audio / background / video (multipart) và lưu vào public disk.
     * Trả về URL tương đối `/storage/...` để frontend dùng lại sau khi reload.
     */
    public function uploadAssets(Request $request, string $song_id): JsonResponse
    {
        $map = Map::where('song_id', $song_id)->first();

        if (!$map) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy beatmap'], 404);
        }

        $user = $request->user();
        if (!$user || (!$user->isAdmin() && $map->user_id !== $user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền thay thế asset của beatmap này.',
            ], 403);
        }

        $request->validate([
            'audio' => 'nullable|file|mimes:mp3,ogg,wav,m4a,aac,flac|max:51200',
            'background' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:10240',
            'video' => 'nullable|file|mimes:mp4,webm,mkv,mov|max:102400',
        ]);

        $disk = Storage::disk('public');
        $folder = "beatmaps/{$song_id}";
        $updated = [];

        $fields = [
            'audio' => 'audio_url',
            'background' => 'cover_url',
            'video' => 'video_url',
        ];

        foreach ($fields as $input => $column) {
            if (!$request->hasFile($input)) {
                continue;
            }

            // Xoá file cũ nếu trước đó đã upload vào storage của app.
            $old = $map->{$column};
            if (is_string($old) && str_starts_with($old, '/storage/')) {
                $oldPath = substr($old, strlen('/storage/'));
                if ($disk->exists($oldPath)) {
                    $disk->delete($oldPath);
                }
            }

            $path = $request->file($input)->store($folder, 'public');
            $url = '/storage/' . str_replace('\\', '/', $path);

            $map->{$column} = $url;
            $updated[$column] = $url;
        }

        $map->save();

        return response()->json([
            'success' => true,
            'message' => 'Tải asset lên thành công!',
            'assets' => [
                'audio_url' => $map->audio_url,
                'cover_url' => $map->cover_url,
                'video_url' => $map->video_url,
            ],
            'updated' => $updated,
        ]);
    }

    public function show(string $song_id): JsonResponse
    {
        $map = Map::where('song_id', $song_id)->first();

        if (!$map) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy beatmap'], 404);
        }

        return response()->json([
            'success' => true,
            'map' => $map,
        ]);
    }

    public function destroy(Request $request, string $song_id): JsonResponse
    {
        $map = Map::where('song_id', $song_id)->first();

        if (!$map) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy beatmap'], 404);
        }

        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = \App\Models\User::where('api_token', hash('sha256', $token))->first();
            }
        }

        // Kiểm tra quyền: Chỉ tác giả map hoặc Quản trị viên (Admin) mới có quyền xoá
        $canDelete = $user && ($user->isAdmin() || ($map->user_id && $map->user_id === $user->id));

        if (!$canDelete) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền xoá beatmap này. Chỉ tác giả tạo map hoặc Quản trị viên mới có thể xoá.',
            ], 403);
        }

        // Soft delete: Giữ lại storage assets để người dùng có thể hoàn tác (Undo / Restore)
        $map->delete();

        return response()->json([
            'success' => true,
            'message' => 'Đã chuyển beatmap vào thùng rác tạm (Soft Delete)!',
        ]);
    }

    /**
     * POST /api/maps/{song_id}/restore
     * Hoàn tác xóa / Khôi phục beatmap từ thùng rác
     */
    public function restore(Request $request, string $song_id): JsonResponse
    {
        $map = Map::onlyTrashed()->where('song_id', $song_id)->first();

        if (!$map) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy beatmap trong thùng rác'], 404);
        }

        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = \App\Models\User::where('api_token', hash('sha256', $token))->first();
            }
        }

        $canRestore = $user && ($user->isAdmin() || ($map->user_id && $map->user_id === $user->id));
        if (!$canRestore) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền khôi phục beatmap này.',
            ], 403);
        }

        $map->restore();

        return response()->json([
            'success' => true,
            'message' => "Đã khôi phục thành công bài hát '{$map->title}'!",
            'map' => $map,
        ]);
    }

    /**
     * DELETE /api/maps/{song_id}/force
     * Xóa vĩnh viễn beatmap và dọn sạch file assets trong disk
     */
    public function forceDestroy(Request $request, string $song_id): JsonResponse
    {
        $map = Map::withTrashed()->where('song_id', $song_id)->first();

        if (!$map) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy beatmap'], 404);
        }

        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = \App\Models\User::where('api_token', hash('sha256', $token))->first();
            }
        }

        $canForce = $user && ($user->isAdmin() || ($map->user_id && $map->user_id === $user->id));
        if (!$canForce) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền xóa vĩnh viễn beatmap này.',
            ], 403);
        }

        // Xóa asset files trên disk
        Storage::disk('public')->deleteDirectory("beatmaps/{$song_id}");

        $map->forceDelete();

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa vĩnh viễn beatmap và dọn dẹp bộ nhớ lưu trữ!',
        ]);
    }

    /**
     * GET /api/maps/trash/list
     * Lấy danh sách các bài hát trong thùng rác
     */
    public function trashed(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Map::onlyTrashed();

        if (!$user->isAdmin()) {
            $query->where('user_id', $user->id);
        }

        $maps = $query->orderByDesc('deleted_at')->get();

        return response()->json([
            'success' => true,
            'data' => $maps,
        ]);
    }
}
