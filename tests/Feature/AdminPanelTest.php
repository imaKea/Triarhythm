<?php

namespace Tests\Feature;

use App\Models\Map;
use App\Models\Score;
use App\Models\User;
use App\Models\AdminLog;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    private function createAdmin(): array
    {
        $token = Str::random(40);
        $admin = User::create([
            'name' => 'Admin Tester',
            'username' => 'admin_' . Str::random(8),
            'email' => Str::random(8) . '@triarhythm.com',
            'password' => Hash::make('secret123'),
            'role' => 'admin',
            'api_token' => hash('sha256', $token),
        ]);
        return [$admin, $token];
    }

    private function createRegularUser(): array
    {
        $token = Str::random(40);
        $user = User::create([
            'name' => 'Regular Tester',
            'username' => 'user_' . Str::random(8),
            'email' => Str::random(8) . '@triarhythm.com',
            'password' => Hash::make('secret123'),
            'role' => 'user',
            'api_token' => hash('sha256', $token),
        ]);
        return [$user, $token];
    }

    public function test_unauthenticated_cannot_access_admin_dashboard(): void
    {
        $response = $this->getJson('/api/admin/dashboard');
        $response->assertStatus(401);
    }

    public function test_regular_user_forbidden_from_admin_dashboard(): void
    {
        [$user, $token] = $this->createRegularUser();
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/admin/dashboard');
        $response->assertStatus(403);
    }

    public function test_admin_can_access_dashboard_and_get_stats(): void
    {
        [$admin, $token] = $this->createAdmin();
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/admin/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'stats' => [
                    'total_users',
                    'total_admins',
                    'total_banned',
                    'total_maps',
                    'total_scores',
                    'total_plays',
                    'total_server_pp',
                ],
                'plays_by_day',
                'rank_distribution',
            ]);
    }

    public function test_admin_can_update_user_role_and_toggle_ban(): void
    {
        [$admin, $adminToken] = $this->createAdmin();
        [$targetUser, $userToken] = $this->createRegularUser();

        // 1. Promote user to admin
        $roleRes = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/users/{$targetUser->id}/role", ['role' => 'admin']);
        $roleRes->assertStatus(200);
        $this->assertEquals('admin', $targetUser->fresh()->role);

        // 2. Demote back to user
        $roleRes2 = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/users/{$targetUser->id}/role", ['role' => 'user']);
        $roleRes2->assertStatus(200);
        $this->assertEquals('user', $targetUser->fresh()->role);

        // 3. Ban user
        $banRes = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/users/{$targetUser->id}/ban");
        $banRes->assertStatus(200);
        $this->assertTrue($targetUser->fresh()->is_banned);

        // Banned user cannot access auth.api endpoints
        $bannedAccessRes = $this->withHeader('Authorization', "Bearer {$userToken}")
            ->postJson('/api/auth/settings', ['settings' => []]);
        $bannedAccessRes->assertStatus(403);

        // 4. Unban user
        $unbanRes = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/users/{$targetUser->id}/ban");
        $unbanRes->assertStatus(200);
        $this->assertFalse($targetUser->fresh()->is_banned);
    }

    public function test_admin_can_update_and_delete_map(): void
    {
        [$admin, $adminToken] = $this->createAdmin();

        $songId = 'admin_map_' . Str::random(8);
        $map = Map::create([
            'song_id' => $songId,
            'title' => 'Initial Title',
            'artist' => 'Initial Artist',
            'creator' => 'Test Creator',
            'difficulties' => [],
        ]);

        // Sửa metadata
        $updateRes = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/maps/{$map->id}", [
                'title' => 'Updated Title By Admin',
                'status' => 'draft',
            ]);
        $updateRes->assertStatus(200);
        $this->assertEquals('Updated Title By Admin', $map->fresh()->title);
        $this->assertEquals('draft', $map->fresh()->status);

        // Xóa map
        $deleteRes = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->deleteJson("/api/admin/maps/{$map->id}");
        $deleteRes->assertStatus(200);
        $this->assertNull(Map::find($map->id));
    }

    public function test_admin_delete_score_recalculates_user_total_pp(): void
    {
        [$admin, $adminToken] = $this->createAdmin();
        [$targetUser, ] = $this->createRegularUser();

        $songId = 'score_test_map_' . Str::random(6);
        $score = Score::create([
            'user_id' => $targetUser->id,
            'song_id' => $songId,
            'difficulty_name' => 'Normal',
            'score' => 995000,
            'accuracy' => 99.5,
            'max_combo' => 450,
            'stars' => 7.0,
            'pp' => 250.0,
            'rank' => 'SSS',
        ]);

        $targetUser->total_pp = 250.0;
        $targetUser->save();

        // Xóa điểm gian lận
        $delScoreRes = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->deleteJson("/api/admin/scores/{$score->id}");
        $delScoreRes->assertStatus(200);

        // Sau khi xóa điểm duy nhất, total_pp của user phải về 0
        $this->assertEquals(0, (float)$targetUser->fresh()->total_pp);

        // Kiểm tra log hoạt động
        $logs = AdminLog::where('action', 'score.delete')->get();
        $this->assertGreaterThan(0, $logs->count());
    }
}
