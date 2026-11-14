<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Score extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'song_id',
        'difficulty_name',
        'stars',
        'score',
        'accuracy',
        'max_combo',
        'rank',
        'critical_perfect',
        'perfect',
        'great',
        'good',
        'miss',
        'pp',
        'mods',
    ];

    protected $casts = [
        'stars' => 'decimal:2',
        'score' => 'integer',
        'accuracy' => 'decimal:2',
        'max_combo' => 'integer',
        'critical_perfect' => 'integer',
        'perfect' => 'integer',
        'great' => 'integer',
        'good' => 'integer',
        'miss' => 'integer',
        'pp' => 'decimal:2',
        'mods' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function map(): BelongsTo
    {
        return $this->belongsTo(Map::class, 'song_id', 'song_id');
    }
}
