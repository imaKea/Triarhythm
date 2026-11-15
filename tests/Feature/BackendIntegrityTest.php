<?php

namespace Tests\Feature;

use App\Models\Map;
use App\Models\Score;
use App\Models\User;
use App\Services\PpCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class BackendIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(string $role = 'user'): array
    {
        $token = Str::random(40);
        $user = User::create([
            'name' => ucfirst($role) . ' Tester',
            'username' => $role . '_' . Str::random(8),
            'email' => Str::random(8) . '@example.com',
            'password' => Hash::make('password'),
            'role' => $role,
            'api_token' => hash('sha256', $token),
        ]);

        return [$user, $token];
    }

    private function createMap(User $owner, array $difficulties = []): Map
    {
        return Map::create([
            'user_id' => $owner->id,
            'song_id' => 'map_' . Str::random(8),
            'title' => 'Original Title',
            'artist' => 'Original Artist',
            'creator' => $owner->name,
            'difficulties' => $difficulties,
        ]);
    }

    private function scorePayload(string $songId, string $difficulty = 'Expert'): array
    {
        return [
            'song_id' => $songId,
            'difficulty_name' => $difficulty,
            'stars' => 14,
            'note_count' => 9999,
            'score' => 990000,
            'accuracy' => 99.5,
            'max_combo' => 500,
            'rank' => 'SSS',
        ];
    }

    public function test_score_without_matching_server_map_difficulty_is_saved_with_zero_pp(): void
    {
        [$user, $token] = $this->createUser();
        $map = $this->createMap($user, [
            ['difficultyName' => 'Hard', 'stars' => 5.0, 'noteCount' => 200],
        ]);

        $missingMapResponse = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/scores', $this->scorePayload('not_a_server_map'));
        $missingMapResponse->assertCreated()->assertJsonPath('calculated_pp', 0);

        $mismatchedDifficultyResponse = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/scores', $this->scorePayload($map->song_id, 'Expert'));
        $mismatchedDifficultyResponse->assertCreated()->assertJsonPath('calculated_pp', 0);

        $this->assertSame(2, Score::where('user_id', $user->id)->count());
        $this->assertSame(0.0, (float)Score::where('user_id', $user->id)->first()->pp);
        $this->assertSame(0.0, (float)Score::where('user_id', $user->id)->first()->stars);
    }

    public function test_matching_server_difficulty_overrides_client_stars_and_note_count(): void
    {
        [$user, $token] = $this->createUser();
        $map = $this->createMap($user, [
            ['difficultyName' => 'Expert', 'stars' => 6.0, 'noteCount' => 250],
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/scores', $this->scorePayload($map->song_id));

        $expectedPP = PpCalculator::calculatePP(6.0, 99.5, 0, 250);
        $response->assertCreated()->assertJsonPath('calculated_pp', $expectedPP);
        $score = Score::firstOrFail();
        $this->assertSame(6.0, (float)$score->stars);
        $this->assertSame($expectedPP, (float)$score->pp);
        $this->assertSame(1, (int)$user->fresh()->play_count);
        $this->assertSame(990000, (int)$user->fresh()->total_score);
        $this->assertSame(1, (int)$map->fresh()->play_count);
    }

    public function test_non_owner_cannot_replace_map_metadata_or_assets(): void
    {
        [$owner, $ownerToken] = $this->createUser();
        [, $otherToken] = $this->createUser();
        $map = $this->createMap($owner);

        $payload = [
            'song_id' => $map->song_id,
            'title' => 'Changed Title',
            'artist' => 'Changed Artist',
            'difficulties' => [['difficultyName' => 'Normal', 'stars' => 1, 'noteCount' => 1]],
        ];
        $this->withHeader('Authorization', "Bearer {$otherToken}")
            ->postJson('/api/maps', $payload)
            ->assertForbidden();

        $this->assertSame('Original Title', $map->fresh()->title);
        $this->assertSame($owner->id, $map->fresh()->user_id);

        Storage::fake('public');
        $map->update(['audio_url' => '/storage/beatmaps/original.mp3']);
        $this->withHeader('Authorization', "Bearer {$otherToken}")
            ->postJson("/api/maps/{$map->song_id}/assets", [
                'audio' => UploadedFile::fake()->create('replacement.mp3', 10, 'audio/mpeg'),
            ])
            ->assertForbidden();

        $this->assertSame('/storage/beatmaps/original.mp3', $map->fresh()->audio_url);

        $ownerUpdate = $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->postJson('/api/maps', $payload);
        $ownerUpdate->assertCreated();
        $this->assertSame('Changed Title', $map->fresh()->title);
        $this->assertSame($owner->id, $map->fresh()->user_id);

        $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->postJson("/api/maps/{$map->song_id}/assets", [
                'audio' => UploadedFile::fake()->create('replacement.mp3', 10, 'audio/mpeg'),
            ])
            ->assertOk();
    }

    public function test_admin_pp_recalculation_uses_server_difficulty_and_judgement_count(): void
    {
        [, $adminToken] = $this->createUser('admin');
        [$user] = $this->createUser();
        $map = $this->createMap($user, [
            ['difficultyName' => 'Expert', 'stars' => 4.5, 'noteCount' => 800],
        ]);
        $score = Score::create([
            'user_id' => $user->id,
            'song_id' => $map->song_id,
            'difficulty_name' => 'Expert',
            'stars' => 12,
            'score' => 900000,
            'accuracy' => 99,
            'max_combo' => 1000,
            'critical_perfect' => 1,
            'perfect' => 2,
            'great' => 3,
            'good' => 4,
            'miss' => 5,
            'rank' => 'SS',
            'pp' => 999,
        ]);

        $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->postJson('/api/admin/scores/recalculate-pp')
            ->assertOk();

        $expectedPP = PpCalculator::calculatePP(4.5, 99, 5, 15);
        $this->assertSame(4.5, (float)$score->fresh()->stars);
        $this->assertSame($expectedPP, (float)$score->fresh()->pp);
        $this->assertSame($expectedPP, (float)$user->fresh()->total_pp);
    }

    public function test_score_and_map_deletions_recalculate_all_user_score_statistics(): void
    {
        [, $adminToken] = $this->createUser('admin');
        [$user] = $this->createUser();
        $firstMap = $this->createMap($user);
        $secondMap = $this->createMap($user);
        $firstScore = Score::create([
            'user_id' => $user->id,
            'song_id' => $firstMap->song_id,
            'score' => 1000,
            'pp' => 100,
            'rank' => 'SS',
        ]);
        Score::create([
            'user_id' => $user->id,
            'song_id' => $secondMap->song_id,
            'score' => 2000,
            'pp' => 50,
            'rank' => 'S',
        ]);
        $user->update([
            'total_pp' => 999,
            'rating' => 999,
            'total_score' => 999,
            'play_count' => 99,
        ]);
        $firstMap->update(['play_count' => 1]);
        $secondMap->update(['play_count' => 1]);

        $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->deleteJson("/api/admin/scores/{$firstScore->id}")
            ->assertOk();

        $user->refresh();
        $this->assertSame(50.0, (float)$user->total_pp);
        $this->assertSame(50.0, (float)$user->rating);
        $this->assertSame(2000, (int)$user->total_score);
        $this->assertSame(1, (int)$user->play_count);
        $this->assertSame(0, (int)$firstMap->fresh()->play_count);

        $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->deleteJson("/api/admin/maps/{$secondMap->id}")
            ->assertOk();

        $user->refresh();
        $this->assertSame(0.0, (float)$user->total_pp);
        $this->assertSame(0.0, (float)$user->rating);
        $this->assertSame(0, (int)$user->total_score);
        $this->assertSame(0, (int)$user->play_count);
        $this->assertSame(0, Score::where('user_id', $user->id)->count());
    }
}
