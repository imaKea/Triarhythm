<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Thêm cờ khóa tài khoản cho users
        if (!Schema::hasColumn('users', 'is_banned')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('is_banned')->default(false)->after('role');
            });
        }

        // 2. Thêm trạng thái xuất bản cho beatmaps
        if (!Schema::hasColumn('maps', 'status')) {
            Schema::table('maps', function (Blueprint $table) {
                $table->string('status', 20)->default('published')->after('source'); // 'published' | 'draft'
            });
        }

        // 3. Tạo bảng lưu nhật ký thao tác quản trị viên
        if (!Schema::hasTable('admin_logs')) {
            Schema::create('admin_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('action', 50); // e.g. 'user.role', 'user.ban', 'map.delete', 'score.delete'
                $table->string('target_type', 50)->nullable(); // 'user', 'map', 'score', 'system'
                $table->string('target_id', 100)->nullable();
                $table->json('details')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->timestamps();

                $table->index(['action', 'created_at']);
                $table->index('user_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_logs');

        if (Schema::hasColumn('maps', 'status')) {
            Schema::table('maps', function (Blueprint $table) {
                $table->dropColumn('status');
            });
        }

        if (Schema::hasColumn('users', 'is_banned')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('is_banned');
            });
        }
    }
};
