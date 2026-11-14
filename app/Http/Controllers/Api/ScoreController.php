<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Map;
use App\Models\Score;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScoreController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'song_id' => 'required|string',
            'difficulty_name' => 'required|string',
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
        ]);

        // Xác thực người dùng qua API token nếu có, hoặc tìm/tạo tài khoản Khách
        $user = null;
        $token = $request->bearerToken();
        if ($token) {
            $user = User::where('api_token', hash('sha256', $token))->first();
        }

        if (!$user) {
            $user = User::firstOrCreate(
                ['email' => 'guest@triarhythm.local'],
                [
                    'name' => 'Khách',
                    'username' => 'guest',
                    'password' => bcrypt('guest123456'),
                    'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=guest',
                    'rating' => 0.00,
                    'total_score' => 0,
                    'play_count' => 0,
                ]
            );
        }

        $score = Score::create([
            'user_id' => $user->id,
            'song_id' => $validated['song_id'],
            'difficulty_name' => $validated['difficulty_name'],
            'score' => $validated['score'],
            'accuracy' => $validated['accuracy'],
            'max_combo' => $validated['max_combo'],
            'rank' => $validated['rank'],
            'critical_perfect' => $validated['critical_perfect'] ?? 0,
            'perfect' => $validated['perfect'] ?? 0,
            'great' => $validated['great'] ?? 0,
            'good' => $validated['good'] ?? 0,
            'miss' => $validated['miss'] ?? 0,
            'pp' => $validated['pp'] ?? 0.00,
            'mods' => $validated['mods'] ?? [],
        ]);

        // Cập nhật thống kê người chơi
        $user->increment('play_count');
        $user->increment('total_score', $validated['score']);

        // Tính lại Rating trung bình 10 bài điểm cao nhất
        $topScores = $user->scores()
            ->orderByDesc('accuracy')
            ->limit(10)
            ->get();

        if ($topScores->count() > 0) {
            $avgAcc = $topScores->avg('accuracy');
            // Rating tính theo công thức AstroDX / Maimai rating cơ bản
            $newRating = round(($avgAcc / 100) * 15.0, 2);
            $user->rating = $newRating;
            $user->save();
        }

        // Tăng play_count của beatmap nếu có
        Map::where('song_id', $validated['song_id'])->increment('play_count');

        // Lấy thứ hạng trên bảng xếp hạng của bài hát này
        $rankPosition = Score::where('song_id', $validated['song_id'])
            ->where('difficulty_name', $validated['difficulty_name'])
            ->where('score', '>', $score->score)
            ->count() + 1;

        return response()->json([
            'success' => true,
            'message' => 'Lưu điểm số thành công vào MySQL Database!',
            'score' => $score,
            'rank_position' => $rankPosition,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
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
            return response()->json(['success' => false, 'message' => 'Không tìm thấy người dùng'], 404);
        }

        $scores = $user->scores()
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'user' => $user,
            'scores' => $scores,
        ]);
    }
}
