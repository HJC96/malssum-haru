import {
  intersectRanges,
  verseCount,
  type BibleData,
  type IsoDate,
  type PlanResult,
  type VerseRange,
} from '@/domain';

export type TodayState =
  | { kind: 'no-target' } // 오늘 배정이 없거나 계획 기간 밖
  | { kind: 'not-entered'; verses: number; ranges: VerseRange[] } // 오늘 읽은 범위 미입력(0%가 아니다)
  | { kind: 'entered'; verses: number; ranges: VerseRange[]; pct: number };

/**
 * 화면에 보이는 계획의 오늘 행을 기준으로 오늘 목표와 달성률을 정한다.
 * 재계산(asOf)을 켜지 않아도 오늘 목표가 나오도록, `summary.todayTarget`이 있으면 그 값을 그대로 쓰고
 * 없으면 `days`의 오늘 행을 읽는다. 배분은 다시 계산하지 않는다(PRD STAT01, AC24).
 */
export function todayState(
  result: PlanResult,
  bible: BibleData,
  today: IsoDate,
  todayRead: VerseRange[],
): TodayState {
  const { todayTarget, todayAchievementPct } = result.summary;
  if (todayTarget) {
    if (todayAchievementPct === null) return { kind: 'not-entered', ...todayTarget };
    return { kind: 'entered', ...todayTarget, pct: clampPct(todayAchievementPct) };
  }
  const row = result.days.find((d) => d.date === today);
  if (!row || row.status !== 'assigned' || row.verseCount === 0) return { kind: 'no-target' };
  if (todayRead.length === 0) return { kind: 'not-entered', verses: row.verseCount, ranges: row.ranges };
  const done = verseCount(bible, intersectRanges(bible, todayRead, row.ranges));
  return { kind: 'entered', verses: row.verseCount, ranges: row.ranges, pct: clampPct((done * 100) / row.verseCount) };
}

const clampPct = (n: number) => Math.min(100, Math.max(0, n));
