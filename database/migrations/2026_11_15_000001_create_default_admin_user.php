<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Khởi tạo tài khoản Admin mặc định khi chạy migrate
        $adminToken = env('ADMIN_API_TOKEN', Str::random(40));

        $admin = User::firstOrCreate(
            ['username' => 'Admin'],
            [
                'name' => 'Triarhythm Admin',
                'email' => 'admin@triarhythm.com',
                'password' => Hash::make('123456'),
                'role' => 'admin',
                'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin',
                'rating' => 16.00,
                'total_pp' => 1200.00,
                'total_score' => 20000000,
                'play_count' => 500,
                'api_token' => hash('sha256', $adminToken),
            ]
        );

        $admin->role = 'admin';
        $admin->password = Hash::make('123456');
        $admin->save();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        User::where('username', 'Admin')->delete();
    }
};
