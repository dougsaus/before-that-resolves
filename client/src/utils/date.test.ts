import { describe, expect, it } from 'vitest';
import { parseLocalDate } from './date';

describe('parseLocalDate', () => {
  it('parses date-only strings in local time', () => {
    const parsed = parseLocalDate('2025-02-14');
    expect(parsed.getFullYear()).toBe(2025);
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getDate()).toBe(14);
  });

  it('extracts the date from ISO timestamps', () => {
    const parsed = parseLocalDate('2025-02-14T00:00:00.000Z');
    expect(parsed.getFullYear()).toBe(2025);
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getDate()).toBe(14);
  });
});
