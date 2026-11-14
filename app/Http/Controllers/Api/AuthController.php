<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private function formatUserData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role ?? 'user',
            'avatar' => $user->avatar,
            'country' => $user->country ?? 'VN',
            'total_pp' => (float)($user->total_pp ?? 0.00),
            'rating' => (float)($user->rating ?? 0.00),
            'total_score' => (int)($user->total_score ?? 0),
            'play_count' => (int)($user->play_count ?? 0),
            'settings' => $user->settings ?? null,
        ];
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => 'required|string|min:3|max:50|unique:users,username',
            'email' => 'required|email|max:100|unique:users,email',
            'password' => 'required|string|min:6',
            'name' => 'nullable|string|max:100',
        ]);

        $token = Str::random(60);

        $user = User::create([
            'name' => $validated['name'] ?? $validated['username'],
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'user',
            'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($validated['username']),
            'rating' => 0.00,
            'total_pp' => 0.00,
            'total_score' => 0,
            'play_count' => 0,
            'api_token' => hash('sha256', $token),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Đăng ký tài khoản thành công!',
            'token' => $token,
            'user' => $this->formatUserData($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'login' => 'required|string', // username or email
            'password' => 'required|string',
        ]);

        $login = $request->input('login');
        $user = User::where('username', $login)
            ->orWhere('email', $login)
            ->first();

        if (!$user || !Hash::check($request->input('password'), $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản hoặc mật khẩu không chính xác!',
            ], 401);
        }

        $token = Str::random(60);
        $user->api_token = hash('sha256', $token);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập thành công!',
            'token' => $token,
            'user' => $this->formatUserData($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = User::where('api_token', hash('sha256', $token))->first();
            }
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Chưa đăng nhập hoặc phiên đã hết hạn'], 401);
        }

        $bestScores = $user->scores()
            ->with('map:song_id,title,artist,cover_url')
            ->orderByDesc('pp')
            ->orderByDesc('score')
            ->limit(10)
            ->get();

        return response()->json([
            'success' => true,
            'user' => $this->formatUserData($user),
            'best_scores' => $bestScores,
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = User::where('api_token', hash('sha256', $token))->first();
            }
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Chưa đăng nhập'], 401);
        }

        $settings = $request->input('settings', []);
        $user->settings = $settings;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Đã đồng bộ cài đặt lên tài khoản!',
            'settings' => $user->settings,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            $token = $request->bearerToken();
            if ($token) {
                $user = User::where('api_token', hash('sha256', $token))->first();
            }
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Chưa đăng nhập'], 401);
        }

        $validated = $request->validate([
            'name' => 'nullable|string|max:100',
            'avatar' => 'nullable|string|max:500',
            'current_password' => 'nullable|string',
            'new_password' => 'nullable|string|min:6',
        ]);

        if (!empty($validated['name'])) {
            $user->name = $validated['name'];
        }

        if (!empty($validated['avatar'])) {
            $user->avatar = $validated['avatar'];
        }

        if (!empty($validated['new_password'])) {
            if (empty($validated['current_password']) || !Hash::check($validated['current_password'], $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mật khẩu hiện tại không chính xác!',
                ], 422);
            }
            $user->password = Hash::make($validated['new_password']);
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật thông tin tài khoản thành công!',
            'user' => $this->formatUserData($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->bearerToken();
        if ($token) {
            User::where('api_token', hash('sha256', $token))->update(['api_token' => null]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Đăng xuất thành công!',
        ]);
    }
}
