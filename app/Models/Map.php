<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Map extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'song_id',
        'title',
        'artist',
        'creator',
        'source',
        'status',
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
        'user_id' => 'integer',
        'bpm' => 'float',
        'preview_time' => 'float',
        'difficulties' => 'array',
        'metadata' => 'array',
        'play_count' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scores(): HasMany
    {
        return $this->hasMany(Score::class, 'song_id', 'song_id');
    }
}
