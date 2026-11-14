<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Map;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MapController extends Controller
{
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
                'cover_url' => $validated['cover_url'] ?? null,
                'audio_url' => $validated['audio_url'] ?? null,
                'video_url' => $validated['video_url'] ?? null,
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

        $map->delete();

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa beatmap khỏi MySQL Database!',
        ]);
    }
}
