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
});

// Maps Routes
Route::prefix('maps')->group(function () {
    Route::get('/', [MapController::class, 'index']);
    Route::post('/', [MapController::class, 'store']);
    Route::post('/{song_id}/assets', [MapController::class, 'uploadAssets']);
    Route::get('/{song_id}', [MapController::class, 'show']);
    Route::delete('/{song_id}', [MapController::class, 'destroy']);
});

// Scores Routes
Route::prefix('scores')->group(function () {
    Route::post('/', [ScoreController::class, 'store']);
    Route::get('/user/{userId}', [ScoreController::class, 'userScores']);
});

// Leaderboard Routes
Route::prefix('leaderboard')->group(function () {
    Route::get('/global', [LeaderboardController::class, 'global']);
    Route::get('/map/{song_id}', [LeaderboardController::class, 'map']);
});
