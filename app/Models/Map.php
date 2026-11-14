<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Map extends Model
{
    use HasFactory;

    protected $fillable = [
        'song_id',
        'title',
        'artist',
        'creator',
        'source',
        'bpm',
        'preview_time',
        'cover_url',
        'audio_url',
        'video_url',
        'difficulties',
        'metadata',
        'play_count',
    ];

    protected $casts = [
        'bpm' => 'float',
        'preview_time' => 'float',
        'difficulties' => 'array',
        'metadata' => 'array',
        'play_count' => 'integer',
    ];

    public function scores(): HasMany
    {
        return $this->hasMany(Score::class, 'song_id', 'song_id');
    }
}
