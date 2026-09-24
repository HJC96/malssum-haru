import { formatRange } from '@/domain';
import { bookName } from './books';
import type { Lang } from './lang';

interface RangeLike {
  bookId: string;
  start: { chapter: number; verse: number };
  end: { chapter: number; verse: number };
}

/**
 * 장절 범위 하나를 표시 문자열로 만든다. 형식은 domain `formatRange`(언어 중립)를 그대로 쓰고
 * 이 모듈은 언어별 책 이름과 구분자만 담당한다. 예: "요한복음 3:1–4:54".
 */
export function formatRangeText(r: RangeLike, lang: Lang): string {
  return formatRange(r, (id) => bookName(id, lang));
}

/** 여러 범위를 한 줄로 잇는다. 한국어 ", ", 영어 "; ". */
export function formatPassageText(ranges: readonly RangeLike[], lang: Lang): string {
  return ranges.map((r) => formatRangeText(r, lang)).join(lang === 'ko' ? ', ' : '; ');
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD`를 시간대 변환 없이 그 달력 날짜 그대로 표시한다.
 * (UTC 기준으로 포맷하므로 브라우저 시간대에 따라 하루가 밀리지 않는다)
 */
export function formatIsoDate(iso: string, lang: Lang): string {
  const m = ISO_DATE.exec(iso);
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
}

/** 브라우저(또는 지정 시간대) 기준 오늘 날짜를 `YYYY-MM-DD`로 돌려준다. */
export function localIsoDate(now: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
