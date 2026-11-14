<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('song_id')->index();
            $table->string('difficulty_name', 50)->default('Normal');
            $table->unsignedInteger('score')->default(0);
            $table->decimal('accuracy', 5, 2)->default(0.00);
            $table->unsignedInteger('max_combo')->default(0);
            $table->string('rank', 10)->default('D');
            $table->unsignedInteger('critical_perfect')->default(0);
            $table->unsignedInteger('perfect')->default(0);
            $table->unsignedInteger('great')->default(0);
            $table->unsignedInteger('good')->default(0);
            $table->unsignedInteger('miss')->default(0);
            $table->decimal('pp', 8, 2)->default(0.00);
            $table->json('mods')->nullable();
            $table->timestamps();

            $table->index(['song_id', 'difficulty_name', 'score']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scores');
    }
};
