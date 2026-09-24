import { bibleDataStatus, DEFAULT_BIBLE, type BibleData } from '@/domain';

/**
 * 화면이 쓰는 성경 구조 데이터의 단일 진입점. 확정 데이터로 바뀌면 여기(와 domain의 DEFAULT_BIBLE)만 바꾼다.
 * 지금은 잠정(provisional) 데이터이므로 화면이 그 사실을 표시한다. SAMPLE_BIBLE은 테스트 전용이다.
 */
export const BIBLE: BibleData = DEFAULT_BIBLE;

export type DataStatus = ReturnType<typeof bibleDataStatus>;
export const dataStatusOf = (bible: BibleData): DataStatus => bibleDataStatus(bible);
