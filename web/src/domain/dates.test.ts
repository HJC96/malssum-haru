import { describe, expect, it } from 'vitest';
import { addDays, daysInMonth, fromDayNumber, inclusiveDayCount, isLeapYear, isValidIsoDate, toDayNumber, weekdayOf } from './dates';

describe('dates (AC03: 시작·마감 포함, 요일, 윤년·월 경계)', () => {
  it('윤년 규칙을 따른다', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('존재하지 않는 날짜와 잘못된 형식을 거부한다', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-1-01')).toBe(false);
    expect(isValidIsoDate('2026-04-31')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('요일은 달력 요일이다(0=일)', () => {
    expect(weekdayOf('1970-01-01')).toBe(4); // 목
    expect(weekdayOf('2026-09-24')).toBe(4); // 목
    expect(weekdayOf('2024-02-29')).toBe(4); // 목
    expect(weekdayOf('2026-01-04')).toBe(0); // 일
    expect(weekdayOf('1969-12-31')).toBe(3); // 수(1970 이전)
  });

  it('일 번호 변환은 Date.UTC와 일치하고 되돌아온다', () => {
    for (const d of ['1970-01-01', '1999-12-31', '2000-02-29', '2024-02-29', '2026-03-01', '2100-03-01', '1900-03-01']) {
      const [y, m, day] = d.split('-').map(Number) as [number, number, number];
      expect(toDayNumber(d)).toBe(Date.UTC(y, m - 1, day) / 86400000);
      expect(fromDayNumber(toDayNumber(d))).toBe(d);
    }
  });

  it('월·연 경계와 윤년 2월 29일을 넘는다', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('양 끝을 포함해 센다', () => {
    expect(inclusiveDayCount('2026-01-01', '2026-01-01')).toBe(1);
    expect(inclusiveDayCount('2028-02-28', '2028-03-01')).toBe(3);
    expect(inclusiveDayCount('2026-02-28', '2026-03-01')).toBe(2);
    expect(inclusiveDayCount('2026-01-02', '2026-01-01')).toBe(0);
  });
});
