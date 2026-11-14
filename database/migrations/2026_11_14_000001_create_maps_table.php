<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maps', function (Blueprint $table) {
            $table->id();
            $table->string('song_id')->unique();
            $table->string('title');
            $table->string('artist')->default('Unknown Artist');
            $table->string('creator')->default('Mapper');
            $table->string('source', 50)->default('maimai'); // maimai, osu, triarhythm
            $table->float('bpm')->default(120);
            $table->float('preview_time')->default(0);
            $table->string('cover_url', 500)->nullable();
            $table->string('audio_url', 500)->nullable();
            $table->json('difficulties'); // Array of { difficultyName, difficultyLevel, stars, noteCount, beatmap }
            $table->json('metadata')->nullable();
            $table->unsignedInteger('play_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maps');
    }
};
