# Backend Config & Routes

## 1. `config/services.php` - Add Majdata Config

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // ADD THIS:
    'majdata' => [
        'base_url' => env('MAJDATA_BASE_URL', 'https://majdata.net'),
        'timeout' => env('MAJDATA_TIMEOUT', 15),
        'max_response_size' => env('MAJDATA_MAX_RESPONSE_SIZE', 52428800), // 50MB
    ],

];
```

## 2. `.env.example` - Add Environment Variables

```env
# API Backend (Laravel)
# Mặc định client gọi /api (Vite dev proxy chuyển sang http://127.0.0.1:8000).
# Đổi nếu backend chạy ở host/port khác hoặc khi deploy tách domain.
VITE_API_BASE_URL=/api

# Majdata.net API Proxy
MAJDATA_BASE_URL=https://majdata.net
MAJDATA_TIMEOUT=15
MAJDATA_MAX_RESPONSE_SIZE=52428800
```

## 3. `routes/api.php` - Add Majdata Routes

```php
<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\MapController;
use App\Http\Controllers\Api\MajdataProxyController;
use App\Http\Controllers\Api\ScoreController;
use Illuminate\Support\Facades\Route;

// Auth Routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::middleware('auth.api')->group(function () {
        Route::post('/settings', [AuthController::class, 'updateSettings']);
        Route::post('/profile', [AuthController::class, 'updateProfile']);
    });
});

// Maps Routes
Route::prefix('maps')->group(function () {
    Route::get('/', [MapController::class, 'index']);
    Route::get('/{song_id}/assets/{asset}', [MapController::class, 'showAsset']);

    // Quản lý và thao tác beatmaps yêu cầu xác thực người dùng
    Route::middleware('auth.api')->group(function () {
        Route::get('/trash/list', [MapController::class, 'trashed']);
        Route::post('/', [MapController::class, 'store']);
        Route::post('/{song_id}/assets', [MapController::class, 'uploadAssets']);
        Route::post('/{song_id}/restore', [MapController::class, 'restore']);
        Route::delete('/{song_id}', [MapController::class, 'destroy']);
        Route::delete('/{song_id}/force', [MapController::class, 'forceDestroy']);
    });

    Route::get('/{song_id}', [MapController::class, 'show']);
});

// Scores Routes
Route::prefix('scores')->group(function () {
    Route::get('/user/{userId}', [ScoreController::class, 'userScores']);

    // Nộp điểm lên server yêu cầu xác thực tài khoản
    Route::middleware('auth.api')->group(function () {
        Route::post('/', [ScoreController::class, 'store']);
    });
});

// Leaderboard Routes
Route::prefix('leaderboard')->group(function () {
    Route::get('/global', [LeaderboardController::class, 'global']);
    Route::get('/map/{song_id}', [LeaderboardController::class, 'map']);
});

// Majdata Proxy Routes (Public - no auth required for browsing)
Route::prefix('majdata')->middleware('throttle:60,1')->group(function () {
    Route::get('/list', [MajdataProxyController::class, 'list']);
    Route::get('/chart/{chartId}/summary', [MajdataProxyController::class, 'summary']);
    Route::get('/chart/{chartId}/chart', [MajdataProxyController::class, 'chart']);
    Route::get('/chart/{chartId}/track', [MajdataProxyController::class, 'track']);
    Route::get('/chart/{chartId}/image', [MajdataProxyController::class, 'image']);
    Route::get('/chart/{chartId}/video', [MajdataProxyController::class, 'video']);
    Route::get('/chart/{chartId}/download', [MajdataProxyController::class, 'downloadPackage']);
});

// Admin Panel Routes (Bảo vệ bởi auth.api và role admin)
Route::prefix('admin')->middleware(['auth.api', 'admin'])->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/users', [AdminController::class, 'users']);
    Route::put('/users/{id}/role', [AdminController::class, 'updateUserRole']);
    Route::put('/users/{id}/ban', [AdminController::class, 'toggleUserBan']);
    Route::put('/users/{id}/reset-password', [AdminController::class, 'resetUserPassword']);
    Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);

    Route::get('/maps', [AdminController::class, 'maps']);
    Route::put('/maps/{id}', [AdminController::class, 'updateMap']);
    Route::delete('/maps/{id}', [AdminController::class, 'deleteMap']);

    Route::get('/scores', [AdminController::class, 'scores']);
    Route::delete('/scores/{id}', [AdminController::class, 'deleteScore']);
    Route::post('/scores/recalculate-pp', [AdminController::class, 'recalculateAllPP']);

    Route::get('/logs', [AdminController::class, 'logs']);
});
```

## 4. `app/Http/Controllers/Api/MajdataProxyController.php`

See the full controller code in the previous plan. Key features:

- **SSRF Protection**: Fixed base URL from config, chart ID validation regex
- **Timeout**: 15 seconds default
- **Response Size Limit**: 50MB max
- **Streaming**: For audio/image/video to avoid memory issues
- **Caching**: List (60s), Summary (5min)
- **Rate Limiting**: 60 requests/minute via throttle middleware
- **User-Agent**: `Triarhythm/1.0`
- **Endpoints**:
  - `GET /api/majdata/list` - Chart list with search, sort, pagination
  - `GET /api/majdata/chart/{chartId}/summary` - Metadata
  - `GET /api/majdata/chart/{chartId}/chart` - maidata.txt (Simai)
  - `GET /api/majdata/chart/{chartId}/track` - Audio stream
  - `GET /api/majdata/chart/{chartId}/image` - Cover image
  - `GET /api/majdata/chart/{chartId}/video` - Video stream
  - `GET /api/majdata/chart/{chartId}/download` - Package info with all URLs