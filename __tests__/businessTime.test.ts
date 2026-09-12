import moment from 'moment-timezone';
import { businessDateKey, civilToInstant, instantDayRange, plannedDayRange } from '../src/utils/business-time';

describe('Africa/Casablanca IANA rules and civil planning boundaries', () => {
  it('bundles the published Morocco rule instead of relying on host tzdata', () => {
    expect(moment.tz.dataVersion).toBe('2026c');
  });
  it.each([
    ['2026-09-19', '2026-09-19T22:00:00.000Z'],
    ['2026-09-20', '2026-09-20T23:00:00.000Z'],
    ['2026-09-21', '2026-09-21T23:00:00.000Z'],
  ])('keeps 23h local on %s', (day, expected) => {
    const instant = civilToInstant(new Date(day + 'T23:00:00Z'));
    expect(instant.toISOString()).toBe(expected);
    expect(moment(instant).tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm')).toBe(day + ' 23:00');
    const range = plannedDayRange(new Date(day + 'T12:00:00Z'));
    for (const time of ['00:00', '01:00', '16:00', '22:00', '23:00', '23:59']) {
      const value = new Date(day + 'T' + time + ':00Z');
      expect(value >= range.from && value < range.to).toBe(true);
    }
    expect(range.to.toISOString().slice(11)).toBe('00:00:00.000Z');
    expect(range.to.getTime() - range.from.getTime()).toBe(86400000);
  });
  it('calculates both midnights of the 25-hour transition day', () => {
    const range = instantDayRange(new Date('2026-09-20T12:00:00Z'));
    expect(range.from.toISOString()).toBe('2026-09-19T23:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(range.to.getTime() - range.from.getTime()).toBe(25 * 3600000);
    expect(businessDateKey(new Date('2026-09-20T23:30:00Z'))).toBe('2026-09-20');
  });
  it('uses the date-specific rule across the transition instant', () => {
    expect(moment('2026-09-20T00:59:59Z').tz('Africa/Casablanca').format('HH:mm:ss')).toBe('01:59:59');
    expect(moment('2026-09-20T01:00:00Z').tz('Africa/Casablanca').format('HH:mm:ss')).toBe('01:00:00');
  });
});
