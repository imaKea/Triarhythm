<?php

namespace Tests\Feature;

use App\Models\Map;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SoftDeleteMapTest extends TestCase
{
    private function createMapWithUser(): array
    {
        $token = Str::random(40);
        $user = User::create([
            'name' => 'Mapper User',
            'username' => 'mapper_' . Str::random(8),
            'email' => Str::random(8) . '@triarhythm.com',
            'password' => Hash::make('password123'),
            'role' => 'user',
            'api_token' => hash('sha256', $token),
        ]);

        $songId = 'soft_del_test_' . Str::random(6);
        $map = Map::create([
            'user_id' => $user->id,
            'song_id' => $songId,
            'title' => 'Soft Delete Test Song',
            'artist' => 'Test Artist',
            'creator' => $user->username,
            'difficulties' => [],
        ]);

        return [$user, $token, $map, $songId];
    }

    public function test_delete_map_performs_soft_delete(): void
    {
        [$user, $token, $map, $songId] = $this->createMapWithUser();

        // 1. Gửi request DELETE /api/maps/{song_id}
        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/maps/{$songId}");

        $res->assertStatus(200);

        // 2. Map bị ẩn khỏi danh sách thông thường
        $this->assertNull(Map::find($map->id));

        // 3. Nhưng bản ghi vẫn còn trong database với deleted_at khác null
        $trashed = Map::onlyTrashed()->where('song_id', $songId)->first();
        $this->assertNotNull($trashed);
        $this->assertNotNull($trashed->deleted_at);
    }

    public function test_restore_map_recovers_trashed_map(): void
    {
        [$user, $token, $map, $songId] = $this->createMapWithUser();

        // Soft delete
        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/maps/{$songId}");

        // Gửi request POST /api/maps/{song_id}/restore
        $restoreRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/maps/{$songId}/restore");

        $restoreRes->assertStatus(200);

        // Bản ghi được phục hồi vào danh sách chính thức
        $activeMap = Map::where('song_id', $songId)->first();
        $this->assertNotNull($activeMap);
        $this->assertNull($activeMap->deleted_at);
    }

    public function test_get_trashed_maps_list(): void
    {
        [$user, $token, $map, $songId] = $this->createMapWithUser();

        // Soft delete
        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/maps/{$songId}");

        // Lấy danh sách thùng rác
        $listRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/maps/trash/list');

        $listRes->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);

        $this->assertCount(1, $listRes->json('data'));
        $this->assertEquals($songId, $listRes->json('data.0.song_id'));
    }

    public function test_force_delete_permanently_removes_map(): void
    {
        [$user, $token, $map, $songId] = $this->createMapWithUser();

        // Xóa vĩnh viễn
        $forceRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/maps/{$songId}/force");

        $forceRes->assertStatus(200);

        // Map không còn tồn tại ngay cả trong withTrashed()
        $this->assertNull(Map::withTrashed()->where('song_id', $songId)->first());
    }
}
