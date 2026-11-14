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

        $map = Map::updateOrCreate(
            ['song_id' => $validated['song_id']],
            [
                'title' => $validated['title'],
                'artist' => $validated['artist'] ?? 'Unknown Artist',
                'creator' => $validated['creator'] ?? 'Mapper',
                'source' => $validated['source'] ?? 'maimai',
                'bpm' => $validated['bpm'] ?? 120,
                'preview_time' => $validated['preview_time'] ?? 0,
                'cover_url' => $this->cleanUrl($validated['cover_url'] ?? null),
                'audio_url' => $this->cleanUrl($validated['audio_url'] ?? null),
                'video_url' => $this->cleanUrl($validated['video_url'] ?? null),
                'difficulties' => $validated['difficulties'],
                'metadata' => $validated['metadata'] ?? [],
            ]
        );

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

    public function destroy(string $song_id): JsonResponse
    {
        $map = Map::where('song_id', $song_id)->first();

        if (!$map) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy beatmap'], 404);
        }

        // Xoá asset đã upload để tránh file mồ côi trong storage.
        Storage::disk('public')->deleteDirectory("beatmaps/{$song_id}");

        $map->delete();

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa beatmap khỏi MySQL Database!',
        ]);
    }
}
