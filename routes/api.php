<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\MapController;
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
