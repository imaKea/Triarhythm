<?php

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
    Route::get('/{song_id}', [MapController::class, 'show']);

    // Upload & Xoá map yêu cầu xác thực người dùng
    Route::middleware('auth.api')->group(function () {
        Route::post('/', [MapController::class, 'store']);
        Route::post('/{song_id}/assets', [MapController::class, 'uploadAssets']);
        Route::delete('/{song_id}', [MapController::class, 'destroy']);
    });
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
