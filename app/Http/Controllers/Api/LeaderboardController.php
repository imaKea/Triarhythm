<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Score;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaderboardController extends Controller
{
    public function global(Request $request): JsonResponse
    {
        $type = $request->query('type', 'rating'); // 'rating' or 'score'
        $limit = min(100, max(1, (int)$request->query('limit', 50)));

        $query = User::query()->where('play_count', '>', 0);

        if ($type === 'score') {
            $query->orderByDesc('total_score');
        } else {
            $query->orderByDesc('rating')->orderByDesc('total_score');
        }

        $players = $query->limit($limit)->get([
            'id',
            'name',
            'username',
            'avatar',
            'rating',
            'total_score',
            'play_count',
            'created_at',
        ]);

        return response()->json([
            'success' => true,
            'type' => $type,
            'players' => $players,
        ]);
    }

    public function map(Request $request, string $song_id): JsonResponse
    {
        $difficulty = $request->query('difficulty');
        $limit = min(100, max(1, (int)$request->query('limit', 50)));

        $query = Score::with('user:id,name,username,avatar,rating')
            ->where('song_id', $song_id);

        if ($difficulty) {
            $query->where('difficulty_name', $difficulty);
        }

        $scores = $query->orderByDesc('score')
            ->orderByDesc('accuracy')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'song_id' => $song_id,
            'difficulty' => $difficulty,
            'scores' => $scores,
        ]);
    }
}
