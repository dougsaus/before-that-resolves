import { describe, expect, it } from 'vitest';
import { normalizeDateInput } from './date';

describe('normalizeDateInput', () => {
  it('returns date-only strings untouched', () => {
    expect(normalizeDateInput('2025-02-14')).toBe('2025-02-14');
  });

  it('extracts the date from ISO timestamps', () => {
    expect(normalizeDateInput('2025-02-14T00:00:00.000Z')).toBe('2025-02-14');
  });

  it('formats Date inputs using local calendar parts', () => {
    const date = new Date(2025, 1, 14, 12, 30, 0);
    expect(normalizeDateInput(date)).toBe('2025-02-14');
  });
});
