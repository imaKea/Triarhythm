<?php

namespace App\Models;

use App\Services\PpCalculator;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
        'is_banned',
        'avatar',
        'country',
        'rating',
        'total_pp',
        'total_score',
        'play_count',
        'settings',
        'api_token',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'rating' => 'decimal:2',
            'total_pp' => 'decimal:2',
            'total_score' => 'integer',
            'play_count' => 'integer',
            'settings' => 'array',
            'is_banned' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return ($this->role ?? 'user') === 'admin';
    }

    public function scores(): HasMany
    {
        return $this->hasMany(Score::class);
    }

    public function maps(): HasMany
    {
        return $this->hasMany(Map::class);
    }

    /**
     * Tính toán và cập nhật lại total_pp cho người chơi
     */
    public function recalculateTotalPP(): float
    {
        return $this->recalculateStats()['total_pp'];
    }

    /**
     * Rebuild score-derived statistics from the remaining score records.
     *
     * Call inside a transaction while this user's row is locked when writes may
     * happen concurrently.
     *
     * @return array{total_pp: float, total_score: int, play_count: int}
     */
    public function recalculateStats(): array
    {
        $scores = $this->scores();
        $totalScore = (int)(clone $scores)->sum('score');
        $playCount = (int)(clone $scores)->count();
        $bestScores = (clone $scores)
            ->orderByDesc('pp')
            ->limit(PpCalculator::TOTAL_TOP_COUNT)
            ->pluck('pp')
            ->toArray();

        $newTotalPP = PpCalculator::calculateTotalPP($bestScores);
        $this->total_pp = $newTotalPP;
        $this->rating = $newTotalPP;
        $this->total_score = $totalScore;
        $this->play_count = $playCount;
        $this->save();

        return [
            'total_pp' => $newTotalPP,
            'total_score' => $totalScore,
            'play_count' => $playCount,
        ];
    }
}
