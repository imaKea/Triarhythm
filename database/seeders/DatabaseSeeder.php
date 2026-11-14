<?php

namespace Database\Seeders;

use App\Models\Map;
use App\Models\Score;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Tạo các tài khoản mẫu
        $admin = User::firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Triarhythm Admin',
                'email' => 'admin@triarhythm.com',
                'password' => Hash::make('password123'),
                'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
                'rating' => 14.85,
                'total_score' => 12450000,
                'play_count' => 142,
                'api_token' => hash('sha256', 'admin_test_token_12345'),
            ]
        );

        $pro = User::firstOrCreate(
            ['username' => 'rhythm_god'],
            [
                'name' => 'Rhythm God',
                'email' => 'god@triarhythm.com',
                'password' => Hash::make('password123'),
                'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=rhythm_god',
                'rating' => 15.00,
                'total_score' => 15000000,
                'play_count' => 180,
            ]
        );

        $player2 = User::firstOrCreate(
            ['username' => 'astro_player'],
            [
                'name' => 'Astro Player',
                'email' => 'astro@triarhythm.com',
                'password' => Hash::make('password123'),
                'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=astro',
                'rating' => 13.40,
                'total_score' => 8920000,
                'play_count' => 95,
            ]
        );

        // 2. Tạo beatmap mẫu Aegleseeker
        $map = Map::firstOrCreate(
            ['song_id' => 'maimai_aegleseeker_silentroom_vs_frums'],
            [
                'title' => 'Aegleseeker',
                'artist' => 'Silentroom vs Frums',
                'creator' => 'サファ太 vs 翠楼屋',
                'source' => 'maimai',
                'bpm' => 234.0,
                'preview_time' => 17400,
                'cover_url' => null,
                'audio_url' => null,
                'difficulties' => [
                    [
                        'difficultyIndex' => 2,
                        'difficultyName' => 'Advanced',
                        'difficultyLevel' => '5',
                        'stars' => 5,
                        'noteCount' => 331,
                    ],
                    [
                        'difficultyIndex' => 3,
                        'difficultyName' => 'Expert',
                        'difficultyLevel' => '10',
                        'stars' => 10,
                        'noteCount' => 533,
                    ],
                    [
                        'difficultyIndex' => 4,
                        'difficultyName' => 'Master',
                        'difficultyLevel' => '13+',
                        'stars' => 13.7,
                        'noteCount' => 637,
                    ],
                    [
                        'difficultyIndex' => 5,
                        'difficultyName' => 'Re:Master',
                        'difficultyLevel' => '14',
                        'stars' => 14.4,
                        'noteCount' => 1075,
                    ],
                ],
                'metadata' => [
                    'genre' => 'Hardcore / Experimental',
                    'bpm' => '234',
                ],
                'play_count' => 24,
            ]
        );

        // 3. Tạo điểm mẫu cho bảng xếp hạng
        Score::firstOrCreate(
            [
                'user_id' => $pro->id,
                'song_id' => $map->song_id,
                'difficulty_name' => 'Master',
            ],
            [
                'score' => 1009500,
                'accuracy' => 100.95,
                'max_combo' => 637,
                'rank' => 'SSS+',
                'critical_perfect' => 620,
                'perfect' => 17,
                'great' => 0,
                'good' => 0,
                'miss' => 0,
                'pp' => 850.50,
            ]
        );

        Score::firstOrCreate(
            [
                'user_id' => $admin->id,
                'song_id' => $map->song_id,
                'difficulty_name' => 'Master',
            ],
            [
                'score' => 998200,
                'accuracy' => 99.82,
                'max_combo' => 610,
                'rank' => 'SSS',
                'critical_perfect' => 590,
                'perfect' => 35,
                'great' => 12,
                'good' => 0,
                'miss' => 0,
                'pp' => 780.20,
            ]
        );

        Score::firstOrCreate(
            [
                'user_id' => $player2->id,
                'song_id' => $map->song_id,
                'difficulty_name' => 'Master',
            ],
            [
                'score' => 965400,
                'accuracy' => 96.54,
                'max_combo' => 520,
                'rank' => 'S',
                'critical_perfect' => 510,
                'perfect' => 75,
                'great' => 45,
                'good' => 7,
                'miss' => 0,
                'pp' => 640.00,
            ]
        );
    }
}
