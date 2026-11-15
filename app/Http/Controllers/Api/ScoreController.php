<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Map;
use App\Models\Score;
use App\Models\User;
use App\Services\PpCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScoreController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'song_id' => 'required|string',
            'difficulty_name' => 'required|string',
            'stars' => 'nullable|numeric|min:0|max:15.0',
            'note_count' => 'nullable|integer|min:0',
            'score' => 'required|integer|min:0|max:1010000',
            'accuracy' => 'required|numeric|min:0|max:101.00',
            'max_combo' => 'required|integer|min:0',
            'rank' => 'required|string|max:10',
            'critical_perfect' => 'nullable|integer|min:0',
            'perfect' => 'nullable|integer|min:0',
            'great' => 'nullable|integer|min:0',
            'good' => 'nullable|integer|min:0',
            'miss' => 'nullable|integer|min:0',
            'pp' => 'nullable|numeric|min:0',
            'mods' => 'nullable|array',
            'mods.isAutoplay' => 'nullable|boolean',
        ]);

        if ($request->boolean('mods.isAutoplay')) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể nộp điểm khi bật Autoplay.',
            ], 422);
        }

        // Xác thực người dùng qua API token
        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = User::where('api_token', hash('sha256', $token))->first();
            }
        }

        // Không cho phép lưu vào tài khoản guest dùng chung; yêu cầu đăng nhập
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Yêu cầu đăng nhập để lưu điểm trực tuyến lên bảng xếp hạng.',
            ], 401);
        }

        $missCount = (int)($validated['miss'] ?? 0);
        $accuracy = (float)$validated['accuracy'];
        $serverCalculatedPP = 0.0;
        $stars = 0.0;

        DB::transaction(function () use (
            $validated,
            $user,
            $missCount,
            $accuracy,
            &$serverCalculatedPP,
            &$stars,
            &$score
        ): void {
            $map = Map::where('song_id', $validated['song_id'])->lockForUpdate()->first();
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();

            $noteCount = 0;
            if ($map && is_array($map->difficulties)) {
                foreach ($map->difficulties as $difficulty) {
                    if (($difficulty['difficultyName'] ?? '') === $validated['difficulty_name']) {
                        $candidateStars = (float)($difficulty['stars'] ?? 0);
                        if ($candidateStars > 0) {
                            $stars = $candidateStars;
                            $noteCount = max(0, (int)($difficulty['noteCount'] ?? 0));
                        }
                        break;
                    }
                }
            }

            // Client stars/note_count are informational only; absent server
            // chart data preserves the score but awards no PP.
            if ($stars > 0) {
                $serverCalculatedPP = PpCalculator::calculatePP($stars, $accuracy, $missCount, $noteCount);
            }

            $score = Score::create([
                'user_id' => $user->id,
                'song_id' => $validated['song_id'],
                'difficulty_name' => $validated['difficulty_name'],
                'stars' => $stars,
                'score' => $validated['score'],
                'accuracy' => $accuracy,
                'max_combo' => $validated['max_combo'],
                'rank' => $validated['rank'],
                'critical_perfect' => $validated['critical_perfect'] ?? 0,
                'perfect' => $validated['perfect'] ?? 0,
                'great' => $validated['great'] ?? 0,
                'good' => $validated['good'] ?? 0,
                'miss' => $missCount,
                'pp' => $serverCalculatedPP,
                'mods' => $validated['mods'] ?? [],
            ]);

            if ($map) {
                $map->increment('play_count');
            }

            $user->recalculateStats();
        });
        $user = $user->fresh();

        // Lấy thứ hạng trên bảng xếp hạng của bài hát này
        $rankPosition = Score::where('song_id', $validated['song_id'])
            ->where('difficulty_name', $validated['difficulty_name'])
            ->where('score', '>', $score->score)
            ->count() + 1;

        return response()->json([
            'success' => true,
            'message' => 'Lưu điểm số thành công vào MySQL Database!',
            'score' => $score,
            'calculated_pp' => $serverCalculatedPP,
            'rank_position' => $rankPosition,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'total_pp' => (float)$user->total_pp,
                'rating' => (float)$user->rating,
                'total_score' => (int)$user->total_score,
                'play_count' => (int)$user->play_count,
            ],
        ], 201);
    }

    public function userScores(int $userId): JsonResponse
    {
        $user = User::find($userId);

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy người chơi'], 404);
        }

        $scores = $user->scores()
            ->with('map:song_id,title,artist,cover_url')
            ->orderByDesc('pp')
            ->orderByDesc('score')
            ->limit(100)
            ->get();

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'avatar' => $user->avatar,
                'total_pp' => (float)$user->total_pp,
                'rating' => (float)$user->rating,
                'play_count' => (int)$user->play_count,
            ],
            'scores' => $scores,
        ]);
    }
}
