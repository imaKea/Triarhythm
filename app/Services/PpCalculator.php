<?php

namespace App\Services;

class PpCalculator
{
    const ACC_THRESHOLD = 70.0;
    const ACC_RANGE = 30.0;
    const ACC_MAX_FACTOR = 1.0105;
    const ACC_EXPONENT = 3.0;

    const LENGTH_BASE = 0.9;
    const LENGTH_BONUS_MAX = 0.1;
    const LENGTH_NOTE_CAP = 500;

    const MISS_PENALTY_BASE = 0.97;
    const STARS_EXPONENT = 2.4;
    const PP_SCALE = 1.0;

    const TOTAL_TOP_COUNT = 100;
    const TOTAL_WEIGHT_DECAY = 0.95;

    /**
     * Tính toán Performance Points (PP) chuẩn xác trên server
     *
     * @param float $stars Star Rating của beatmap
     * @param float $achievement Tỷ lệ hoàn thành % (0 - 101.0)
     * @param int $missCount Số lượng nốt miss
     * @param int $noteCount Tổng số nốt trong bài
     * @return float Điểm PP làm tròn 2 chữ số thập phân
     */
    public static function calculatePP(float $stars, float $achievement, int $missCount = 0, int $noteCount = 0): float
    {
        if ($stars <= 0 || $achievement < self::ACC_THRESHOLD) {
            return 0.00;
        }

        $rawRatio = (($achievement - self::ACC_THRESHOLD) / self::ACC_RANGE) * self::ACC_MAX_FACTOR;
        $accRatio = max(0.0, min(1.2, $rawRatio));
        $accFactor = pow($accRatio, self::ACC_EXPONENT);

        $lengthBonus = self::LENGTH_BASE + min(self::LENGTH_BONUS_MAX, ($noteCount / self::LENGTH_NOTE_CAP) * self::LENGTH_BONUS_MAX);
        $missPenalty = pow(self::MISS_PENALTY_BASE, max(0, $missCount));

        $base = pow($stars, self::STARS_EXPONENT) * self::PP_SCALE;
        $pp = $base * $accFactor * $lengthBonus * $missPenalty;

        return round(max(0.0, $pp), 2);
    }

    /**
     * Tính tổng PP của người chơi dựa trên các điểm cao nhất
     * Cộng dồn tối đa top 100 bài với trọng số suy giảm 0.95^i
     *
     * @param array<float|int|object|array> $scores Danh sách điểm PP
     * @return float
     */
    public static function calculateTotalPP(array $scores): float
    {
        $ppList = [];
        foreach ($scores as $s) {
            $val = is_numeric($s) ? (float)$s : (float)($s['pp'] ?? $s->pp ?? 0);
            if ($val > 0) {
                $ppList[] = $val;
            }
        }

        rsort($ppList);
        $topList = array_slice($ppList, 0, self::TOTAL_TOP_COUNT);

        $total = 0.0;
        foreach ($topList as $i => $pp) {
            $total += $pp * pow(self::TOTAL_WEIGHT_DECAY, $i);
        }

        return round($total, 2);
    }
}
