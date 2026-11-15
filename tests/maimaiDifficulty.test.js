import { describe, expect, it } from 'vitest';
import {
  MAIMAI_CATEGORIES,
  MAIMAI_CATEGORY_COLORS,
  normalizeMaimaiCategory,
  formatMaimaiLevel,
  calculateMaimaiRating
} from '../src/core/beatmap/maimaiDifficulty.js';

describe('Maimai Difficulty System', () => {
  it('defines exactly the 5 standard categories with no Utage', () => {
    expect(MAIMAI_CATEGORIES).toEqual(['Basic', 'Advanced', 'Expert', 'Master', 'Re:Master']);
    expect(MAIMAI_CATEGORIES).not.toContain('Utage');
  });

  it('provides authentic colors for all 5 categories', () => {
    for (const cat of MAIMAI_CATEGORIES) {
      expect(MAIMAI_CATEGORY_COLORS[cat]).toBeDefined();
      expect(MAIMAI_CATEGORY_COLORS[cat].bg).toBeDefined();
      expect(MAIMAI_CATEGORY_COLORS[cat].text).toBeDefined();
    }
  });

  describe('normalizeMaimaiCategory', () => {
    it('normalizes common difficulty names to standard 5 categories', () => {
      expect(normalizeMaimaiCategory('Basic')).toBe('Basic');
      expect(normalizeMaimaiCategory('Easy')).toBe('Basic');
      expect(normalizeMaimaiCategory('Normal')).toBe('Advanced');
      expect(normalizeMaimaiCategory('Advanced')).toBe('Advanced');
      expect(normalizeMaimaiCategory('Hard')).toBe('Advanced');
      expect(normalizeMaimaiCategory('Expert')).toBe('Expert');
      expect(normalizeMaimaiCategory('Insane')).toBe('Expert');
      expect(normalizeMaimaiCategory('Master')).toBe('Master');
      expect(normalizeMaimaiCategory('Extra')).toBe('Master');
      expect(normalizeMaimaiCategory('Re:Master')).toBe('Re:Master');
      expect(normalizeMaimaiCategory('Remaster')).toBe('Re:Master');
    });

    it('re-maps Utage to Re:Master ("bỏ utage")', () => {
      expect(normalizeMaimaiCategory('Utage')).toBe('Re:Master');
      expect(normalizeMaimaiCategory('宴')).toBe('Re:Master');
      expect(normalizeMaimaiCategory('Utage [狂]')).toBe('Re:Master');
    });

    it('defaults unknown names to Master', () => {
      expect(normalizeMaimaiCategory('Chaos 99')).toBe('Master');
      expect(normalizeMaimaiCategory('')).toBe('Master');
      expect(normalizeMaimaiCategory(null)).toBe('Master');
    });
  });

  describe('formatMaimaiLevel', () => {
    it('formats ratings under 7 as whole numbers', () => {
      expect(formatMaimaiLevel(3.2)).toBe('3');
      expect(formatMaimaiLevel(6.8)).toBe('6');
    });

    it('formats ratings >= 7 with plus sign if decimal >= 0.7', () => {
      expect(formatMaimaiLevel(12.0)).toBe('12');
      expect(formatMaimaiLevel(12.6)).toBe('12');
      expect(formatMaimaiLevel(12.7)).toBe('12+');
      expect(formatMaimaiLevel(13.9)).toBe('13+');
    });

    it('caps difficulty at max 16', () => {
      expect(formatMaimaiLevel(16.0)).toBe('16');
      expect(formatMaimaiLevel(16.5)).toBe('16');
      expect(formatMaimaiLevel(20.0)).toBe('16');
    });

    it('handles string input gracefully', () => {
      expect(formatMaimaiLevel('13+')).toBe('13+');
      expect(formatMaimaiLevel('14')).toBe('14');
    });
  });

  describe('calculateMaimaiRating', () => {
    it('returns minimum 1.0 for empty or invalid beatmap', () => {
      expect(calculateMaimaiRating(null).rawRating).toBe(1.0);
      expect(calculateMaimaiRating({ notes: [] }).rawRating).toBe(1.0);
      expect(calculateMaimaiRating(null).levelString).toBe('1');
    });

    it('calculates higher rating for denser charts', () => {
      // 10 notes spread over 10 seconds (1 NPS)
      const easyNotes = Array.from({ length: 10 }, (_, i) => ({
        time: i * 1000,
        lane: i % 8,
        type: 'tap'
      }));
      const easyRating = calculateMaimaiRating({ notes: easyNotes });

      // 100 notes spread over 10 seconds (10 NPS)
      const hardNotes = Array.from({ length: 100 }, (_, i) => ({
        time: i * 100,
        lane: i % 8,
        type: i % 5 === 0 ? 'break' : i % 3 === 0 ? 'slide' : 'tap'
      }));
      const hardRating = calculateMaimaiRating({ notes: hardNotes });

      expect(hardRating.rawRating).toBeGreaterThan(easyRating.rawRating);
      expect(hardRating.rawRating).toBeLessThanOrEqual(16.0);
      expect(easyRating.rawRating).toBeGreaterThanOrEqual(1.0);
    });

    it('caps calculated rating at 16.0', () => {
      // Absurdly dense chart
      const extremeNotes = Array.from({ length: 2000 }, (_, i) => ({
        time: i * 10,
        lane: i % 8,
        type: 'break'
      }));
      const rating = calculateMaimaiRating({ notes: extremeNotes });
      expect(rating.rawRating).toBe(16.0);
      expect(rating.levelString).toBe('16');
    });
  });
});
