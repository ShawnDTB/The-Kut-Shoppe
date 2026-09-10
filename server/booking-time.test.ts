// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { localDate, validDate, wallWindow } from './booking-time';

describe('shop wall-time scheduling', () => {
  it('validates actual calendar dates', () => {
    expect(validDate('2027-02-29')).toBe(false); expect(validDate('2028-02-29')).toBe(true);
    expect(validDate('2027-13-01')).toBe(false); expect(validDate('2027-1-01')).toBe(false);
  });
  it('resolves Eastern DST transitions without host-local time assumptions', () => {
    const spring = wallWindow('2027-03-14', '01:00', '04:00', 'America/New_York')!;
    expect(new Date(spring.start).toISOString()).toBe('2027-03-14T06:00:00.000Z');
    expect(spring.end - spring.start).toBe(2 * 3_600_000);
    expect(wallWindow('2027-03-14', '02:30', '04:00', 'America/New_York')).toBeNull();
    const fall = wallWindow('2027-11-07', '01:00', '04:00', 'America/New_York')!;
    expect(new Date(fall.start).toISOString()).toBe('2027-11-07T06:00:00.000Z');
    expect(fall.end - fall.start).toBe(3 * 3_600_000);
  });
  it('handles fractional offsets and midnight closing, rejecting overnight windows', () => {
    const result = wallWindow('2027-01-10', '23:00', '24:00', 'Asia/Kathmandu')!;
    expect(new Date(result.end).toISOString()).toBe('2027-01-10T18:15:00.000Z');
    expect(localDate(result.end, 'Asia/Kathmandu')).toBe('2027-01-11');
    expect(wallWindow('2027-01-10', '23:00', '01:00', 'Asia/Kathmandu')).toBeNull();
    expect(() => wallWindow('2027-01-10', '09:00', '17:00', 'invalid')).toThrow();
  });
});
