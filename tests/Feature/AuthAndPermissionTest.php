<?php

namespace Tests\Feature;

use App\Models\Map;
use App\Models\User;
use App\Services\PpCalculator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthAndPermissionTest extends TestCase
{
    public function test_unauthenticated_cannot_delete_map(): void
    {
        $response = $this->deleteJson('/api/maps/some_song_id');
        $response->assertStatus(401);
    }

    public function test_unauthenticated_cannot_submit_score(): void
    {
        $response = $this->postJson('/api/scores', [
            'song_id' => 'test_song',
            'difficulty_name' => 'Normal',
            'score' => 1000000,
            'accuracy' => 100.0,
            'max_combo' => 500,
            'rank' => 'SSS',
        ]);
        $response->assertStatus(401);
    }

    public function test_server_calculates_pp_independently(): void
    {
        $pp = PpCalculator::calculatePP(10.0, 99.5, 0, 500);
        $this->assertGreaterThan(0, $pp);

        $totalPP = PpCalculator::calculateTotalPP([$pp, 200.0, 150.0]);
        $this->assertGreaterThan($pp, $totalPP);
    }

    public function test_regular_user_cannot_delete_others_map(): void
    {
        $owner = User::create([
            'name' => 'Map Owner',
            'username' => 'owner_' . Str::random(8),
            'email' => Str::random(8) . '@example.com',
            'password' => Hash::make('password'),
            'role' => 'user',
            'api_token' => hash('sha256', 'owner_token'),
        ]);

        $otherUser = User::create([
            'name' => 'Other User',
            'username' => 'other_' . Str::random(8),
            'email' => Str::random(8) . '@example.com',
            'password' => Hash::make('password'),
            'role' => 'user',
            'api_token' => hash('sha256', 'other_token'),
        ]);

        $songId = 'test_map_' . Str::random(6);
        $map = Map::create([
            'user_id' => $owner->id,
            'song_id' => $songId,
            'title' => 'Test Song',
            'difficulties' => [],
        ]);

        // other user attempts to delete owner's map -> 403 Forbidden
        $response = $this->withHeader('Authorization', 'Bearer other_token')
            ->deleteJson("/api/maps/{$songId}");

        $response->assertStatus(403);

        // owner can delete their own map -> 200 OK
        $ownerResponse = $this->withHeader('Authorization', 'Bearer owner_token')
            ->deleteJson("/api/maps/{$songId}");

        $ownerResponse->assertStatus(200);
    }
}
