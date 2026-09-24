import type { IsoDate, Weekday } from './types';

// 시간대 변환 없이 달력 날짜만 다룬다. Date 객체를 쓰지 않고 정수 산술로 계산한다.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** 'YYYY-MM-DD' 형식이고 달력에 실제로 있는 날짜면 true. */
export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** 1970-01-01을 0으로 하는 일 번호(proleptic Gregorian). 유효한 날짜만 넣는다. */
export function toDayNumber(date: IsoDate): number {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError(`invalid date: ${date}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12; // 3월=0 … 2월=11
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDayNumber(dayNumber: number): IsoDate {
  const z = dayNumber + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 0 = 일요일 … 6 = 토요일. 1970-01-01은 목요일이다. */
export function weekdayOfDayNumber(dayNumber: number): Weekday {
  return ((((dayNumber + 4) % 7) + 7) % 7) as Weekday;
}

export function weekdayOf(date: IsoDate): Weekday {
  return weekdayOfDayNumber(toDayNumber(date));
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + n);
}

/** 양 끝을 포함한 날짜 수. start > end면 0. */
export function inclusiveDayCount(start: IsoDate, end: IsoDate): number {
  return Math.max(0, toDayNumber(end) - toDayNumber(start) + 1);
}
