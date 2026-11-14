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
        $bestScores = $this->scores()
            ->orderByDesc('pp')
            ->limit(100)
            ->pluck('pp')
            ->toArray();

        $newTotalPP = PpCalculator::calculateTotalPP($bestScores);
        $this->total_pp = $newTotalPP;
        $this->rating = $newTotalPP; // Đồng bộ rating theo total_pp
        $this->save();

        return $newTotalPP;
    }
}
